import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnnotation, tracks } from "./inbox-core.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(repo, "content/reading-notes");
await mkdir(input, { recursive: true });
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const notes = [];
const labels = { "source-statement": "来源陈述", "editor-inference": "编辑推断 · 待验证", "community-opinion": "社区观点 · 非证实事实" };
for (const file of (await readdir(input)).filter((name) => name.endsWith(".json")).sort()) {
  const source = JSON.parse(await readFile(path.join(input, file), "utf8"));
  const annotation = validateAnnotation(source);
  const allowed = new Set(["schema_version", "id", "track", ...Object.keys(annotation), "editorial_state", "human_reviewed", "published_at", "provenance"]);
  if (Object.keys(source).some((key) => !allowed.has(key))) throw new Error(`Unexpected/private field in public reading note: ${file}`);
  if (!/^url-[a-f0-9]{20}$/.test(source.id) || file !== `${source.id}.json` || !tracks.includes(source.track)) throw new Error(`Invalid note identity: ${file}`);
  if (source.editorial_state !== "source-noted-draft" || source.human_reviewed !== false) throw new Error(`Intake cannot grant reviewed status: ${file}`);
  const note = { ...source, ...annotation, url: `/atlas/reading/${source.id}/` };
  notes.push(note);
  const body = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(note.title)} · RoboOpus Atlas</title><meta name="description" content="${escape(note.summary)}"><link rel="canonical" href="https://roboopus.github.io${note.url}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(note.title)}"><meta property="og:description" content="${escape(note.summary)}"><meta property="og:url" content="https://roboopus.github.io${note.url}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(note.title)}"><meta name="twitter:description" content="${escape(note.summary)}"><link rel="stylesheet" href="/atlas/styles.css"><link rel="stylesheet" href="/atlas/search/search.css"></head><body>
<header class="topbar"><a class="wordmark" href="/atlas/"><span class="mark">R/O</span><span>Atlas / Reading note</span></a><nav aria-label="主导航"><a href="/atlas/reading/">来源笔记</a><a href="/atlas/search/">统一检索</a><a href="/atlas/inbox/">收录链接</a></nav></header>
<main class="discovery-main"><section class="discovery-intro"><p class="eyebrow">${escape(note.track)} · Source-noted draft</p><h1>${escape(note.title)}</h1><p class="lede">${escape(note.summary)}</p><p class="evidence-label">原创来源笔记 · 未经人工终审 · 不代表独立复现</p><p class="scope-note">核对日期 ${escape(note.checked_at)} · 原文作者 ${escape(note.source_author || "未确认")} · 原文日期 ${escape(note.source_published_at ?? "未确认")}</p><a href="${escape(note.public_url)}" target="_blank" rel="noreferrer">打开原始来源 ↗</a></section>
<section class="maintenance-section"><h2>主张与证据</h2>${note.claims.map((claim) => `<article class="search-result"><p class="evidence-label">${labels[claim.kind]}</p><p class="result-summary">${escape(claim.text)}</p><p><a href="${escape(claim.evidence_url)}" target="_blank" rel="noreferrer">回查证据 ↗</a></p></article>`).join("")}</section>
<section class="maintenance-section"><h2>边界与待验证项</h2><ul>${note.limitations.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></section></main><footer><p>RoboOpus Atlas · 原创笔记，不转载全文</p><p><a href="/atlas/data/reading-notes.json">机器可读来源笔记</a></p></footer></body></html>`;
  const folder = path.join(repo, "site/reading", source.id);
  await mkdir(folder, { recursive: true }); await writeFile(path.join(folder, "index.html"), body + "\n");
}
await writeFile(path.join(repo, "site/data/reading-notes.json"), JSON.stringify({ schema_version: "1.0.0", notes }, null, 2) + "\n");
console.log(`Built ${notes.length} original source notes; private inbox is excluded.`);
