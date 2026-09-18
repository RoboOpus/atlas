import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { newInboxRecord, accessMode, publicUrl, sourceUrl, validateAnnotation, publicProjection, extractMetadata } from "../scripts/inbox-core.mjs";
import { isPublicAddress, resolvePublic, robotsAllows, readPageMetadata } from "../scripts/public-page.mjs";

const request = { url: "https://example.com/article", track: "robotics", intent: "PRIVATE_TEST_INTENT" };
const annotation = { title: "Original note", summary: "Original summary", public_url: request.url, source_author: "", source_published_at: null, checked_at: "2026-09-18", source_type: "website", rights: "original-notes-with-links", claims: [{ kind: "source-statement", text: "Documented claim", evidence_url: request.url }], limitations: ["Not independently reproduced"], tags: ["robotics"] };

test("inbox defaults private, deduplicates exact URLs and discards imported privileged fields", () => {
  const one = newInboxRecord({ ...request, visibility: "public", state: "reviewed", human_reviewed: true, annotation });
  const two = newInboxRecord({ ...request, url: `${request.url}#section` });
  assert.equal(one.visibility, "private"); assert.equal(one.state, "inbox"); assert.equal(one.annotation, null); assert.equal(one.id, two.id);
});
test("social sites and tokenized links always need browser assistance, including subdomains", () => {
  for (const url of ["https://mp.weixin.qq.com/s/test", "https://www.xiaohongshu.com/explore/test", "https://xhslink.com/a/test", "https://example.com/a?access_token=SECRET"]) assert.equal(accessMode(url), "browser-assisted");
  assert.equal(accessMode("https://github.com/RoboOpus/atlas"), "public-metadata");
  for (const key of ["key", "sig", "code", "ticket", "X-Amz-Signature"]) {
    const url = `https://example.com/article?${key}=PRIVATE_VALUE`;
    assert.equal(accessMode(url), "browser-assisted");
    assert.throws(() => publicUrl(url), /credential/);
  }
});
test("local addresses, userinfo, non-HTTPS and custom ports are rejected before networking", () => {
  for (const url of ["file:///C:/secret", "http://example.com/", "https://localhost/", "https://127.1/", "https://2130706433/", "https://[::1]/", "https://foo.internal/", "https://user:password@example.com", "https://example.com:444/", "https://server.local/"]) assert.throws(() => sourceUrl(url));
});
test("DNS blocks private/reserved IPv4 and IPv6, including mixed public/private resolution", async () => {
  for (const value of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "172.31.1.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "203.0.113.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1", "2002:7f00:1::1", "3fff::1"]) assert.equal(isPublicAddress(value), false, value);
  assert.equal(isPublicAddress("1.1.1.1"), true); assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  await assert.rejects(resolvePublic("example.com", async () => [{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }]), /non-public/);
});
test("public export is an allowlist: secrets, metadata and internal history cannot leak", () => {
  const record = newInboxRecord(request);
  record.url = "https://example.com/article?xsec_token=PRIVATE_TOKEN";
  record.metadata = { description: "PRIVATE_META", raw: "PRIVATE_CAPTURE" };
  record.annotation = { ...annotation, private_note: "PRIVATE_EXTRA" };
  record.human_reviewed = true; record.cookies = "PRIVATE_COOKIE";
  const result = publicProjection(record);
  assert.equal(result.human_reviewed, false); assert.equal(result.editorial_state, "source-noted-draft");
  assert(!JSON.stringify(result).includes("PRIVATE_"));
  assert.throws(() => publicUrl("https://example.com/a?xsec_token=secret"), /credential/);
  assert.equal(publicUrl("https://example.com/a?id=123&utm_source=foo"), "https://example.com/a?id=123");
});
test("notes require original text rights, claims, limitations and valid dates", () => {
  assert.deepEqual(validateAnnotation(annotation).claims, annotation.claims);
  for (const changes of [{ rights: "copied" }, { claims: [] }, { limitations: [] }, { checked_at: "2026-02-30" }, { source_type: "unknown" }, { claims: [{ kind: "fact", text: "unsupported", evidence_url: request.url }] }]) assert.throws(() => validateAnnotation({ ...annotation, ...changes }));
});
test("metadata parser handles attribute order and entities, never executes script instructions", () => {
  const html = `<title>Fallback</title><script><meta name="description" content="PRIVATE_INJECTION"></script><meta content="Robot &amp; control" property="og:title"><meta content='Description &quot;safe&quot;' name='description'><meta name="robots" content="noindex">`;
  const result = extractMetadata(html, request.url);
  assert.equal(result.title, "Robot & control"); assert.equal(result.description, 'Description "safe"'); assert.equal(result.noindex, true);
  assert(!JSON.stringify(result).includes("INJECTION"));
});
test("robots matching respects disallow, longer allow, wildcard end and specific bot groups", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$";
  assert.equal(robotsAllows(robots, "https://example.com/private/a"), false);
  assert.equal(robotsAllows(robots, "https://example.com/private/public/a"), true);
  assert.equal(robotsAllows(robots, "https://example.com/doc.pdf"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nUser-agent: RoboOpusAtlas\nAllow: /", request.url), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /\nUser-agent: Googlebot\nAllow: /", request.url), false);
});
test("metadata reader checks robots, rechecks redirect origin and never fetches social destination", async () => {
  const seen = [];
  const transport = async (url) => {
    seen.push(url);
    if (url.endsWith("/robots.txt")) return { status: 404, headers: {}, body: "" };
    if (url === request.url) return { status: 302, headers: { location: "https://second.example.com/final" }, body: "" };
    return { status: 200, headers: { "content-type": "text/html" }, body: "<title>Final</title>" };
  };
  assert.equal((await readPageMetadata(request.url, transport)).title, "Final");
  assert.deepEqual(seen, ["https://example.com/robots.txt", request.url, "https://second.example.com/robots.txt", "https://second.example.com/final"]);
  let calls = 0;
  await assert.rejects(readPageMetadata("https://mp.weixin.qq.com/s/test", async () => { calls++; }), /assistance/);
  assert.equal(calls, 0);
});
test("robots failure, explicit blocks, noindex and non-HTML cannot become successful metadata", async () => {
  await assert.rejects(readPageMetadata(request.url, async () => ({ status: 503, headers: {}, body: "" })), /Robots/);
  await assert.rejects(readPageMetadata(request.url, async () => ({ status: 200, headers: {}, body: "User-agent: *\nDisallow: /" })), /disallows/);
  for (const response of [{ status: 200, headers: { "content-type": "application/pdf" }, body: "pdf" }, { status: 200, headers: { "content-type": "text/html", "x-robots-tag": "noindex" }, body: "<title>No</title>" }]) {
    await assert.rejects(readPageMetadata(request.url, async (url) => url.endsWith("/robots.txt") ? { status: 404, body: "", headers: {} } : response));
  }
});
test("static intake has no HTML form action that could submit private fields when JS fails", async () => {
  const html = await readFile(new URL("../site/inbox/index.html", import.meta.url), "utf8");
  const js = await readFile(new URL("../site/inbox/inbox.js", import.meta.url), "utf8");
  assert(!/<form\b/i.test(html)); assert(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage/.test(js));
  assert.match(html, /id="download-request" type="button" disabled/);
});

test("CLI import → annotate → preview → explicit export, with no accidental overwrite", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "roboopus-inbox-test-"));
  try {
    await mkdir(path.join(root, "scripts"));
    for (const file of ["inbox.mjs", "inbox-core.mjs", "public-page.mjs"]) await copyFile(new URL(`../scripts/${file}`, import.meta.url), path.join(root, "scripts", file));
    const input = path.join(root, "request.json"), noteFile = path.join(root, "note.json");
    await writeFile(input, JSON.stringify({ ...request, visibility: "public" }));
    await writeFile(noteFile, JSON.stringify(annotation));
    const run = (...args) => execFileSync(process.execPath, [path.join(root, "scripts/inbox.mjs"), ...args], { cwd: root, encoding: "utf8", stdio: "pipe" });
    const id = newInboxRecord(request).id;
    run("import", `--file=${input}`);
    const localFile = path.join(root, "private-cache/inbox", `${id}.json`);
    const before = await readFile(localFile, "utf8");
    run("import", `--file=${input}`);
    assert.equal(await readFile(localFile, "utf8"), before);
    run("annotate", `--id=${id}`, `--file=${noteFile}`);
    const preview = JSON.parse(run("preview", `--id=${id}`));
    assert.equal(preview.summary, annotation.summary); assert.equal(preview.human_reviewed, false);
    assert(!JSON.stringify(preview).includes("PRIVATE_TEST_INTENT"));
    assert.throws(() => run("publish", `--id=${id}`));
    run("publish", `--id=${id}`, "--public");
    const publicFile = path.join(root, "content/reading-notes", `${id}.json`);
    const exported = await readFile(publicFile, "utf8");
    assert.equal(JSON.parse(exported).editorial_state, "source-noted-draft");
    assert.throws(() => run("publish", `--id=${id}`, "--public"));
    assert.equal(await readFile(publicFile, "utf8"), exported);
  } finally { await rm(root, { recursive: true, force: true }); }
});
