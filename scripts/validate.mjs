import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(repo, "site", "data", "atlas.json");
const catalogPath = path.join(repo, "site", "data", "catalog.json");
const sourcesPath = path.join(repo, "site", "data", "sources.json");
const jobsPath = path.join(repo, "site", "data", "ingestion-jobs.json");
const frontierPapersPath = path.join(repo, "site", "data", "frontier-papers.json");
const fieldGuidesPath = path.join(repo, "site", "data", "field-guides.json");
const frontierConfigPath = path.join(repo, "config", "frontier-arxiv.json");
const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "site/data/atlas.json",
  "site/data/catalog.json",
  "site/data/sources.json",
  "site/data/ingestion-jobs.json",
  "site/data/frontier-papers.json",
  "site/data/field-guides.json",
  "site/catalog/index.html",
  "site/catalog/catalog.css",
  "site/catalog/catalog.js",
  "site/sources/index.html",
  "site/sources/sources.css",
  "site/sources/sources.js",
  "site/pipeline/index.html",
  "site/pipeline/pipeline.css",
  "site/pipeline/pipeline.js",
  "site/frontier/index.html",
  "site/frontier/frontier.css",
  "site/frontier/frontier.js",
  "site/field.css",
  "site/field.js",
  "site/robotics/index.html",
  "site/hardware/index.html",
  "site/adjacent/index.html",
  "config/frontier-arxiv.json",
  "scripts/fetch-frontier-arxiv.mjs",
  "tests/fixtures/frontier-arxiv.atom.xml",
  ".github/workflows/refresh-frontier-arxiv.yml",
  "content/catalog-schema.md",
  "content/source-registry-schema.md",
  "content/ingestion-jobs-schema.md",
  "content/frontier-radar-schema.md",
  "content/field-guides-schema.md",
  "content/frontier.md",
  "content/robotics.md",
  "content/hardware.md",
  "content/adjacent.md",
  "content/lab.md"
];

for (const file of requiredFiles) await access(path.join(repo, file));
const atlas = JSON.parse(await readFile(dataPath, "utf8"));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const jobs = JSON.parse(await readFile(jobsPath, "utf8"));
const frontierPapers = JSON.parse(await readFile(frontierPapersPath, "utf8"));
const fieldGuides = JSON.parse(await readFile(fieldGuidesPath, "utf8"));
const frontierConfig = JSON.parse(await readFile(frontierConfigPath, "utf8"));
const allowedStatuses = new Set(["live", "seeded", "planned", "awaiting-source-material"]);

if (atlas.repository !== "RoboOpus/atlas") throw new Error("Unexpected Atlas repository target");
if (!Array.isArray(atlas.tracks) || atlas.tracks.length !== 6) throw new Error("Atlas must contain exactly six top-level tracks");

const ids = new Set();
for (const track of atlas.tracks) {
  if (!track.id || ids.has(track.id)) throw new Error(`Missing or duplicate track id: ${track.id}`);
  ids.add(track.id);
  if (!track.repository.startsWith("RoboOpus/")) throw new Error(`Repository outside RoboOpus: ${track.repository}`);
  if (track.repository === "RoboOpus/RoboOpus.github.io") throw new Error("Organization Pages repository is protected");
  if (track.planned_repository) {
    if (!track.planned_repository.startsWith("RoboOpus/")) throw new Error(`Planned repository outside RoboOpus: ${track.planned_repository}`);
    if (track.planned_repository === "RoboOpus/RoboOpus.github.io") throw new Error("Organization Pages repository cannot be a planned target");
  }
  if (!track.site_url.startsWith("https://roboopus.github.io/")) throw new Error(`Invalid project-site URL: ${track.site_url}`);
  if (!allowedStatuses.has(track.status)) throw new Error(`Invalid status for ${track.id}: ${track.status}`);
  if (!Array.isArray(track.scope) || track.scope.length < 3) throw new Error(`Track scope is too thin: ${track.id}`);
}

const catalogTracks = new Set(["frontier", "robotics", "hardware", "adjacent", "lab"]);
const priorities = new Set(["P0", "P1", "P2"]);
if (catalog.schema_version !== "0.1.0") throw new Error("Unexpected catalog schema version");
if (!Array.isArray(catalog.nodes) || catalog.nodes.length < 50) throw new Error("Breadth catalog must contain at least 50 seed nodes");

const nodeIds = new Set();
const perTrack = Object.fromEntries([...catalogTracks].map((track) => [track, 0]));
for (const node of catalog.nodes) {
  if (!node.id || nodeIds.has(node.id)) throw new Error(`Missing or duplicate catalog node id: ${node.id}`);
  nodeIds.add(node.id);
  if (!catalogTracks.has(node.track)) throw new Error(`Unknown catalog track: ${node.track}`);
  if (!node.id.startsWith(`${node.track}-`)) throw new Error(`Catalog node id/track mismatch: ${node.id}`);
  if (!node.title || !node.title_en || !node.summary || !node.section) throw new Error(`Incomplete catalog node: ${node.id}`);
  if (!priorities.has(node.priority)) throw new Error(`Invalid catalog priority: ${node.id}`);
  if (!Array.isArray(node.tags) || node.tags.length < 2) throw new Error(`Catalog node needs at least two tags: ${node.id}`);
  perTrack[node.track] += 1;
}
for (const [track, count] of Object.entries(perTrack)) {
  if (count < 5) throw new Error(`Catalog track is too thin: ${track} (${count})`);
}

const sourceKinds = new Set(["api", "standard", "course", "documentation", "repository", "vendor", "open-hardware", "dataset", "platform", "template"]);
const accessModes = new Set(["automatic", "assisted", "manual"]);
if (sources.schema_version !== "0.1.0") throw new Error("Unexpected source registry schema version");
if (!/^\d{4}-\d{2}-\d{2}$/.test(sources.verified_at)) throw new Error("Source registry verification date is invalid");
if (!Array.isArray(sources.sources) || sources.sources.length < 40) throw new Error("Source registry must contain at least 40 entries");

const sourceIds = new Set();
const sourcesPerTrack = Object.fromEntries([...catalogTracks].map((track) => [track, 0]));
for (const source of sources.sources) {
  if (!source.id || sourceIds.has(source.id)) throw new Error(`Missing or duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  if (!catalogTracks.has(source.track)) throw new Error(`Unknown source track: ${source.track}`);
  if (!source.id.startsWith(`${source.track}-`)) throw new Error(`Source id/track mismatch: ${source.id}`);
  if (!source.name || !source.owner || !source.best_for || !source.reuse_note) throw new Error(`Incomplete source: ${source.id}`);
  if (!sourceKinds.has(source.kind)) throw new Error(`Invalid source kind: ${source.id}`);
  if (!accessModes.has(source.access_mode)) throw new Error(`Invalid source access mode: ${source.id}`);
  if (typeof source.official !== "boolean") throw new Error(`Source first-party flag is missing: ${source.id}`);
  if (!source.url.startsWith("https://")) throw new Error(`Source URL must use HTTPS: ${source.id}`);
  if (!Array.isArray(source.tags) || source.tags.length < 2) throw new Error(`Source needs at least two tags: ${source.id}`);
  sourcesPerTrack[source.track] += 1;
}
for (const [track, count] of Object.entries(sourcesPerTrack)) {
  if (count < 5) throw new Error(`Source track is too thin: ${track} (${count})`);
}

const jobStatuses = new Set(["active", "ready", "planned", "awaiting-input"]);
if (jobs.schema_version !== "0.1.0") throw new Error("Unexpected ingestion job schema version");
if (!Array.isArray(jobs.jobs) || jobs.jobs.length < 15) throw new Error("Ingestion plan must contain at least 15 jobs");

const jobIds = new Set();
const jobsPerTrack = Object.fromEntries([...catalogTracks].map((track) => [track, 0]));
for (const job of jobs.jobs) {
  if (!job.id || jobIds.has(job.id)) throw new Error(`Missing or duplicate ingestion job id: ${job.id}`);
  jobIds.add(job.id);
  if (!catalogTracks.has(job.track)) throw new Error(`Unknown ingestion job track: ${job.id}`);
  if (!job.id.startsWith(`${job.track}-`)) throw new Error(`Ingestion job id/track mismatch: ${job.id}`);
  if (!job.title || !job.summary || !job.cadence || !job.output || !job.next_action) throw new Error(`Incomplete ingestion job: ${job.id}`);
  if (!accessModes.has(job.access_mode)) throw new Error(`Invalid ingestion access mode: ${job.id}`);
  if (!jobStatuses.has(job.status)) throw new Error(`Invalid ingestion status: ${job.id}`);
  if (!Array.isArray(job.source_ids)) throw new Error(`Missing source links for ingestion job: ${job.id}`);
  if (job.source_ids.length === 0 && job.status !== "awaiting-input") throw new Error(`Only awaiting-input jobs may omit sources: ${job.id}`);
  for (const sourceId of job.source_ids) {
    if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in ingestion job ${job.id}`);
  }
  if (!Array.isArray(job.target_node_ids) || job.target_node_ids.length === 0) throw new Error(`Missing target nodes for ingestion job: ${job.id}`);
  for (const nodeId of job.target_node_ids) {
    if (!nodeIds.has(nodeId)) throw new Error(`Unknown target node ${nodeId} in ingestion job ${job.id}`);
  }
  if (job.detail_url && !job.detail_url.startsWith("/atlas/")) throw new Error(`Invalid job detail URL: ${job.id}`);
  jobsPerTrack[job.track] += 1;
}
for (const [track, count] of Object.entries(jobsPerTrack)) {
  if (count < 1) throw new Error(`Ingestion track has no job: ${track}`);
}
if (![...jobs.jobs].some((job) => job.status === "active")) throw new Error("At least one ingestion job must be active");

const guideTracks = new Set(["robotics", "hardware", "adjacent"]);
if (fieldGuides.schema_version !== "0.1.0") throw new Error("Unexpected field guide schema version");
if (!/^\d{4}-\d{2}-\d{2}$/.test(fieldGuides.updated_at)) throw new Error("Field guide update date is invalid");
if (!Array.isArray(fieldGuides.records) || fieldGuides.records.length < 30) throw new Error("Field guides must contain at least 30 breadth records");
const guideIds = new Set();
const guidesPerTrack = Object.fromEntries([...guideTracks].map((track) => [track, 0]));
for (const record of fieldGuides.records) {
  if (!record.id || guideIds.has(record.id)) throw new Error(`Missing or duplicate field guide id: ${record.id}`);
  guideIds.add(record.id);
  if (!guideTracks.has(record.track)) throw new Error(`Unknown field guide track: ${record.id}`);
  if (!record.id.startsWith(`${record.track}-`)) throw new Error(`Field guide id/track mismatch: ${record.id}`);
  if (!record.section || !record.name || !record.subtitle || !record.kind || !record.summary || !record.use_when || !record.boundary) throw new Error(`Incomplete field guide record: ${record.id}`);
  if (!Array.isArray(record.node_ids) || record.node_ids.length === 0) throw new Error(`Field guide needs catalog links: ${record.id}`);
  for (const nodeId of record.node_ids) {
    if (!nodeIds.has(nodeId)) throw new Error(`Unknown catalog node ${nodeId} in field guide ${record.id}`);
  }
  if (!Array.isArray(record.source_ids) || record.source_ids.length === 0) throw new Error(`Field guide needs source links: ${record.id}`);
  for (const sourceId of record.source_ids) {
    if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in field guide ${record.id}`);
  }
  if (!Array.isArray(record.facts) || record.facts.length < 2 || record.facts.some((fact) => !fact.label || !fact.value)) throw new Error(`Field guide needs at least two facts: ${record.id}`);
  if (!Array.isArray(record.tags) || record.tags.length < 2) throw new Error(`Field guide needs at least two tags: ${record.id}`);
  for (const evidence of record.evidence_urls ?? []) {
    if (!evidence.label || !evidence.url?.startsWith("https://")) throw new Error(`Invalid evidence link in field guide ${record.id}`);
  }
  guidesPerTrack[record.track] += 1;
}
for (const [track, count] of Object.entries(guidesPerTrack)) {
  if (count < 8) throw new Error(`Field guide track is too thin: ${track} (${count})`);
}

if (frontierConfig.schema_version !== "0.1.0") throw new Error("Unexpected Frontier arXiv config schema version");
if (frontierConfig.endpoint !== "https://export.arxiv.org/api/query") throw new Error("Unexpected arXiv endpoint");
if (frontierConfig.fallback_feed !== "https://rss.arxiv.org/rss/cs.RO") throw new Error("Unexpected arXiv RSS fallback");
if (!frontierConfig.search_query || frontierConfig.max_results > 100 || frontierConfig.pool_limit > 60) throw new Error("Unsafe or incomplete Frontier arXiv limits");
if (!Array.isArray(frontierConfig.topic_rules) || frontierConfig.topic_rules.length < 8) throw new Error("Frontier routing rules are too thin");
const topicRuleIds = new Set(frontierConfig.topic_rules.map((rule) => rule.id));
if (topicRuleIds.size !== frontierConfig.topic_rules.length) throw new Error("Duplicate Frontier topic rule id");

const paperRoutes = new Set(["wam", "robotics", "hardware", "adjacent"]);
const paperStatuses = new Set(["candidate", "reviewing", "verified", "reviewed", "ignored"]);
if (frontierPapers.schema_version !== "0.1.0") throw new Error("Unexpected Frontier paper schema version");
if (frontierPapers.policy?.stage !== "discovery") throw new Error("Frontier paper pool must remain discovery-only");
if (!Array.isArray(frontierPapers.papers)) throw new Error("Frontier paper pool is missing");
if (frontierPapers.papers.length > frontierConfig.pool_limit) throw new Error("Frontier paper pool exceeds configured limit");
if (frontierPapers.papers.length > 0 && !frontierPapers.generated_at) throw new Error("Populated Frontier paper pool lacks generation time");
const paperIds = new Set();
for (const paper of frontierPapers.papers) {
  if (!paper.id || paperIds.has(paper.id)) throw new Error(`Missing or duplicate Frontier paper id: ${paper.id}`);
  paperIds.add(paper.id);
  if (!paper.title || !paper.abstract || !paper.url || !paper.pdfUrl || !paper.published) throw new Error(`Incomplete Frontier paper: ${paper.id}`);
  if (!Array.isArray(paper.authors) || paper.authors.length === 0) throw new Error(`Frontier paper has no authors: ${paper.id}`);
  if (!Array.isArray(paper.routes) || paper.routes.length === 0 || paper.routes.some((route) => !paperRoutes.has(route))) throw new Error(`Invalid Frontier route: ${paper.id}`);
  if (!Array.isArray(paper.matchedTopics) || paper.matchedTopics.length === 0) throw new Error(`Frontier paper has no topic match: ${paper.id}`);
  if (paper.matchedTopics.some((topic) => !topicRuleIds.has(topic.id))) throw new Error(`Unknown Frontier topic match: ${paper.id}`);
  if (!Number.isInteger(paper.triageScore) || paper.triageScore < frontierConfig.min_triage_score) throw new Error(`Invalid Frontier triage score: ${paper.id}`);
  if (!paperStatuses.has(paper.status)) throw new Error(`Invalid Frontier paper status: ${paper.id}`);
}

process.stdout.write(`Validated ${atlas.tracks.length} tracks, ${catalog.nodes.length} catalog nodes, ${sources.sources.length} sources, ${jobs.jobs.length} ingestion jobs, ${fieldGuides.records.length} field-guide records, ${frontierPapers.papers.length} Frontier candidates, and ${requiredFiles.length} required files.\n`);
