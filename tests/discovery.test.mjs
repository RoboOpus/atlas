import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { searchRecords, excerpt, queryGroups, freshness } from "../site/search/engine.js";
const read = async (name) => JSON.parse(await readFile(new URL(`../site/data/${name}.json`, import.meta.url), "utf8"));
const index = await read("search-index");
const maintenance = await read("maintenance");

test("every explicit selection reaches archive, discovery log and keyword search", async () => {
  const folder = new URL("../content/paper-selections/", import.meta.url);
  const archive = await read("frontier-archive"), ledger = await read("frontier-events");
  const daily = JSON.parse(await readFile(new URL("../content/frontier-archive.json", import.meta.url), "utf8"));
  assert.equal(archive.last_success_at, daily.last_success_at);
  for (const filename of (await readdir(folder)).filter((name) => name.endsWith(".json"))) {
    const batch = JSON.parse(await readFile(new URL(filename, folder), "utf8"));
    const event = ledger.events.find((item) => item.id === batch.id);
    assert.equal(event.kind, "selection");
    assert.deepEqual(event.selected, batch.papers.map((item) => item.id));
    assert(!Object.hasOwn(event, "query")); assert(!Object.hasOwn(event, "source"));
    for (const paper of batch.papers) {
      assert.equal(archive.papers.filter((item) => item.id === paper.id).length, 1);
      assert(archive.papers.find((item) => item.id === paper.id).routes.includes(batch.track));
      const results = searchRecords(index.records, { q: paper.id, track: batch.track, type: "paper" });
      assert(results.some((item) => item.id === `paper:${paper.id}`));
    }
  }
});

test("index includes every public entity once, including selected reading notes", async () => {
  const inputs = [["knowledge", "articles"], ["field-guides", "records"], ["catalog", "nodes"], ["sources", "sources"], ["frontier-archive", "papers"], ["benchmark-registry", "records"], ["control-experiments", "experiments"], ["work-identities", "works"], ["hardware-price-snapshots", "snapshots"], ["venue-registry", "venues"]];
  let count = 0;
  count += (await read("reading-notes")).notes.length;
  for (const [name, key] of inputs) count += (await read(name))[key].length;
  assert.equal(index.records.length, count);
  assert.equal(new Set(index.records.map((item) => item.id)).size, count);
  assert.equal(new Set(index.records.map((item) => item.type)).size, (await read("reading-notes")).notes.length ? 11 : 10);
});
test("Chinese aliases find English topics; all query groups must match", () => {
  const rows = [{ id: "1", title: "Impedance control", summary: "Franka", text: "contact", type: "guide", tracks: ["robotics"] }, { id: "2", title: "Impedance", summary: "", text: "", type: "guide", tracks: ["hardware"] }];
  assert.equal(searchRecords(rows, { q: "阻抗 Franka" })[0].id, "1");
  assert.equal(searchRecords(rows, { q: "阻抗 missing" }).length, 0);
  assert.equal(searchRecords(rows, { q: "阻抗", track: "hardware" })[0].id, "2");
  assert.equal(searchRecords(rows, { q: "阻抗", type: "paper" }).length, 0);
  assert(queryGroups("model predictive control")[0].includes("mpc"));
});
test("full width / mixed case query normalization and exact filter intersection", () => {
  assert(searchRecords(index.records, { q: "ＲｏｂｏＤｏｊｏ", type: "benchmark", track: "robotics" }).some((item) => item.id === "benchmark:robodojo-2026"));
  assert.equal(searchRecords(index.records, { q: "RoboDojo", type: "price" }).length, 0);
});
test("article full text is indexed beyond summary; snippets retain matching context", () => {
  const article = index.records.find((item) => item.id === "article:robotics-impedance-force-control");
  assert(article.text.length > article.summary.length * 4);
  assert(!article.text.includes('"source_ids"'));
  const record = { text: `${"a".repeat(500)} rareterm ${"b".repeat(400)}`, summary: "" };
  assert(excerpt(record, "rareterm").includes("rareterm"));
  assert(excerpt(record, "rareterm").length <= 222);
});
test("ranking favors title relevance, never candidate triage scores", () => {
  const rows = [
    { id: "b", title: "Other", summary: "MPC", text: "", type: "paper", tracks: ["robotics"], triageScore: 999 },
    { id: "a", title: "MPC", summary: "", text: "", type: "article", tracks: ["robotics"] }
  ];
  assert.equal(searchRecords(rows, { q: "MPC" })[0].id, "a");
});
test("candidate and historical-price evidence cannot become reviewed in the index", () => {
  for (const item of index.records.filter((item) => item.type === "paper")) assert.match(item.evidence, /^候选/);
  for (const item of index.records.filter((item) => item.type === "price")) assert.match(item.evidence, /非实时报价/);
  assert.equal(maintenance.review_queue.length, index.records.filter((item) => item.type === "article" && item.evidence !== "人工已复核").length);
});
test("freshness distinguishes unknown, future and threshold crossing", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  assert.equal(freshness(null, now).state, "unknown");
  assert.equal(freshness("bad-date", now).state, "unknown");
  assert.equal(freshness("2027-01-01", now).state, "future");
  assert.equal(freshness("2026-09-15", now, 3).state, "within-window");
  assert.equal(freshness("2026-09-14", now, 3).state, "stale");
});
test("price clocks use capture date, not build date; WAM and Lab gaps remain explicit", async () => {
  const priceData = await read("hardware-price-snapshots");
  assert.deepEqual(maintenance.prices.map((item) => item.checked_at), priceData.snapshots.map((item) => item.captured_at));
  assert.match(maintenance.coverage.find((item) => item.track === "wam").note, /按需加载 WAM/);
  assert.match(maintenance.coverage.find((item) => item.track === "lab").note, /等待用户/);
});
test("all links are scoped project routes or HTTPS; static routes exist", async () => {
  for (const item of index.records) {
    assert(item.url.startsWith("/atlas/") || item.url.startsWith("https://"));
    if (!item.url.startsWith("/atlas/")) continue;
    const url = new URL(item.url, "https://roboopus.github.io");
    const html = await readFile(new URL(`../site/${url.pathname.slice(7)}index.html`, import.meta.url), "utf8");
    assert.match(html, /<html/);
    if (["guide", "node", "benchmark", "experiment"].includes(item.type)) assert(url.hash.length > 1);
  }
});
