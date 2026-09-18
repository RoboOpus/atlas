import { createHash } from "node:crypto";
import { mergeObservation } from "./frontier-archive.mjs";
export const endpoint = "https://export.arxiv.org/api/query";
const routes = ["frontier", "wam", "robotics", "hardware", "adjacent"];
const idPattern = /^\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}$/;
const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function searchRequest(input) {
  if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 1000 || /[\x00-\x1f]/.test(input.query)) throw new Error("Provide a nonempty arXiv query up to 1000 characters");
  const track = input.track ?? "frontier", limit = Number(input.limit ?? 10), start = Number(input.start ?? 0), sort = input.sort ?? "relevance";
  if (!routes.includes(track)) throw new Error("Choose a public research track; private Lab queries are not supported");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(start) || start < 0 || start > 1000) throw new Error("Limit must be 1–100; start must be 0–1000");
  if (!["relevance", "submittedDate", "lastUpdatedDate"].includes(sort)) throw new Error("Unsupported sort order");
  const since = input.since ?? null, until = input.until ?? null;
  if ((since !== null && !date(since)) || (until !== null && !date(until)) || (since && until && since > until)) throw new Error("Use valid ascending YYYY-MM-DD date bounds");
  const query = input.query.trim();
  const effectiveQuery = since || until ? `(${query}) AND submittedDate:[${(since ?? "1991-01-01").replaceAll("-", "")}0000 TO ${(until ?? "2099-12-31").replaceAll("-", "")}2359]` : query;
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ search_query: effectiveQuery, start: String(start), max_results: String(limit), sortBy: sort, sortOrder: "descending" }).toString();
  return { query, effective_query: effectiveQuery, track, limit, start, sort, since, until, url: url.href };
}
function decode(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-f]+|\d+);/gi, (entity) => {
    const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const n = entity.toLowerCase().startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
}
const text = (value) => decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (xml, name) => text(xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
const attr = (xml, name) => decode(xml.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");
export function parseSearchFeed(xml) {
  if (typeof xml !== "string" || xml.length > 4 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Invalid or oversized Atom response");
  xml = xml.replace(/<!--[\s\S]*?-->/g, "");
  if (!/<feed\b/.test(xml) || !/<\/feed>/.test(xml)) throw new Error("Expected complete arXiv Atom feed");
  const rawTotal = tag(xml, "opensearch:totalResults"), total = /^\d+$/.test(rawTotal) ? Number(rawTotal) : null;
  const papers = [], seen = new Set();
  for (const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const entry = match[1], rawId = tag(entry, "id");
    if (/api\/errors|#incorrect|#invalid/i.test(rawId)) throw new Error("arXiv returned an API error entry; check the query syntax");
    const identity = rawId.match(/^https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)?$/);
    if (!identity || !idPattern.test(identity[1])) throw new Error("Invalid or unsupported paper ID in response (modern arXiv IDs required)");
    const id = identity[1]; if (seen.has(id)) throw new Error("Duplicate identity in response"); seen.add(id);
    const categories = [...entry.matchAll(/<category\b([^>]*)>/gi)].map((item) => attr(item[1], "term")).filter(Boolean);
    papers.push(validatePaper({ id, title: tag(entry, "title"), authors: [...entry.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/gi)].map((item) => tag(item[1], "name")),
      abstract: tag(entry, "summary"), published: tag(entry, "published"), updated: tag(entry, "updated"), categories,
      primaryCategory: attr(entry.match(/<arxiv:primary_category\b([^>]*)>/i)?.[1] ?? "", "term") || categories[0],
      url: `https://arxiv.org/abs/${id}${identity[2] ?? ""}`, pdfUrl: `https://arxiv.org/pdf/${id}${identity[2] ?? ""}` }));
  }
  if ([...xml.matchAll(/<entry\b/gi)].length !== papers.length) throw new Error("Incomplete Atom entry");
  if (total === null || total < papers.length) throw new Error("Missing or inconsistent result count");
  return { total, papers };
}
export function validatePaper(paper) {
  if (!idPattern.test(paper.id)) throw new Error("Invalid modern arXiv ID");
  for (const [field, max] of [["title", 1000], ["abstract", 20000]]) if (typeof paper[field] !== "string" || !paper[field].trim() || paper[field].length > max) throw new Error(`Invalid paper ${field}`);
  if (!Array.isArray(paper.authors) || !paper.authors.length || paper.authors.length > 3000 || paper.authors.some((author) => typeof author !== "string" || !author.trim() || author.length > 300)) throw new Error("Invalid authors");
  if (!Array.isArray(paper.categories) || !paper.categories.length || paper.categories.some((item) => typeof item !== "string" || !/^[A-Za-z0-9.-]+$/.test(item)) || !paper.categories.includes(paper.primaryCategory)) throw new Error("Invalid categories");
  for (const field of ["published", "updated"]) if (typeof paper[field] !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(paper[field]) || !Number.isFinite(Date.parse(paper[field]))) throw new Error(`Invalid ${field}`);
  if (Date.parse(paper.updated) < Date.parse(paper.published)) throw new Error("Version date precedes publication");
  for (const [field, route] of [["url", "abs"], ["pdfUrl", "pdf"]]) {
    if (typeof paper[field] !== "string" || !new RegExp(`^https://arxiv\\.org/${route}/${paper.id.replace(".", "\\.")}(v[1-9]\\d*)?$`).test(paper[field])) throw new Error("Unsafe or mismatched paper link");
  }
  return Object.fromEntries(["id", "title", "authors", "abstract", "published", "updated", "primaryCategory", "categories", "url", "pdfUrl"].map((key) => [key, paper[key]]));
}
export async function requestPapers(request, fetcher = fetch) {
  // Single page only; callers must serialize requests. No unrelated RSS fallback.
  const response = await fetcher(searchRequest(request).url, { headers: { Accept: "application/atom+xml", "User-Agent": "RoboOpus-Atlas/0.3 (+https://github.com/RoboOpus/atlas)" }, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`arXiv HTTP ${response.status}; no fallback was substituted`);
  if (!/(?:atom\+xml|application\/xml|text\/xml)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Expected XML content type");
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("Atom response too large"); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const value of chunks) { bytes.set(value, offset); offset += value.byteLength; }
  return parseSearchFeed(new TextDecoder().decode(bytes));
}
export function selectedBatch(run, ids, batchId, now) {
  if (run.state !== "success" || run.source_mode !== "arxiv-api") throw new Error("Only successful real API runs can be published; fixtures and failed/empty runs cannot");
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length) throw new Error("Explicitly select 1–100 unique returned IDs");
  const track = run.request.track;
  if (!routes.includes(track)) throw new Error("Invalid research track");
  const papers = ids.map((id) => { const paper = run.papers.find((item) => item.id === id); if (!paper) throw new Error(`ID not in this run: ${id}`); return validatePaper(paper); });
  // Public projection has no query, intent, local path, raw response or private run identifier.
  return validateBatch({ schema_version: "1.0.0", id: batchId, published_at: now, track, source: "arxiv-api", stage: "candidate", papers });
}
export function validateBatch(batch) {
  const allowed = ["schema_version", "id", "published_at", "track", "source", "stage", "papers"];
  if (Object.keys(batch).some((key) => !allowed.includes(key)) || batch.schema_version !== "1.0.0" || !/^selection-[a-f0-9-]{36}$/.test(batch.id) || !routes.includes(batch.track) || batch.source !== "arxiv-api" || batch.stage !== "candidate" || !Number.isFinite(Date.parse(batch.published_at))) throw new Error("Invalid public selection batch");
  if (!Array.isArray(batch.papers) || !batch.papers.length || batch.papers.length > 100) throw new Error("Invalid selection size");
  const publicFields = new Set(["id", "title", "authors", "abstract", "published", "updated", "primaryCategory", "categories", "url", "pdfUrl"]);
  if (batch.papers.some((paper) => Object.keys(paper).some((key) => !publicFields.has(key)))) throw new Error("Unexpected/private field in public selected paper");
  const papers = batch.papers.map(validatePaper);
  if (new Set(papers.map((item) => item.id)).size !== papers.length) throw new Error("Duplicate selected paper");
  return { ...batch, papers };
}
export function combineSelections(archive, ledger, batches) {
  const records = new Map(archive.papers.map((item) => [item.id, { ...item }]));
  const events = [...ledger.events]; const seen = new Set(events.map((event) => event.id));
  for (const batch of [...batches].map(validateBatch).sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id.localeCompare(b.id))) {
    if (seen.has(batch.id)) throw new Error("Duplicate selection event"); seen.add(batch.id);
    for (const paper of batch.papers) {
      const previous = records.get(paper.id);
      const incoming = { ...paper, metadataCompleteness: "abstract", dateProvenance: "arxiv-api", firstSeen: batch.published_at, status: "candidate", triageScore: 0, matchedTopics: [], routes: [batch.track] };
      const merged = mergeObservation(previous, incoming);
      // Selection adds an explicit route, never a ranking bonus or editorial-status promotion.
      merged.routes = [...new Set([...(previous?.routes ?? []), batch.track])];
      merged.triageScore = previous?.triageScore ?? 0; merged.matchedTopics = previous?.matchedTopics ?? [];
      if (previous && Date.parse(batch.published_at) < Date.parse(previous.firstSeen)) merged.firstSeen = batch.published_at;
      records.set(paper.id, merged);
    }
    events.push({ id: batch.id, at: batch.published_at, kind: "selection", added: [], updated: [], selected: batch.papers.map((paper) => paper.id), note: "按需检索后显式选入候选库；可与每日雷达重复，不代表新发表、人工评审或独立复现。检索词保持私密。" });
  }
  return { archive: { ...archive, papers: [...records.values()].sort((a, b) => a.id.localeCompare(b.id)) }, events: { ...ledger, events: events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)) } };
}
export const paperFingerprint = (paper) => createHash("sha256").update(JSON.stringify(validatePaper(paper))).digest("hex");
