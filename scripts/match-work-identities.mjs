import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US");
}

export function normalizeTitle(title) {
  return fold(title)
    .replaceAll("π", " pi ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    // Query values and path case can identify different papers. Only known trackers are disposable.
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeIdentifier(kind, value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let normalized = value.trim();
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      if (url.username || url.password || url.port) return null;
      if (kind === "arxiv" && /^(?:www\.|export\.)?arxiv\.org$/.test(url.hostname) && /^\/(abs|pdf)\//.test(url.pathname)) normalized = decodeURIComponent(url.pathname.replace(/^\/(abs|pdf)\//, ""));
      else if (kind === "doi" && /^(?:dx\.)?doi\.org$/.test(url.hostname)) normalized = decodeURIComponent(url.pathname.slice(1));
      else if (kind === "openreview" && /^(?:www\.)?openreview\.net$/.test(url.hostname) && /^\/(forum|pdf)\/?$/.test(url.pathname)) {
        const ids = new Set(url.searchParams.getAll("id"));
        if (ids.size !== 1) return null;
        normalized = [...ids][0];
      } else return null;
    } catch { return null; }
  }
  if (kind === "arxiv") {
    normalized = normalized.replace(/^arxiv:\s*/i, "").replace(/\.pdf$/, "");
    if (!/^(?:\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{2}(?:0[1-9]|1[0-2])\d{3})(?:v[1-9]\d*)?$/.test(normalized)) return null;
    return normalized.replace(/v\d+$/, "");
  }
  if (kind === "doi") {
    normalized = normalized.replace(/^doi:\s*/i, "").toLowerCase();
    return /^10\.\d{4,9}\/\S+$/.test(normalized) ? normalized : null;
  }
  // OpenReview IDs are opaque: do not lowercase or Unicode-fold them.
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : null;
}

function identifierMap(item) {
  const source = item.identifiers ?? {};
  const values = { arxiv: new Set(), doi: new Set(), openreview: new Set() }, invalid = new Set();
  for (const kind of Object.keys(values)) {
    for (const value of [source[kind], item[kind]]) {
      if (value === null || value === undefined || value === "") continue;
      const id = normalizeIdentifier(kind, value);
      if (id) values[kind].add(id); else invalid.add(kind);
    }
  }
  const urls = [item.canonical_url, item.url, item.official_paper, item.venue_publication, item.links?.official_paper, item.links?.venue_publication];
  for (const url of urls) for (const kind of Object.keys(values)) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    const id = normalizeIdentifier(kind, url);
    if (id) values[kind].add(id);
    else {
      try {
        const parsed = new URL(url);
        const expected = kind === "arxiv" ? /^(?:www\.|export\.)?arxiv\.org$/.test(parsed.hostname) && /^\/(abs|pdf)\//.test(parsed.pathname)
          : kind === "doi" ? /^(?:dx\.)?doi\.org$/.test(parsed.hostname)
          : /^(?:www\.)?openreview\.net$/.test(parsed.hostname) && /^\/(forum|pdf)\/?$/.test(parsed.pathname);
        if (expected) invalid.add(kind);
      } catch { /* Malformed general URLs are not identity evidence. */ }
    }
  }
  return { values, invalid };
}

function officialUrls(item) {
  const values = [item.canonical_url, item.url, item.project, item.code, item.model, item.venue_publication, item.official_paper, ...Object.values(item.links ?? {})];
  return new Set(values.map(normalizeUrl).filter(Boolean));
}

function tokenSet(value) {
  return new Set(normalizeTitle(value).split(" ").filter(Boolean));
}

export function titleSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function normalizedAuthors(item) {
  const authors = item.lead_authors ?? item.authors ?? [];
  return authors.map((author) => normalizeTitle(author?.name ?? author)).filter(Boolean);
}

function authorsOverlap(candidate, work) {
  const candidateAuthors = normalizedAuthors(candidate);
  const workAuthors = normalizedAuthors(work);
  return candidateAuthors.some((left) => workAuthors.some((right) => {
    if (left === right) return true;
    const leftSurname = left.split(" ").at(-1);
    const rightSurname = right.split(" ").at(-1);
    return leftSurname.length >= 4 && leftSurname === rightSurname;
  }));
}

export function evaluateCandidate(candidate, work) {
  const candidateIdentifiers = identifierMap(candidate);
  const workIdentifiers = identifierMap(work);
  const kinds = Object.keys(candidateIdentifiers.values);
  const exactIdentifierKinds = kinds.filter((kind) => [...candidateIdentifiers.values[kind]].some((id) => workIdentifiers.values[kind].has(id)));
  const conflictingKinds = kinds.filter((kind) => {
    const left = candidateIdentifiers.values[kind], right = workIdentifiers.values[kind];
    return left.size > 1 || right.size > 1 || (left.size && right.size && ![...left].some((id) => right.has(id)));
  });
  const invalidKinds = [...new Set([...candidateIdentifiers.invalid, ...workIdentifiers.invalid])];
  const candidateUrls = officialUrls(candidate);
  const workUrls = officialUrls(work);
  const exactOfficialUrl = [...candidateUrls].find((url) => workUrls.has(url)) ?? null;
  const similarity = titleSimilarity(candidate.title, work.title);
  const authorOverlap = authorsOverlap(candidate, work);
  const year = (item) => { const value = String(item.year ?? item.published ?? "").slice(0, 4); return /^\d{4}$/.test(value) ? Number(value) : null; };
  const candidateYear = year(candidate), workYear = year(work);
  const yearDelta = candidateYear !== null && workYear !== null ? Math.abs(candidateYear - workYear) : null;

  let decision = "unmatched";
  if (exactIdentifierKinds.length) decision = conflictingKinds.length || invalidKinds.length ? "review" : "auto-link";
  else if (exactOfficialUrl) decision = "review"; // A repository, model or project may serve multiple papers.
  else if (similarity >= 0.85 && authorOverlap && yearDelta !== null && yearDelta <= 1) decision = "review";

  return {
    work_id: work.id,
    decision,
    evidence: {
      exact_identifier_kinds: exactIdentifierKinds,
      conflicting_identifier_kinds: conflictingKinds,
      invalid_identifier_kinds: invalidKinds,
      exact_official_url: exactOfficialUrl,
      title_similarity: Number(similarity.toFixed(4)),
      author_overlap: authorOverlap,
      year_delta: yearDelta
    }
  };
}

const decisionRank = { unmatched: 0, review: 1, "auto-link": 2 };

export function matchCandidate(candidate, works) {
  const matches = works.map((work) => evaluateCandidate(candidate, work));
  matches.sort((left, right) => decisionRank[right.decision] - decisionRank[left.decision]
    || right.evidence.exact_identifier_kinds.length - left.evidence.exact_identifier_kinds.length
    || Number(Boolean(right.evidence.exact_official_url)) - Number(Boolean(left.evidence.exact_official_url))
    || right.evidence.title_similarity - left.evidence.title_similarity
    || left.work_id.localeCompare(right.work_id));
  const best = matches[0] ?? { work_id: null, decision: "unmatched", evidence: {} };
  const plausible = matches.filter((match) => match.decision !== "unmatched");
  const automatic = plausible.filter((match) => match.decision === "auto-link");
  // Never choose one of several exact identities or contradicted identity matches by sort order.
  const identityConflict = plausible.some((match) => match.evidence.exact_identifier_kinds.length && (match.evidence.conflicting_identifier_kinds.length || match.evidence.invalid_identifier_kinds.length));
  const ambiguous = automatic.length > 1 || (!automatic.length && plausible.length > 1) || identityConflict;
  const decision = ambiguous ? "review" : best.decision;
  return {
    candidate_id: candidate.id ?? null,
    ...best,
    decision,
    work_id: decision === "auto-link" ? best.work_id : null,
    requires_review: decision === "review",
    ambiguous,
    alternatives: plausible
  };
}

async function runCli() {
  const [candidateFile, registryFile] = process.argv.slice(2);
  if (!candidateFile || !registryFile) throw new Error("Usage: node scripts/match-work-identities.mjs <candidates.json> <work-identities.json>");
  const candidateData = JSON.parse(await readFile(path.resolve(candidateFile), "utf8"));
  const registry = JSON.parse(await readFile(path.resolve(registryFile), "utf8"));
  const candidates = Array.isArray(candidateData) ? candidateData : candidateData.candidates ?? candidateData.papers ?? candidateData.works ?? [];
  const matches = candidates.map((candidate) => matchCandidate(candidate, registry.works ?? []));
  process.stdout.write(`${JSON.stringify({ schema_version: "0.2.0", matches }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
