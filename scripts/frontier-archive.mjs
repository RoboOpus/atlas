import { createHash } from "node:crypto";

const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
// Ranking can change as a paper ages; that is not new scientific evidence.
const evidence = ({ triageScore, matchedTopics, routes, ...record }) => record;
export function bootstrapArchive(papers, now) {
  const records = papers.map((paper) => ({ ...paper, dateProvenance: paper.dateProvenance ?? "legacy-unverified" })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    archive: { schema_version: "1.0.0", created_at: now, last_success_at: null, policy: "Persistent candidates; removal from the ranked window never deletes the archive. Legacy publication dates need re-verification.", papers: records },
    events: { schema_version: "1.0.0", events: [{ id: `baseline-${fingerprint(records).slice(0, 16)}`, at: now, kind: "baseline", added: [], updated: [], baseline_ids: records.map((paper) => paper.id), note: "导入已有雷达快照作为归档基线，不声称今天新发现这些论文；此前被截断的候选无法从此快照恢复。" }] }
  };
}

export function mergeObservation(previous, incoming) {
  if (!previous) return { ...incoming, status: "candidate" };
  const merged = { ...incoming, firstSeen: previous.firstSeen, status: previous.status };
  if (previous.editorNote !== undefined) merged.editorNote = previous.editorNote;
  if (!incoming.abstract && previous.abstract) { merged.abstract = previous.abstract; merged.metadataCompleteness = previous.metadataCompleteness; }
  if (!incoming.authors?.length && previous.authors?.length) merged.authors = previous.authors;
  // A feed announcement is not a submission/version timestamp. Do not erase API evidence.
  if (previous.dateProvenance === "arxiv-api" && incoming.dateProvenance !== "arxiv-api") {
    for (const key of ["published", "updated", "dateProvenance", "title", "authors", "categories", "primaryCategory", "abstract", "metadataCompleteness", "url", "pdfUrl"]) merged[key] = previous[key];
  }
  if (previous.dateProvenance === "arxiv-api" && incoming.dateProvenance === "arxiv-api" && Date.parse(incoming.updated) < Date.parse(previous.updated)) return previous;
  if (!merged.announcedAt && previous.announcedAt) merged.announcedAt = previous.announcedAt;
  return merged;
}

export function updateArchive({ archive, events, incoming, now, score, minScore, poolLimit, source }) {
  const existing = new Map(archive.papers.map((paper) => [paper.id, paper]));
  const added = [];
  const updated = [];
  for (const raw of incoming) {
    if (!/^\d{4}\.\d{4,5}$/.test(raw.id) || !raw.title) throw new Error(`Invalid candidate: ${raw.id}`);
    const old = existing.get(raw.id);
    const merged = mergeObservation(old, raw);
    const record = { ...merged, ...score(merged) };
    if (!old && (!record.matchedTopics.length || record.triageScore < minScore)) continue;
    if (!old) added.push(record.id);
    else if (fingerprint(evidence(record)) !== fingerprint(evidence(old))) updated.push(record.id);
    existing.set(record.id, record);
  }
  // Refresh all scores; keep historical records even when their score falls below the display threshold.
  const papers = [...existing.values()].map((paper) => ({ ...paper, ...score(paper) })).sort((a, b) => a.id.localeCompare(b.id));
  const nextEvents = [...events.events];
  if (added.length || updated.length) {
    const payload = { at: now, kind: "discovery", added: [...new Set(added)].sort(), updated: [...new Set(updated)].filter((id) => !added.includes(id)).sort(), source };
    nextEvents.push({ id: `discovery-${fingerprint(payload).slice(0, 16)}`, ...payload });
  }
  const pool = papers.filter((paper) => paper.triageScore >= minScore && paper.matchedTopics.length)
    .sort((a, b) => b.triageScore - a.triageScore || (Date.parse(b.published ?? b.announcedAt) || 0) - (Date.parse(a.published ?? a.announcedAt) || 0) || a.id.localeCompare(b.id)).slice(0, poolLimit);
  return { archive: { ...archive, last_success_at: now, last_source: source, papers }, events: { ...events, events: nextEvents }, pool, added, updated };
}
