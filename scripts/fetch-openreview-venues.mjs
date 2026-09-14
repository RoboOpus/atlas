import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_PATH = resolve(process.cwd(), "config", "frontier-venues.json");
const OUTPUT_PATH = resolve(process.cwd(), "content", "venue-registry.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const previous = existsSync(OUTPUT_PATH) ? JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) : { venues: [] };
const previousById = new Map((previous.venues ?? []).map((venue) => [venue.id, venue]));
const checkedAt = new Date().toISOString();
const inputFile = process.argv.find((value) => value.startsWith("--input-file="))?.slice("--input-file=".length);

function field(content, key) {
  const raw = content?.[key];
  if (raw && typeof raw === "object" && "value" in raw) return raw.value;
  return raw ?? null;
}

function normalizeDate(value) {
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  }
  return value ? String(value) : "unknown";
}

async function fetchGroup(groupId) {
  if (inputFile) {
    const fixture = JSON.parse(readFileSync(resolve(process.cwd(), inputFile), "utf8"));
    const group = fixture.groups?.find((item) => item.id === groupId);
    if (!group) throw new Error(`Fixture does not contain ${groupId}`);
    return group;
  }

  const url = new URL(config.endpoint);
  url.searchParams.set("id", groupId);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "RoboOpus-Atlas/0.3 (https://github.com/RoboOpus/atlas)"
        },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload.groups?.[0]) throw new Error("group not found");
      return payload.groups[0];
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2_000));
    }
  }
  throw new Error(`${groupId}: ${lastError?.message ?? "unknown error"}`);
}

function manualRecord(venue) {
  return {
    ...venue,
    group_id: null,
    group_url: null,
    submissions_public: null,
    paper_ingestion: "manual-proceedings",
    fetch_state: "manual-source",
    checked_at: checkedAt
  };
}

function openReviewRecord(venue, group) {
  const content = group.content ?? {};
  const submissionsPublic = field(content, "public_submissions") === true;
  const website = field(content, "website");
  return {
    ...venue,
    title: field(content, "title") || `${venue.family} ${venue.cycle}`,
    venue_url: typeof website === "string" && website.startsWith("http") ? website.replace(/^http:/, "https:") : "unknown",
    group_url: `https://openreview.net/group?id=${encodeURIComponent(venue.group_id)}`,
    location: field(content, "location") || "unknown",
    start_date: normalizeDate(field(content, "start_date")),
    date_text: field(content, "date") || "unknown",
    submissions_public: submissionsPublic,
    paper_ingestion: submissionsPublic ? "ready-public-submissions" : "metadata-only",
    collection_note: submissionsPublic
      ? "OpenReview 当前允许公开投稿发现；论文仍需单独核验状态与版本。"
      : "会议 Group 可核验，但公开投稿开关当前为 false；暂不把投稿列表当作可抓取来源。",
    fetch_state: "fresh",
    checked_at: checkedAt
  };
}

const venues = [];
for (const venue of config.venues) {
  if (venue.capture_mode !== "openreview-api-v2") {
    venues.push(manualRecord(venue));
    continue;
  }
  try {
    venues.push(openReviewRecord(venue, await fetchGroup(venue.group_id)));
  } catch (error) {
    const old = previousById.get(venue.id);
    if (!old) throw error;
    const priorNote = old.collection_note.replace(/ 本次 API 核验失败，保留上一快照。$/, "");
    venues.push({ ...old, fetch_state: "stale", checked_at: checkedAt, collection_note: `${priorNote} 本次 API 核验失败，保留上一快照。` });
    console.warn(`Preserved stale venue ${venue.id}: ${error.message}`);
  }
}

venues.sort((a, b) => b.cycle - a.cycle || a.domain.localeCompare(b.domain) || a.family.localeCompare(b.family));
const output = {
  schema_version: "0.1.0",
  generated_at: checkedAt,
  source: {
    endpoint: config.endpoint,
    schedule: config.schedule,
    documentation: "https://docs.openreview.net/reference/api-v2/entities/group"
  },
  policy: {
    purpose: "Venue access and visibility tracking, not venue ranking.",
    public_gate: "A reachable venue Group does not imply public submissions.",
    review_gate: "Automation may update metadata only; acceptance and quality claims require source review."
  },
  venues
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Updated ${venues.length} venue records (${venues.filter((venue) => venue.fetch_state === "fresh").length} OpenReview fresh).`);
