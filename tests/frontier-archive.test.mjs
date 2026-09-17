import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bootstrapArchive, updateArchive, mergeObservation } from "../scripts/frontier-archive.mjs";
const now = "2026-09-18T00:00:00.000Z";
const paper = (id, scoreValue = 10) => ({ id, title: `Robot manipulation ${id}`, abstract: "Full robot abstract", authors: ["Test Author"], primaryCategory: "cs.RO", categories: ["cs.RO"], published: "2026-09-01T00:00:00Z", updated: "2026-09-01T00:00:00Z", dateProvenance: "arxiv-api", metadataCompleteness: "abstract", firstSeen: now, status: "candidate", url: `https://arxiv.org/abs/${id}`, pdfUrl: `https://arxiv.org/pdf/${id}`, routes: ["robotics"], matchedTopics: [{ id: "manipulation" }], triageScore: scoreValue });
const score = (item) => ({ triageScore: item.triageScore, routes: item.routes, matchedTopics: item.matchedTopics });
const update = (state, incoming, options = {}) => updateArchive({ ...state, incoming, now, score, minScore: 7, poolLimit: 1, source: { mode: "test" }, ...options });

test("baseline imports do not claim new discoveries", () => {
  const result = bootstrapArchive([paper("2609.10001")], now);
  assert.equal(result.archive.papers.length, 1);
  assert.deepEqual(result.events.events[0].added, []);
  assert.equal(result.events.events[0].kind, "baseline");
});
test("display cap never removes archived candidates, and historical candidates can return", () => {
  const base = bootstrapArchive([paper("2609.10001", 10)], now);
  const result = update(base, [paper("2609.10002", 20)]);
  assert.equal(result.pool.length, 1);
  assert.equal(result.pool[0].id, "2609.10002");
  assert.equal(result.archive.papers.length, 2);
  const again = update(result, [], { score: (item) => ({ ...score(item), triageScore: item.id === "2609.10001" ? 30 : 1 }) });
  assert.equal(again.pool[0].id, "2609.10001");
  assert.equal(again.archive.papers.length, 2);
  assert.equal(again.events.events.length, result.events.events.length);
});
test("repeated observation is idempotent for content and events; freshness clock still advances", () => {
  const base = bootstrapArchive([paper("2609.10001")], now);
  const result = update(base, [paper("2609.10002")]);
  const again = update(result, [paper("2609.10002")], { now: "2026-09-19T00:00:00Z" });
  assert.deepEqual(again.events, result.events);
  assert.deepEqual(again.archive.papers, result.archive.papers);
  assert.notEqual(again.archive.last_success_at, result.archive.last_success_at);
});
test("new candidates cannot self-declare reviewed; existing editorial choices are preserved", () => {
  const old = { ...paper("2609.10001"), status: "ignored", editorNote: "Out of scope" };
  const result = update(bootstrapArchive([old], now), [{ ...paper("2609.10001"), status: "reviewed" }, { ...paper("2609.10002"), status: "reviewed" }]);
  assert.equal(result.archive.papers[0].status, "ignored");
  assert.equal(result.archive.papers[0].editorNote, "Out of scope");
  assert.equal(result.archive.papers[1].status, "candidate");
});
test("listing fallback cannot erase an API abstract, authors or submission date", () => {
  const old = paper("2609.10001");
  const result = mergeObservation(old, { ...old, abstract: "", authors: [], published: null, updated: null, dateProvenance: "listing-announcement", announcedAt: "2026-09-18T12:00:00Z", metadataCompleteness: "listing" });
  assert.equal(result.abstract, old.abstract);
  assert.equal(result.published, old.published);
  assert.equal(result.dateProvenance, "arxiv-api");
  assert.equal(result.announcedAt, "2026-09-18T12:00:00Z");
});
test("older API version cannot overwrite newer metadata", () => {
  const old = { ...paper("2609.10001"), updated: "2026-09-17T00:00:00Z", abstract: "New evidence" };
  assert.deepEqual(mergeObservation(old, paper("2609.10001")), old);
});
test("metadata update adds one event, while firstSeen remains immutable", () => {
  const base = bootstrapArchive([paper("2609.10001")], now);
  const result = update(base, [{ ...paper("2609.10001"), abstract: "Revised abstract", firstSeen: "2026-09-19T00:00:00Z" }]);
  assert.deepEqual(result.events.events[1].updated, ["2609.10001"]);
  assert.deepEqual(result.events.events[1].added, []);
  assert.equal(result.archive.papers[0].firstSeen, now);
});
test("below-threshold new records stay outside the archive, existing records remain", () => {
  const result = update(bootstrapArchive([paper("2609.10001")], now), [paper("2609.10002", 2)]);
  assert.equal(result.archive.papers.length, 1);
  assert.equal(result.events.events.length, 1);
});
test("crawler fixture run: durable writes, repeat dedup, RSS dates, dry run isolation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roboopus-archive-test-"));
  try {
    await Promise.all([mkdir(path.join(root, "config")), mkdir(path.join(root, "content")), mkdir(path.join(root, "site/data"), { recursive: true })]);
    await writeFile(path.join(root, "config/frontier-arxiv.json"), await readFile(new URL("../config/frontier-arxiv.json", import.meta.url)));
    const fixture = path.join(root, "input.xml");
    await writeFile(fixture, '<feed><entry><id>http://arxiv.org/abs/2609.99991v1</id><title>Robot manipulation with MPC</title><summary>Robot control and manipulation</summary><author><name>Fixture Author</name></author><published>2026-09-17T00:00:00Z</published><updated>2026-09-17T00:00:00Z</updated><category term="cs.RO"/></entry></feed>');
    const script = fileURLToPath(new URL("../scripts/fetch-frontier-arxiv.mjs", import.meta.url));
    const run = (...args) => execFileSync(process.execPath, [script, `--input-file=${fixture}`, ...args], { cwd: root, encoding: "utf8" });
    run();
    const read = async (name) => JSON.parse(await readFile(path.join(root, "content", name), "utf8"));
    assert.equal((await read("frontier-archive.json")).papers.length, 1);
    run();
    assert.equal((await read("frontier-events.json")).events.length, 2);
    const before = await readFile(path.join(root, "content/frontier-archive.json"), "utf8");
    run("--dry-run");
    assert.equal(await readFile(path.join(root, "content/frontier-archive.json"), "utf8"), before);
    await writeFile(fixture, '<rss><channel><item><link>https://arxiv.org/abs/2609.99992</link><title>Robot manipulation via MPC</title><dc:creator>Fixture Author</dc:creator><description>Robot control</description><pubDate>Thu, 17 Sep 2026 00:00:00 GMT</pubDate></item></channel></rss>');
    run();
    const rss = (await read("frontier-archive.json")).papers.find((item) => item.id === "2609.99992");
    assert.equal(rss.published, null);
    assert.equal(rss.updated, null);
    assert.equal(rss.announcedAt, "2026-09-17T00:00:00.000Z");
  } finally {
    // Only the exact directory returned by mkdtemp for this test is removed.
    await rm(root, { recursive: true, force: true });
  }
});
