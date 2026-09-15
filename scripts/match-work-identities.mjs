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
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeIdentifier(kind, value) {
  if (!value) return null;
  let normalized = fold(value).trim();
  if (kind === "arxiv") {
    normalized = normalized.replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//, "").replace(/\.pdf$/, "").replace(/v\d+$/, "");
  }
  if (kind === "doi") normalized = normalized.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
  if (kind === "openreview") normalized = normalized.replace(/^https?:\/\/(?:www\.)?openreview\.net\/(?:forum|pdf)\?id=/, "");
  return normalized || null;
}

function identifierMap(item) {
  const source = item.identifiers ?? {};
  return {
    arxiv: normalizeIdentifier("arxiv", source.arxiv ?? item.arxiv),
    doi: normalizeIdentifier("doi", source.doi ?? item.doi),
    openreview: normalizeIdentifier("openreview", source.openreview ?? item.openreview)
  };
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
  const exactIdentifierKinds = Object.keys(candidateIdentifiers).filter((kind) => candidateIdentifiers[kind] && candidateIdentifiers[kind] === workIdentifiers[kind]);
  const candidateUrls = officialUrls(candidate);
  const workUrls = officialUrls(work);
  const exactOfficialUrl = [...candidateUrls].find((url) => workUrls.has(url)) ?? null;
  const similarity = titleSimilarity(candidate.title, work.title);
  const authorOverlap = authorsOverlap(candidate, work);
  const candidateYear = Number(candidate.year ?? String(candidate.published ?? "").slice(0, 4));
  const yearDelta = Number.isInteger(candidateYear) && Number.isInteger(work.year) ? Math.abs(candidateYear - work.year) : null;

  let decision = "unmatched";
  if (exactIdentifierKinds.length || exactOfficialUrl) decision = "auto-link";
  else if (similarity >= 0.85 && authorOverlap && yearDelta !== null && yearDelta <= 1) decision = "review";

  return {
    work_id: work.id,
    decision,
    evidence: {
      exact_identifier_kinds: exactIdentifierKinds,
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
  return {
    candidate_id: candidate.id ?? null,
    ...best,
    work_id: best.decision === "unmatched" ? null : best.work_id
  };
}

async function runCli() {
  const [candidateFile, registryFile] = process.argv.slice(2);
  if (!candidateFile || !registryFile) throw new Error("Usage: node scripts/match-work-identities.mjs <candidates.json> <work-identities.json>");
  const candidateData = JSON.parse(await readFile(path.resolve(candidateFile), "utf8"));
  const registry = JSON.parse(await readFile(path.resolve(registryFile), "utf8"));
  const candidates = Array.isArray(candidateData) ? candidateData : candidateData.candidates ?? candidateData.papers ?? candidateData.works ?? [];
  const matches = candidates.map((candidate) => matchCandidate(candidate, registry.works ?? []));
  process.stdout.write(`${JSON.stringify({ schema_version: "0.1.0", matches }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
