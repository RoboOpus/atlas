import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const tracks = ["wam", "frontier", "robotics", "hardware", "adjacent", "lab"];
const sensitiveKey = /token|password|passwd|secret|session|cookie|auth|api.?key|signature|credential|^(?:key|sig|code|ticket)$/i;
export function sourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Only HTTPS public links without credentials or custom ports are supported.");
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host) || host.endsWith(".")) throw new Error("Local, IP-literal and internal hosts are not accepted.");
  url.hash = "";
  return url;
}
export function publicUrl(value) {
  const url = sourceUrl(value);
  for (const key of url.searchParams.keys()) if (sensitiveKey.test(key)) throw new Error("Public URL contains a potential credential. Supply a clean public permalink.");
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:spm|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function accessMode(value) {
  const url = sourceUrl(value);
  if (/(^|\.)(?:weixin\.qq\.com|xiaohongshu\.com|xhslink\.com)$/.test(url.hostname)) return "browser-assisted";
  if ([...url.searchParams.keys()].some((key) => sensitiveKey.test(key))) return "browser-assisted";
  return "public-metadata";
}
export function recordId(value) { return `url-${createHash("sha256").update(sourceUrl(value).href).digest("hex").slice(0, 20)}`; }
export function newInboxRecord(request, now = new Date().toISOString()) {
  if (request.schema_version !== undefined && request.schema_version !== "1.0.0") throw new Error("Unsupported inbox request version");
  const url = sourceUrl(request.url).href;
  if (!tracks.includes(request.track)) throw new Error("Choose one of the six knowledge tracks");
  if (typeof request.intent !== "string" || request.intent.length > 2000) throw new Error("Intent must be text up to 2000 characters");
  return { schema_version: "1.0.0", id: recordId(url), url, track: request.track, intent: request.intent, visibility: "private", state: "inbox", access_mode: accessMode(url), created_at: now, updated_at: now, metadata: null, annotation: null, history: [{ at: now, action: "created" }] };
}

const text = (value, field, max, required = true) => {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) throw new Error(`Invalid ${field}: expected ${required ? "nonempty " : ""}text up to ${max} characters`);
  return value.trim();
};
export function validateAnnotation(value) {
  if (value.rights !== "original-notes-with-links") throw new Error("Only original notes with links may be published; no copied articles or raw captures.");
  const result = {
    title: text(value.title, "title", 200), summary: text(value.summary, "summary", 1600),
    public_url: publicUrl(value.public_url), source_author: text(value.source_author, "source_author", 200, false),
    source_published_at: value.source_published_at ?? null, checked_at: value.checked_at,
    source_type: value.source_type, rights: value.rights,
    claims: [], limitations: [], tags: []
  };
  if (!["website", "blog", "interview", "repository", "paper", "wechat", "xiaohongshu"].includes(result.source_type)) throw new Error("Unknown source type");
  for (const key of ["checked_at", "source_published_at"]) {
    if (key === "source_published_at" && result[key] === null) continue;
    if (typeof result[key] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || new Date(result[key]).toISOString().slice(0, 10) !== result[key]) throw new Error(`Invalid ${key}`);
  }
  if (!Array.isArray(value.claims) || !value.claims.length || value.claims.length > 12) throw new Error("Provide 1–12 evidence-linked claims");
  for (const claim of value.claims) {
    if (!["source-statement", "editor-inference", "community-opinion"].includes(claim.kind)) throw new Error("Claim must distinguish source statement, inference or opinion");
    result.claims.push({ kind: claim.kind, text: text(claim.text, "claim", 900), evidence_url: publicUrl(claim.evidence_url) });
  }
  if (!Array.isArray(value.limitations) || !value.limitations.length || value.limitations.length > 12) throw new Error("State at least one limitation / unanswered question");
  result.limitations = value.limitations.map((item) => text(item, "limitation", 700));
  if (!Array.isArray(value.tags) || value.tags.length > 12) throw new Error("Use at most 12 tags");
  result.tags = value.tags.map((item) => text(item, "tag", 60));
  return result;
}
export function publicProjection(record, now = new Date().toISOString()) {
  const annotation = validateAnnotation(record.annotation);
  if (!tracks.includes(record.track) || !/^url-[a-f0-9]{20}$/.test(record.id)) throw new Error("Invalid inbox identity");
  // Explicit allowlist: never spread the private record, raw URL, metadata or intent.
  return { schema_version: "1.0.0", id: record.id, track: record.track, ...annotation,
    editorial_state: "source-noted-draft", human_reviewed: false, published_at: now,
    provenance: "Single-link intake; original source-backed notes. Publication selection is not human scientific review." };
}

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|\d+);/gi, (entity) => {
    const named = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
    if (entity.toLowerCase() in named) return named[entity.toLowerCase()];
    const code = entity.toLowerCase().startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}
export function extractMetadata(html, url) {
  // Only declarative metadata. Never evaluate scripts or treat page instructions as actions.
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const metas = new Map();
  for (const match of clean.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map((item) => [item[1].toLowerCase(), decode(item[2] ?? item[3] ?? item[4])]));
    if ((attrs.name || attrs.property) && attrs.content) metas.set((attrs.name || attrs.property).toLowerCase(), attrs.content);
  }
  const tidy = (value, max) => decode(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return { url, title: tidy(metas.get("og:title") ?? clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 300),
    description: tidy(metas.get("description") ?? metas.get("og:description"), 1200),
    author: tidy(metas.get("author") ?? metas.get("citation_author"), 300),
    declared_date: tidy(metas.get("article:published_time") ?? metas.get("citation_publication_date"), 100),
    evidence: "untrusted-page-metadata", noindex: /noindex|none/i.test(metas.get("robots") ?? "") };
}
