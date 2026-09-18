import test from "node:test";
import assert from "node:assert/strict";
import { validateWamIndex, loadWamIndex, mergeIndexes, WAM_INDEX_URL } from "../site/search/federation.js";
import { searchRecords } from "../site/search/engine.js";
const row = { id: "wam:paper:2609.00001", type: "paper", title: "Robot world model", summary: "Candidate", text: "robot imagination", tracks: ["wam"], url: "https://roboopus.github.io/wam/radar/#paper-2609.00001", updated_at: "2026-09-18", date_label: "首次收录", identifiers: { arxiv: "2609.00001" }, evidence: "候选" };
const index = { schema_version: "1.0.0", producer: "RoboOpus/wam", source_revision: "a".repeat(40), generated_at: "2026-09-18T00:00:00Z", records: [row] };
const response = (data, options = {}) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" }, ...options });

test("WAM contract accepts only scoped records and never copies private/privileged fields", () => {
  const result = validateWamIndex({ ...index, private_notes: "PRIVATE", records: [{ ...row, private_notes: "PRIVATE", human_reviewed: true, origins: ["lab"] }] });
  assert(!JSON.stringify(result).includes("PRIVATE")); assert(!Object.hasOwn(result.records[0], "human_reviewed"));
  assert.deepEqual(result.records[0].origins, ["wam"]); assert.match(result.records[0].evidence, /候选/);
});
test("malformed, foreign and duplicate WAM records reject the whole external index", () => {
  for (const changes of [{ producer: "Other/repo" }, { source_revision: "bad" }, { schema_version: "2" }, { generated_at: "bad" }, { records: [row, row] }]) assert.throws(() => validateWamIndex({ ...index, ...changes }));
  for (const changes of [{ url: "javascript:alert(1)" }, { url: "https://evil.example/wam/" }, { url: "https://roboopus.github.io/atlas/" }, { url: "https://roboopus.github.io/wam/../atlas/" }, { tracks: ["lab"] }, { type: "reviewed" }, { updated_at: "bad" }, { text: "x".repeat(120001) }]) assert.throws(() => validateWamIndex({ ...index, records: [{ ...row, ...changes }] }));
});
test("loader requests only fixed public index, without cookies, queries or referrer", async () => {
  let seen;
  const data = await loadWamIndex(async (url, options) => { seen = { url, options }; return response(index); });
  assert.equal(data.records.length, 1); assert.equal(seen.url, WAM_INDEX_URL);
  assert.equal(new URL(seen.url).search, ""); assert.equal(seen.options.credentials, "omit");
  assert.equal(seen.options.referrerPolicy, "no-referrer"); assert.equal(seen.options.redirect, "error");
});
test("network, bad content, HTTP failures and timeouts are explicit, not empty success", async () => {
  for (const fetcher of [async () => { throw new Error("offline"); }, async () => response(index, { status: 404 }), async () => new Response("html", { headers: { "content-type": "text/html" } }), async () => response({}), async () => new Response("{", { headers: { "content-type": "application/json" } })]) await assert.rejects(loadWamIndex(fetcher, 1000));
  let signal;
  await assert.rejects(loadWamIndex(async (_, options) => { signal = options.signal; return new Promise(() => {}); }, 10), /timeout/);
  assert.equal(signal.aborted, true);
});
test("streamed responses are bounded even without a Content-Length header", async () => {
  await assert.rejects(loadWamIndex(async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { "content-type": "application/json" } })), /too large/);
});
test("same arXiv candidate deduplicates, preserves evidence, terms and both source links", () => {
  const atlas = [{ ...row, id: "paper:2609.00001", url: "https://arxiv.org/abs/2609.00001v2", evidence: "候选 · 含作者摘要", text: "Atlas detailed abstract", tracks: ["frontier"] }];
  const before = JSON.stringify(atlas);
  const merged = mergeIndexes(atlas, validateWamIndex(index).records);
  assert.equal(merged.length, 1); assert.equal(JSON.stringify(atlas), before);
  assert.deepEqual(merged[0].origins, ["atlas", "wam"]); assert.deepEqual(merged[0].tracks, ["frontier", "wam"]);
  assert.match(merged[0].evidence, /^候选/); assert.match(merged[0].text, /Atlas detailed abstract.*imagination/);
  assert.equal(merged[0].alternate_sources[0].url, row.url);
  assert.equal(searchRecords(merged, { q: "imagination", origin: "wam" }).length, 1);
});
test("catalog, article and candidate levels remain distinct even for the same paper", () => {
  const wam = validateWamIndex({ ...index, records: [row, { ...row, id: "wam:publication:2609.00001", type: "publication" }, { ...row, id: "wam:article:example", type: "article", text: "Full original discussion of asynchronous inference" }] }).records;
  const merged = mergeIndexes([], wam);
  assert.equal(merged.length, 3);
  assert.equal(searchRecords(merged, { q: "asynchronous", origin: "wam", type: "article" }).length, 1);
  assert.equal(searchRecords(merged, { q: "asynchronous", origin: "atlas" }).length, 0);
});
test("Atlas-only and WAM-only results still work with intersection filters", () => {
  const atlas = [{ ...row, id: "article:local", title: "Local robot guide", type: "article", tracks: ["robotics"] }];
  assert.equal(searchRecords(mergeIndexes(atlas, []), { origin: "atlas", type: "article" }).length, 1);
  assert.equal(searchRecords(mergeIndexes(atlas, []), { origin: "wam" }).length, 0);
  assert.equal(searchRecords(mergeIndexes([], validateWamIndex(index).records), { origin: "wam", track: "wam", type: "paper" }).length, 1);
});
