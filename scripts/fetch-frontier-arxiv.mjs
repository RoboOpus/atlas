import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = resolve(process.cwd(), "config", "frontier-arxiv.json");
const OUTPUT_PATH = resolve(process.cwd(), "site", "data", "frontier-papers.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const endpoint = config.endpoint;
const fallbackFeed = config.fallback_feed;
const maxResults = readNumberArgument("--max-results", config.max_results);
const poolLimit = readNumberArgument("--pool-limit", config.pool_limit);
const minTriageScore = readNumberArgument("--min-triage-score", config.min_triage_score);
const fetchAttempts = readNumberArgument("--fetch-attempts", 4);
const inputFile = readStringArgument("--input-file", "");
const dryRun = process.argv.includes("--dry-run");
const retryableStatus = new Set([408, 425, 429]);

function readNumberArgument(name, fallback) {
  const prefix = `${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) return fallback;
  const parsed = Number(argument.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function readStringArgument(name, fallback) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function decodeXml(value) {
  const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" };
  return value
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => named[entity])
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalizeText(value = "") {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1_000, 30_000);
  return Math.max(3_000, Math.min(5_000 * 2 ** (attempt - 1), 30_000));
}

async function fetchFeed(url) {
  let lastError;
  for (let attempt = 1; attempt <= fetchAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/atom+xml",
          "User-Agent": "RoboOpus-Atlas/0.2 (https://github.com/RoboOpus/atlas)"
        },
        signal: AbortSignal.timeout(45_000)
      });
    } catch (error) {
      lastError = error;
    }

    if (response?.ok) return response.text();
    if (response) {
      const retryable = retryableStatus.has(response.status) || response.status >= 500;
      const error = new Error(`arXiv API returned ${response.status} ${response.statusText}.`);
      if (!retryable) throw error;
      lastError = error;
    }
    if (attempt === fetchAttempts) break;
    const delay = retryDelay(response, attempt);
    console.warn(`arXiv request ${attempt}/${fetchAttempts} failed; retrying in ${delay / 1_000}s.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
  throw new Error(`arXiv request failed after ${fetchAttempts} attempts: ${lastError?.message ?? "unknown error"}`);
}

function tag(entry, name) {
  const match = entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return normalizeText(match?.[1] ?? "");
}

function attribute(fragment, name) {
  const match = fragment.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function parseEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((match) => {
    const entry = match[1];
    const idUrl = tag(entry, "id").replace("http://", "https://");
    const id = idUrl.replace(/^https:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const authors = [...entry.matchAll(/<author>([\s\S]*?)<\/author>/gi)]
      .map((author) => tag(author[1], "name"))
      .filter(Boolean);
    const categories = [...entry.matchAll(/<category\b([^>]*)\/?\s*>/gi)]
      .map((category) => attribute(category[1], "term"))
      .filter(Boolean);
    const links = [...entry.matchAll(/<link\b([^>]*)\/?\s*>/gi)].map((link) => ({
      href: attribute(link[1], "href").replace("http://", "https://"),
      rel: attribute(link[1], "rel"),
      type: attribute(link[1], "type"),
      title: attribute(link[1], "title")
    }));

    return {
      id,
      title: tag(entry, "title"),
      abstract: tag(entry, "summary"),
      authors,
      published: tag(entry, "published"),
      updated: tag(entry, "updated"),
      primaryCategory:
        attribute(entry.match(/<arxiv:primary_category\b([^>]*)\/?\s*>/i)?.[1] ?? "", "term") ||
        categories[0] ||
        "unknown",
      categories,
      url: links.find((link) => link.rel === "alternate")?.href || idUrl,
      pdfUrl:
        links.find((link) => link.title === "pdf" || link.type === "application/pdf")?.href ||
        `https://arxiv.org/pdf/${id}`
    };
  });
}

function parseRssItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const rawUrl = tag(item, "link").replace("http://", "https://");
    const id = rawUrl.replace(/^https:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const creator = tag(item, "dc:creator");
    const published = new Date(tag(item, "pubDate"));
    const description = tag(item, "description").replace(/^arXiv:[^\s]+\s*(?:Announce Type:\s*\w+\s*)?(?:Abstract:\s*)?/i, "");
    return {
      id,
      title: tag(item, "title"),
      abstract: description,
      authors: creator.split(/,\s+|\s+and\s+/i).map((author) => author.trim()).filter(Boolean),
      published: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
      updated: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
      primaryCategory: "cs.RO",
      categories: ["cs.RO"],
      url: rawUrl,
      pdfUrl: `https://arxiv.org/pdf/${id}`
    };
  });
}

const topicRules = config.topic_rules.map((rule) => ({ ...rule, expression: new RegExp(rule.pattern, "i") }));

function scorePaper(paper, now) {
  let triageScore = paper.categories.includes("cs.RO") ? 4 : paper.categories.includes("eess.SY") ? 2 : 0;
  const matchedTopics = [];
  const routeScores = new Map();

  for (const rule of topicRules) {
    const titleMatch = rule.expression.test(paper.title);
    const abstractMatch = rule.expression.test(paper.abstract);
    if (!titleMatch && !abstractMatch) continue;
    const contribution = titleMatch ? rule.title_weight : rule.abstract_weight;
    triageScore += contribution;
    matchedTopics.push({ id: rule.id, label: rule.label, route: rule.route });
    routeScores.set(rule.route, (routeScores.get(rule.route) ?? 0) + contribution);
  }

  const ageDays = Math.max(0, (now.getTime() - new Date(paper.published).getTime()) / 86_400_000);
  if (ageDays <= 14) triageScore += 3;
  else if (ageDays <= 45) triageScore += 2;
  else if (ageDays <= 120) triageScore += 1;

  const routes = [...routeScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([route]) => route);
  return { triageScore, matchedTopics, routes };
}

function publicRecord(paper, previous, now) {
  const { triageScore, matchedTopics, routes } = scorePaper(paper, now);
  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    published: paper.published,
    updated: paper.updated,
    primaryCategory: paper.primaryCategory,
    categories: paper.categories,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    matchedTopics,
    routes,
    triageScore,
    status: previous?.status ?? "candidate",
    firstSeen: previous?.firstSeen ?? now.toISOString(),
    ...(previous?.editorNote ? { editorNote: previous.editorNote } : {})
  };
}

const queryUrl = new URL(endpoint);
queryUrl.search = new URLSearchParams({
  search_query: config.search_query,
  start: "0",
  max_results: String(maxResults),
  sortBy: "submittedDate",
  sortOrder: "descending"
}).toString();

let sourceMode = "api";
let sourceEndpoint = endpoint;
let xml;
if (inputFile) {
  xml = readFileSync(resolve(process.cwd(), inputFile), "utf8");
  sourceMode = "fixture";
  sourceEndpoint = inputFile;
} else {
  try {
    xml = await fetchFeed(queryUrl);
  } catch (error) {
    console.warn(`Primary arXiv query failed: ${error.message}`);
    console.warn("Waiting 3 seconds before trying the official cs.RO RSS fallback.");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
    xml = await fetchFeed(fallbackFeed);
    sourceMode = "rss-fallback";
    sourceEndpoint = fallbackFeed;
  }
}
const parsed = sourceMode === "rss-fallback" ? parseRssItems(xml) : parseEntries(xml);

const now = new Date();
const current = existsSync(OUTPUT_PATH)
  ? JSON.parse(readFileSync(OUTPUT_PATH, "utf8"))
  : { papers: [] };
if (parsed.length === 0) {
  console.log(`arXiv ${sourceMode} returned no new entries; preserving ${current.papers.length} existing candidates.`);
  process.exit(0);
}
const previousById = new Map((current.papers ?? []).map((paper) => [paper.id, paper]));
const mergedById = new Map(previousById);

for (const paper of parsed) {
  const previous = previousById.get(paper.id);
  const record = publicRecord(paper, previous, now);
  if (record.matchedTopics.length > 0 && record.triageScore >= minTriageScore) {
    mergedById.set(record.id, record);
  }
}

const papers = [...mergedById.values()]
  .sort(
    (a, b) =>
      b.triageScore - a.triageScore ||
      new Date(b.published).getTime() - new Date(a.published).getTime() ||
      a.id.localeCompare(b.id)
  )
  .slice(0, poolLimit);

if (dryRun) {
  console.log(`Dry run parsed ${parsed.length} records and retained ${papers.length} candidates.`);
  console.log(papers.map((paper) => `${paper.id}: ${paper.routes.join(",")} (${paper.triageScore})`).join("\n"));
  process.exit(0);
}

if (JSON.stringify(papers) === JSON.stringify(current.papers ?? [])) {
  console.log(`Frontier arXiv pool is unchanged (${papers.length} candidates).`);
  process.exit(0);
}

const snapshot = {
  schema_version: "0.1.0",
  generated_at: now.toISOString(),
  source: {
    endpoint: sourceEndpoint,
    mode: sourceMode,
    query: sourceMode === "api" ? config.search_query : "cs.RO daily RSS",
    sort_by: "submittedDate",
    sort_order: "descending",
    acknowledgement: "Thank you to arXiv for use of its open access interoperability."
  },
  policy: {
    stage: "discovery",
    score_meaning: "Metadata-only routing relevance; not paper quality, correctness, acceptance, or reproducibility.",
    review_gate: "Automation may create candidates only. Verified and reviewed states require human source checks."
  },
  papers
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Updated Frontier arXiv pool with ${papers.length} candidates from ${parsed.length} results.`);
