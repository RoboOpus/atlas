import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, copyFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { searchRequest, parseSearchFeed, requestPapers, selectedBatch, combineSelections, validateBatch } from "../scripts/paper-search-core.mjs";
const id = "2609.00001", now = "2026-09-18T00:00:00Z", batchId = "selection-11111111-1111-4111-8111-111111111111";
const paper = { id, title: "Synthetic Robot World Model", authors: ["Fixture Author"], abstract: "Synthetic fixture only; not a real paper.", published: now, updated: now, categories: ["cs.RO"], primaryCategory: "cs.RO", url: `https://arxiv.org/abs/${id}v1`, pdfUrl: `https://arxiv.org/pdf/${id}v1` };
const feed = `<feed xmlns="http://www.w3.org/2005/Atom"><opensearch:totalResults>1</opensearch:totalResults><entry><id>http://arxiv.org/abs/${id}v1</id><title>${paper.title}</title><summary>${paper.abstract}</summary><published>${now}</published><updated>${now}</updated><author><name>Fixture Author</name></author><category term="cs.RO"/><arxiv:primary_category term="cs.RO"/></entry></feed>`;
const run = { id: "search-22222222-2222-4222-8222-222222222222", schema_version: "1.0.0", state: "success", source_mode: "arxiv-api", request: searchRequest({ query: "PRIVATE_IDEA", track: "wam" }), papers: [paper], private_note: "PRIVATE_NOTE" };
const batch = () => selectedBatch(run, [id], batchId, now);
test("query encodes exact syntax, date bounds and paging without changing daily defaults", () => {
  const request = searchRequest({ query: 'ti:"world model" AND cat:cs.RO', since: "2025-01-01", until: "2026-09-18", start: 10, limit: 5, sort: "submittedDate" });
  const url = new URL(request.url);
  assert.equal(url.origin, "https://export.arxiv.org"); assert.equal(url.searchParams.get("start"), "10");
  assert.equal(url.searchParams.get("search_query"), '(ti:"world model" AND cat:cs.RO) AND submittedDate:[202501010000 TO 202609182359]');
  for (const changes of [{ query: "" }, { query: "x\n" }, { limit: 101 }, { start: -1 }, { since: "2026-02-30" }, { since: "" }, { since: "2026-01-01", until: "2025-01-01" }, { sort: "quality" }, { track: "lab" }]) assert.throws(() => searchRequest({ query: "robot", ...changes }));
});
test("Atom parser distinguishes valid zero, errors, malformed records and incomplete XML", () => {
  assert.deepEqual(parseSearchFeed(feed), { total: 1, papers: [paper] });
  assert.equal(parseSearchFeed('<feed><opensearch:totalResults>0</opensearch:totalResults></feed>').papers.length, 0);
  for (const xml of ["<html>blocked</html>", feed.replace("</entry>", ""), feed.replace(id + "v1", "errors#incorrect_id_format"), feed.replace("Fixture Author", ""), feed.replace("<opensearch:totalResults>1</opensearch:totalResults>", ""), '<!DOCTYPE foo SYSTEM "file:///secret">' + feed]) assert.throws(() => parseSearchFeed(xml));
});
test("API calls fixed endpoint and fails rather than substituting unrelated fallback results", async () => {
  let calls = 0;
  const result = await requestPapers(run.request, async (url, options) => { calls++; assert.equal(new URL(url).origin, "https://export.arxiv.org"); assert.equal(options.credentials, "omit"); return new Response(feed, { headers: { "content-type": "application/atom+xml" } }); });
  assert.equal(calls, 1); assert.equal(result.papers[0].id, id);
  for (const response of [new Response("limit", { status: 429 }), new Response(feed, { headers: { "content-type": "text/html" } }), new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { "content-type": "application/atom+xml" } })]) await assert.rejects(requestPapers(run.request, async () => response));
});
test("public selection is an allowlist and requires explicit returned IDs and real success", () => {
  assert(!JSON.stringify(batch()).includes("PRIVATE"));
  assert.equal(batch().stage, "candidate");
  for (const changes of [{ state: "failed" }, { state: "empty" }, { source_mode: "fixture" }]) assert.throws(() => selectedBatch({ ...run, ...changes }, [id], batchId, now));
  for (const ids of [undefined, [], [id, id], ["2609.99999"]]) assert.throws(() => selectedBatch(run, ids, batchId, now));
  assert.throws(() => validateBatch({ ...batch(), query: "PRIVATE" }));
  assert.throws(() => validateBatch({ ...batch(), papers: [{ ...paper, private_note: "PRIVATE" }] }));
});
test("selected candidates persist outside daily window without changing source archives", () => {
  const archive = { papers: [], last_success_at: "2026-09-17T00:00:00Z" }, ledger = { events: [] };
  const result = combineSelections(archive, ledger, [batch()]);
  assert.equal(result.archive.papers.length, 1); assert.equal(archive.papers.length, 0); assert.equal(ledger.events.length, 0);
  assert.equal(result.archive.papers[0].status, "candidate"); assert.equal(result.archive.papers[0].triageScore, 0);
  assert.equal(result.archive.last_success_at, archive.last_success_at);
  assert.equal(result.events.events[0].kind, "selection"); assert.deepEqual(result.events.events[0].selected, [id]);
  assert.deepEqual(combineSelections(archive, ledger, [batch()]), result);
});
test("daily discoveries deduplicate selections, preserve newer metadata and editorial state", () => {
  const previous = { ...paper, title: "Newer title", updated: "2026-09-19T00:00:00Z", firstSeen: "2026-09-19T00:00:00Z", status: "ignored", editorNote: "Do not promote", dateProvenance: "arxiv-api", triageScore: 19, matchedTopics: [{ id: "model" }], routes: ["robotics"] };
  const result = combineSelections({ papers: [previous] }, { events: [] }, [batch()]);
  assert.equal(result.archive.papers.length, 1); const record = result.archive.papers[0];
  assert.equal(record.title, "Newer title"); assert.equal(record.firstSeen, now); assert.equal(record.status, "ignored");
  assert.equal(record.triageScore, 19); assert.equal(record.editorNote, "Do not promote"); assert.deepEqual(record.routes, ["robotics", "wam"]);
  assert.equal(previous.firstSeen, "2026-09-19T00:00:00Z");
});
test("CLI fixture stays private; explicit publication is idempotent and excludes query", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roboopus-paper-search-"));
  try {
    await mkdir(path.join(root, "scripts"));
    for (const file of ["search-papers.mjs", "paper-search-core.mjs", "frontier-archive.mjs"]) await copyFile(new URL(`../scripts/${file}`, import.meta.url), path.join(root, "scripts", file));
    const execute = (...args) => execFileSync(process.execPath, [path.join(root, "scripts/search-papers.mjs"), ...args], { encoding: "utf8", stdio: "pipe" });
    const fixture = path.join(root, "fixture.xml"); await writeFile(fixture, feed);
    const output = execute("run", "--query=PRIVATE_FIXTURE_QUERY", `--input-file=${fixture}`);
    const fixtureId = output.match(/search-[a-f0-9-]{36}/)[0];
    assert(!execute("list").includes("PRIVATE"));
    assert.throws(() => execute("publish", `--run=${fixtureId}`, `--ids=${id}`, "--public"));
    // Mock a successful transport in the isolated test workspace only, never the real public corpus.
    await writeFile(path.join(root, "private-cache/paper-search", `${run.id}.json`), JSON.stringify(run));
    assert(!execute("preview", `--run=${run.id}`, `--ids=${id}`).includes("PRIVATE"));
    assert.throws(() => execute("publish", `--run=${run.id}`, `--ids=${id}`));
    execute("publish", `--run=${run.id}`, `--ids=${id}`, "--public");
    const folder = path.join(root, "content/paper-selections"), files = await readdir(folder);
    assert.equal(files.length, 1); const original = await readFile(path.join(folder, files[0]), "utf8"); assert(!original.includes("PRIVATE"));
    execute("publish", `--run=${run.id}`, `--ids=${id}`, "--public");
    assert.equal((await readdir(folder)).length, 1); assert.equal(await readFile(path.join(folder, files[0]), "utf8"), original);
    assert.throws(() => execute("run", "--query=robot", "--limit=5", "--limit=10"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
