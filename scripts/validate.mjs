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
const knowledgePath = path.join(repo, "site", "data", "knowledge.json");
const hardwarePriceSourcePath = path.join(repo, "content", "hardware-price-snapshots.json");
const hardwarePricePublishedPath = path.join(repo, "site", "data", "hardware-price-snapshots.json");
const venueRegistrySourcePath = path.join(repo, "content", "venue-registry.json");
const venueRegistryPublishedPath = path.join(repo, "site", "data", "venue-registry.json");
const workIdentitySourcePath = path.join(repo, "content", "work-identities.json");
const workIdentityPublishedPath = path.join(repo, "site", "data", "work-identities.json");
const controlExperimentSourcePath = path.join(repo, "content", "control-experiments.json");
const controlExperimentPublishedPath = path.join(repo, "site", "data", "control-experiments.json");
const benchmarkRegistrySourcePath = path.join(repo, "content", "benchmark-registry.json");
const benchmarkRegistryPublishedPath = path.join(repo, "site", "data", "benchmark-registry.json");
const frontierConfigPath = path.join(repo, "config", "frontier-arxiv.json");
const venueConfigPath = path.join(repo, "config", "frontier-venues.json");
const requiredFiles = [
  "site/search/index.html",
  "site/search/search.css",
  "site/search/search.js",
  "site/search/engine.js",
  "site/maintenance/index.html",
  "site/maintenance/maintenance.js",
  "site/data/search-index.json",
  "site/data/maintenance.json",
  "site/data/frontier-archive.json",
  "site/data/frontier-events.json",
  "content/frontier-archive.json",
  "content/frontier-events.json",
  "site/frontier/changes/index.html",
  "site/frontier/changes/changes.js",
  "site/index.html",
  "site/styles.css",
  "site/data/atlas.json",
  "site/data/catalog.json",
  "site/data/sources.json",
  "site/data/ingestion-jobs.json",
  "site/data/frontier-papers.json",
  "site/data/field-guides.json",
  "site/data/knowledge.json",
  "site/data/hardware-price-snapshots.json",
  "site/data/venue-registry.json",
  "site/data/work-identities.json",
  "site/data/control-experiments.json",
  "site/data/benchmark-registry.json",
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
  "site/frontier/venues/index.html",
  "site/frontier/venues/venues.css",
  "site/frontier/venues/venues.js",
  "site/frontier/works/index.html",
  "site/frontier/works/works.css",
  "site/frontier/works/works.js",
  "site/field.css",
  "site/field.js",
  "site/robotics/index.html",
  "site/robotics/control-lab/index.html",
  "site/robotics/control-lab/control-lab.css",
  "site/robotics/control-lab/control-lab.js",
  "site/robotics/benchmarks/index.html",
  "site/robotics/benchmarks/benchmarks.css",
  "site/robotics/benchmarks/benchmarks.js",
  "site/hardware/index.html",
  "site/adjacent/index.html",
  "site/knowledge/index.html",
  "site/knowledge/knowledge.css",
  "site/knowledge/knowledge.js",
  "config/frontier-arxiv.json",
  "config/frontier-venues.json",
  "scripts/fetch-frontier-arxiv.mjs",
  "scripts/fetch-openreview-venues.mjs",
  "scripts/build-knowledge.mjs",
  "scripts/match-work-identities.mjs",
  "tests/work-identity-matcher.test.mjs",
  "tests/fixtures/frontier-arxiv.atom.xml",
  "tests/fixtures/frontier-arxiv-listing.html",
  ".github/workflows/refresh-frontier-arxiv.yml",
  ".github/workflows/refresh-openreview-venues.yml",
  "content/catalog-schema.md",
  "content/source-registry-schema.md",
  "content/ingestion-jobs-schema.md",
  "content/frontier-radar-schema.md",
  "content/venue-registry-schema.md",
  "content/work-identities-schema.md",
  "content/field-guides-schema.md",
  "content/knowledge-schema.md",
  "content/hardware-price-snapshots.json",
  "content/venue-registry.json",
  "content/work-identities.json",
  "content/control-experiments.json",
  "content/control-experiments-schema.md",
  "content/benchmark-registry.json",
  "content/benchmark-registry-schema.md",
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
const knowledge = JSON.parse(await readFile(knowledgePath, "utf8"));
const hardwarePrices = JSON.parse(await readFile(hardwarePriceSourcePath, "utf8"));
const publishedHardwarePrices = JSON.parse(await readFile(hardwarePricePublishedPath, "utf8"));
const venueRegistry = JSON.parse(await readFile(venueRegistrySourcePath, "utf8"));
const publishedVenueRegistry = JSON.parse(await readFile(venueRegistryPublishedPath, "utf8"));
const workIdentities = JSON.parse(await readFile(workIdentitySourcePath, "utf8"));
const publishedWorkIdentities = JSON.parse(await readFile(workIdentityPublishedPath, "utf8"));
const controlExperiments = JSON.parse(await readFile(controlExperimentSourcePath, "utf8"));
const publishedControlExperiments = JSON.parse(await readFile(controlExperimentPublishedPath, "utf8"));
const benchmarkRegistry = JSON.parse(await readFile(benchmarkRegistrySourcePath, "utf8"));
const publishedBenchmarkRegistry = JSON.parse(await readFile(benchmarkRegistryPublishedPath, "utf8"));
const frontierConfig = JSON.parse(await readFile(frontierConfigPath, "utf8"));
const venueConfig = JSON.parse(await readFile(venueConfigPath, "utf8"));
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

if (hardwarePrices.schema_version !== "0.1.0") throw new Error("Unexpected hardware price schema version");
if (!/^\d{4}-\d{2}-\d{2}$/.test(hardwarePrices.captured_at)) throw new Error("Hardware price capture date is invalid");
if (hardwarePrices.policy?.append_only !== true || hardwarePrices.policy?.currency_conversion !== false || hardwarePrices.policy?.unknowns_are_explicit !== true) throw new Error("Hardware price policy is incomplete");
if (!Array.isArray(hardwarePrices.snapshots) || hardwarePrices.snapshots.length < 5) throw new Error("Hardware price ledger needs at least five snapshots");
const hardwarePriceIds = new Set();
for (const snapshot of hardwarePrices.snapshots) {
  if (!snapshot.id || hardwarePriceIds.has(snapshot.id)) throw new Error(`Missing or duplicate hardware price id: ${snapshot.id}`);
  hardwarePriceIds.add(snapshot.id);
  if (!snapshot.product || !snapshot.variant || !snapshot.category || !snapshot.region) throw new Error(`Incomplete hardware price identity: ${snapshot.id}`);
  if (typeof snapshot.price !== "number" || snapshot.price <= 0 || !/^[A-Z]{3}$/.test(snapshot.currency)) throw new Error(`Invalid hardware price value: ${snapshot.id}`);
  if (!snapshot.tax || !snapshot.freight || !snapshot.availability) throw new Error(`Incomplete hardware price terms: ${snapshot.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.captured_at)) throw new Error(`Invalid hardware price date: ${snapshot.id}`);
  const source = sources.sources.find((item) => item.id === snapshot.source_id);
  if (!source || source.track !== "hardware" || source.official !== true) throw new Error(`Hardware price source is not first-party: ${snapshot.id}`);
  if (snapshot.source_url !== source.url) throw new Error(`Hardware price URL does not match source registry: ${snapshot.id}`);
}
if (JSON.stringify(hardwarePrices) !== JSON.stringify(publishedHardwarePrices)) throw new Error("Published hardware price ledger is stale");

const venueCaptureModes = new Set(["openreview-api-v2", "official-site"]);
const venueIngestionStates = new Set(["ready-public-submissions", "metadata-only", "manual-proceedings"]);
const venueFetchStates = new Set(["fresh", "stale", "manual-source"]);
const venueRoutes = new Set(["wam", "robotics", "hardware", "adjacent"]);
if (venueConfig.schema_version !== "0.1.0" || venueConfig.endpoint !== "https://api2.openreview.net/groups") throw new Error("Unexpected venue config");
if (!Array.isArray(venueConfig.venues) || venueConfig.venues.length < 7) throw new Error("Venue config is too thin");
if (venueRegistry.schema_version !== "0.1.0" || !Array.isArray(venueRegistry.venues)) throw new Error("Unexpected venue registry schema");
if (Number.isNaN(new Date(venueRegistry.generated_at).getTime())) throw new Error("Venue registry generation time is invalid");
if (venueRegistry.venues.length !== venueConfig.venues.length) throw new Error("Venue registry/config counts differ");
if (JSON.stringify(venueRegistry) !== JSON.stringify(publishedVenueRegistry)) throw new Error("Published venue registry is stale");
const configuredVenueIds = new Set(venueConfig.venues.map((venue) => venue.id));
const venueIds = new Set();
for (const venue of venueRegistry.venues) {
  if (!venue.id || venueIds.has(venue.id) || !configuredVenueIds.has(venue.id)) throw new Error(`Missing, duplicate, or unconfigured venue: ${venue.id}`);
  venueIds.add(venue.id);
  if (!venue.family || !Number.isInteger(venue.cycle) || !venue.domain || !venue.title) throw new Error(`Incomplete venue identity: ${venue.id}`);
  if (!venueCaptureModes.has(venue.capture_mode) || !venueIngestionStates.has(venue.paper_ingestion) || !venueFetchStates.has(venue.fetch_state)) throw new Error(`Invalid venue state: ${venue.id}`);
  if (!Array.isArray(venue.relevance_routes) || venue.relevance_routes.length === 0 || venue.relevance_routes.some((route) => !venueRoutes.has(route))) throw new Error(`Invalid venue routes: ${venue.id}`);
  if (!sourceIds.has(venue.source_id)) throw new Error(`Unknown venue source: ${venue.id}`);
  if (!venue.venue_url?.startsWith("https://") || !venue.location || !venue.start_date || !venue.date_text || !venue.collection_note) throw new Error(`Incomplete venue metadata: ${venue.id}`);
  if (Number.isNaN(new Date(venue.checked_at).getTime())) throw new Error(`Invalid venue check time: ${venue.id}`);
  if (venue.capture_mode === "openreview-api-v2") {
    if (!venue.group_id || !venue.group_url?.startsWith("https://openreview.net/group") || typeof venue.submissions_public !== "boolean") throw new Error(`Incomplete OpenReview venue: ${venue.id}`);
    if (venue.paper_ingestion === "manual-proceedings" || venue.fetch_state === "manual-source") throw new Error(`OpenReview venue has manual-only state: ${venue.id}`);
  } else if (venue.group_id !== null || venue.group_url !== null || venue.submissions_public !== null || venue.paper_ingestion !== "manual-proceedings") {
    throw new Error(`Official-site venue incorrectly claims OpenReview access: ${venue.id}`);
  }
}

const workIdentityStates = new Set(["arxiv-only", "project-linked", "venue-linked", "fully-linked"]);
if (workIdentities.schema_version !== "0.1.0" || !Array.isArray(workIdentities.works)) throw new Error("Unexpected work identity registry schema");
if (!/^\d{4}-\d{2}-\d{2}$/.test(workIdentities.updated_at)) throw new Error("Work identity update date is invalid");
if (workIdentities.policy?.unknowns !== "Unknown DOI, OpenReview, code, model, or venue links remain null.") throw new Error("Work identity unknown policy is incomplete");
if (workIdentities.works.length < 4) throw new Error("Work identity registry is too thin");
if (JSON.stringify(workIdentities) !== JSON.stringify(publishedWorkIdentities)) throw new Error("Published work identity registry is stale");
const workIds = new Set();
for (const work of workIdentities.works) {
  if (!work.id || workIds.has(work.id)) throw new Error(`Missing or duplicate work identity: ${work.id}`);
  workIds.add(work.id);
  if (!work.title || !Number.isInteger(work.year) || !Array.isArray(work.lead_authors) || work.lead_authors.length === 0) throw new Error(`Incomplete work identity: ${work.id}`);
  if (!Array.isArray(work.routes) || work.routes.length === 0 || work.routes.some((route) => !venueRoutes.has(route))) throw new Error(`Invalid work route: ${work.id}`);
  if (!workIdentityStates.has(work.identity_state)) throw new Error(`Invalid work identity state: ${work.id}`);
  if (!work.canonical_url?.startsWith("https://") || !/^\d{4}-\d{2}-\d{2}$/.test(work.checked_at) || !work.notes) throw new Error(`Incomplete work provenance: ${work.id}`);
  if (!work.identifiers || !Object.hasOwn(work.identifiers, "arxiv") || !Object.hasOwn(work.identifiers, "doi") || !Object.hasOwn(work.identifiers, "openreview")) throw new Error(`Missing work identifiers: ${work.id}`);
  if (work.identifiers.arxiv && !/^\d{4}\.\d{4,5}(v\d+)?$/.test(work.identifiers.arxiv)) throw new Error(`Invalid arXiv identity: ${work.id}`);
  if (work.identifiers.doi?.toLocaleLowerCase().startsWith("10.48550/arxiv.")) throw new Error(`arXiv DataCite DOI incorrectly used as venue DOI: ${work.id}`);
  if (!work.links || !Object.hasOwn(work.links, "project") || !Object.hasOwn(work.links, "code") || !Object.hasOwn(work.links, "model") || !Object.hasOwn(work.links, "venue_publication") || !Object.hasOwn(work.links, "official_paper")) throw new Error(`Missing work link fields: ${work.id}`);
  for (const url of Object.values(work.links).filter(Boolean)) if (!url.startsWith("https://")) throw new Error(`Invalid work link: ${work.id}`);
  if (!Array.isArray(work.source_ids) || work.source_ids.length === 0 || work.source_ids.some((sourceId) => !sourceIds.has(sourceId))) throw new Error(`Unknown source in work identity: ${work.id}`);
  if (work.identity_state === "venue-linked" && (!work.venue || !work.links.venue_publication)) throw new Error(`Venue-linked work lacks publication identity: ${work.id}`);
}

const experimentSettings = new Set(["simulation", "hardware"]);
const experimentReadiness = new Set(["specified", "running", "completed", "safety-review-required"]);
if (controlExperiments.schema_version !== "0.1.0" || !Array.isArray(controlExperiments.experiments)) throw new Error("Unexpected control experiment schema");
if (!/^\d{4}-\d{2}-\d{2}$/.test(controlExperiments.updated_at)) throw new Error("Control experiment update date is invalid");
if (!controlExperiments.policy?.results?.includes("not a completed result") || !controlExperiments.policy?.hardware_gate?.includes("safety review")) throw new Error("Control experiment policy is incomplete");
if (controlExperiments.experiments.length < 3) throw new Error("Control experiment registry needs at least three protocols");
if (JSON.stringify(controlExperiments) !== JSON.stringify(publishedControlExperiments)) throw new Error("Published control experiment registry is stale");
const experimentIds = new Set();
for (const experiment of controlExperiments.experiments) {
  if (!experiment.id || experimentIds.has(experiment.id)) throw new Error(`Missing or duplicate control experiment: ${experiment.id}`);
  experimentIds.add(experiment.id);
  if (experiment.track !== "robotics" || !experiment.id.startsWith("control-")) throw new Error(`Invalid control experiment route: ${experiment.id}`);
  if (!experiment.family || !experiment.title || !experiment.system || !experiment.summary || !experiment.question) throw new Error(`Incomplete control experiment identity: ${experiment.id}`);
  if (!experimentSettings.has(experiment.setting) || !experimentReadiness.has(experiment.readiness)) throw new Error(`Invalid control experiment state: ${experiment.id}`);
  if (!Array.isArray(experiment.controllers) || experiment.controllers.length < 2 || experiment.controllers.some((controller) => !controller.name || !controller.role || !controller.assumption)) throw new Error(`Control experiment needs two comparable controllers: ${experiment.id}`);
  if (!Array.isArray(experiment.fixed_protocol) || experiment.fixed_protocol.length < 3) throw new Error(`Control experiment protocol is too thin: ${experiment.id}`);
  if (!Array.isArray(experiment.metrics) || experiment.metrics.length < 4) throw new Error(`Control experiment metrics are too thin: ${experiment.id}`);
  if (!Array.isArray(experiment.artifacts) || experiment.artifacts.length < 4) throw new Error(`Control experiment artifacts are too thin: ${experiment.id}`);
  if (!experiment.success_gate || !experiment.risk_gate) throw new Error(`Control experiment gates are incomplete: ${experiment.id}`);
  if (!Array.isArray(experiment.node_ids) || !experiment.node_ids.includes("robotics-control-experiments") || experiment.node_ids.some((nodeId) => !nodeIds.has(nodeId))) throw new Error(`Unknown node in control experiment: ${experiment.id}`);
  if (!Array.isArray(experiment.source_ids) || experiment.source_ids.length === 0 || experiment.source_ids.some((sourceId) => !sourceIds.has(sourceId))) throw new Error(`Unknown source in control experiment: ${experiment.id}`);
  if (!Array.isArray(experiment.evidence_urls) || experiment.evidence_urls.length === 0 || experiment.evidence_urls.some((evidence) => !evidence.label || !evidence.url?.startsWith("https://"))) throw new Error(`Invalid evidence in control experiment: ${experiment.id}`);
  if (experiment.setting === "hardware" && (experiment.readiness !== "safety-review-required" || !/(safety|安全)/iu.test(experiment.risk_gate))) throw new Error(`Hardware experiment bypasses safety review: ${experiment.id}`);
}

const benchmarkArtifactTypes = new Set(["benchmark", "dataset", "benchmark-and-dataset", "platform"]);
const benchmarkEnvironments = new Set(["simulation", "real", "sim-and-real"]);
if (benchmarkRegistry.schema_version !== "0.1.0" || !Array.isArray(benchmarkRegistry.records)) throw new Error("Unexpected benchmark registry schema");
if (!/^\d{4}-\d{2}-\d{2}$/.test(benchmarkRegistry.updated_at)) throw new Error("Benchmark registry update date is invalid");
if (!benchmarkRegistry.policy?.comparison || !benchmarkRegistry.policy?.scale || !benchmarkRegistry.policy?.versioning || !benchmarkRegistry.policy?.licenses) throw new Error("Benchmark registry policy is incomplete");
if (benchmarkRegistry.records.length < 10) throw new Error("Benchmark registry needs at least ten breadth records");
if (JSON.stringify(benchmarkRegistry) !== JSON.stringify(publishedBenchmarkRegistry)) throw new Error("Published benchmark registry is stale");
const benchmarkIds = new Set();
for (const record of benchmarkRegistry.records) {
  if (!record.id || benchmarkIds.has(record.id)) throw new Error(`Missing or duplicate benchmark record: ${record.id}`);
  benchmarkIds.add(record.id);
  if (!record.name || !record.domain || !record.focus || !record.scale_statement || !record.evaluation_unit) throw new Error(`Incomplete benchmark identity: ${record.id}`);
  if (!benchmarkArtifactTypes.has(record.artifact_type) || !benchmarkEnvironments.has(record.environment)) throw new Error(`Invalid benchmark classification: ${record.id}`);
  if (!Array.isArray(record.primary_metrics) || record.primary_metrics.length < 2) throw new Error(`Benchmark metrics are too thin: ${record.id}`);
  if (!Array.isArray(record.protocol_keys) || record.protocol_keys.length < 4) throw new Error(`Benchmark protocol is too thin: ${record.id}`);
  if (!record.comparison_boundary || !record.license_note) throw new Error(`Benchmark boundaries are incomplete: ${record.id}`);
  if (!Array.isArray(record.node_ids) || !record.node_ids.includes("robotics-benchmark-registry") || record.node_ids.some((nodeId) => !nodeIds.has(nodeId))) throw new Error(`Unknown node in benchmark registry: ${record.id}`);
  if (!Array.isArray(record.source_ids) || record.source_ids.length === 0 || record.source_ids.some((sourceId) => !sourceIds.has(sourceId))) throw new Error(`Unknown source in benchmark registry: ${record.id}`);
  if (!record.links || !Object.hasOwn(record.links, "project") || !Object.hasOwn(record.links, "repository") || !Object.hasOwn(record.links, "paper") || !Object.hasOwn(record.links, "data")) throw new Error(`Benchmark links are incomplete: ${record.id}`);
  for (const url of Object.values(record.links).filter(Boolean)) if (!url.startsWith("https://")) throw new Error(`Invalid benchmark URL: ${record.id}`);
  if (!Array.isArray(record.tags) || record.tags.length < 2) throw new Error(`Benchmark tags are too thin: ${record.id}`);
}
if (!benchmarkIds.has("robodojo-2026")) throw new Error("RoboDojo must remain in the benchmark registry");

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

const editorialStates = new Set(["source-checked-draft", "reviewed"]);
if (knowledge.schema_version !== "0.1.0") throw new Error("Unexpected knowledge index schema version");
if (!Array.isArray(knowledge.articles) || knowledge.articles.length < 6) throw new Error("Knowledge base must contain at least six source-backed articles");
if (atlas.knowledge_content?.article_count !== knowledge.articles.length) throw new Error("Atlas knowledge article count is out of sync");
const articleIds = new Set();
const articleSlugs = new Set();
const articlesPerTrack = Object.fromEntries([...guideTracks].map((track) => [track, 0]));
for (const article of knowledge.articles) {
  if (!article.id || articleIds.has(article.id)) throw new Error(`Missing or duplicate knowledge article id: ${article.id}`);
  articleIds.add(article.id);
  if (!article.slug || articleSlugs.has(article.slug)) throw new Error(`Missing or duplicate knowledge article slug: ${article.slug}`);
  articleSlugs.add(article.slug);
  if (!guideTracks.has(article.track)) throw new Error(`Unknown knowledge article track: ${article.id}`);
  if (!article.id.startsWith(`${article.track}-`)) throw new Error(`Knowledge article id/track mismatch: ${article.id}`);
  if (!article.category || !article.title || !article.summary || !article.difficulty || !article.updated_at) throw new Error(`Incomplete knowledge article: ${article.id}`);
  if (!editorialStates.has(article.editorial_state)) throw new Error(`Invalid editorial state: ${article.id}`);
  if (typeof article.human_reviewed !== "boolean") throw new Error(`Missing human review flag: ${article.id}`);
  if (article.editorial_state === "reviewed" && article.human_reviewed !== true) throw new Error(`Reviewed article lacks human confirmation: ${article.id}`);
  if (article.editorial_state === "source-checked-draft" && article.human_reviewed !== false) throw new Error(`Draft article incorrectly claims human review: ${article.id}`);
  if (!Array.isArray(article.source_ids) || article.source_ids.length === 0) throw new Error(`Knowledge article needs sources: ${article.id}`);
  for (const sourceId of article.source_ids) {
    if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in knowledge article ${article.id}`);
  }
  if (!Array.isArray(article.node_ids) || article.node_ids.length === 0) throw new Error(`Knowledge article needs catalog nodes: ${article.id}`);
  for (const nodeId of article.node_ids) {
    if (!nodeIds.has(nodeId)) throw new Error(`Unknown node ${nodeId} in knowledge article ${article.id}`);
  }
  if (!article.source_file?.startsWith("content/knowledge/") || !article.source_file.endsWith(".md")) throw new Error(`Invalid knowledge source file: ${article.id}`);
  if (article.url !== `/atlas/knowledge/${article.slug}/`) throw new Error(`Invalid knowledge article URL: ${article.id}`);
  if (!Number.isInteger(article.reading_minutes) || article.reading_minutes < 2) throw new Error(`Invalid reading time: ${article.id}`);
  if (article.source_count !== article.source_ids.length || article.node_count !== article.node_ids.length) throw new Error(`Knowledge article counts are stale: ${article.id}`);
  await access(path.join(repo, article.source_file));
  const renderedPath = path.join(repo, "site", "knowledge", article.slug, "index.html");
  await access(renderedPath);
  const renderedArticle = await readFile(renderedPath, "utf8");
  if (!renderedArticle.includes(article.title) || !renderedArticle.includes("来源与证据")) throw new Error(`Rendered knowledge article is incomplete: ${article.id}`);
  articlesPerTrack[article.track] += 1;
}
for (const [track, count] of Object.entries(articlesPerTrack)) {
  if (count < 1) throw new Error(`Knowledge track has no article: ${track}`);
}

if (frontierConfig.schema_version !== "0.1.0") throw new Error("Unexpected Frontier arXiv config schema version");
if (frontierConfig.endpoint !== "https://export.arxiv.org/api/query") throw new Error("Unexpected arXiv endpoint");
if (frontierConfig.fallback_feed !== "https://rss.arxiv.org/rss/cs.RO") throw new Error("Unexpected arXiv RSS fallback");
if (frontierConfig.fallback_listing !== "https://arxiv.org/list/cs.RO/recent?skip=0&show=100") throw new Error("Unexpected arXiv listing fallback");
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
  if (!paper.title || !paper.url || !paper.pdfUrl) throw new Error(`Incomplete Frontier paper: ${paper.id}`);
  if (paper.dateProvenance === "arxiv-api" && (!Number.isFinite(Date.parse(paper.published)) || !Number.isFinite(Date.parse(paper.updated)))) throw new Error(`Invalid API timestamps: ${paper.id}`);
  if (!new Set(["abstract", "listing"]).has(paper.metadataCompleteness)) throw new Error(`Unknown Frontier metadata completeness: ${paper.id}`);
  if (paper.metadataCompleteness === "abstract" && !paper.abstract) throw new Error(`Frontier abstract is missing: ${paper.id}`);
  if (!Array.isArray(paper.authors) || paper.authors.length === 0) throw new Error(`Frontier paper has no authors: ${paper.id}`);
  if (!Array.isArray(paper.routes) || paper.routes.length === 0 || paper.routes.some((route) => !paperRoutes.has(route))) throw new Error(`Invalid Frontier route: ${paper.id}`);
  if (!Array.isArray(paper.matchedTopics) || paper.matchedTopics.length === 0) throw new Error(`Frontier paper has no topic match: ${paper.id}`);
  if (paper.matchedTopics.some((topic) => !topicRuleIds.has(topic.id))) throw new Error(`Unknown Frontier topic match: ${paper.id}`);
  if (!Number.isInteger(paper.triageScore) || paper.triageScore < frontierConfig.min_triage_score) throw new Error(`Invalid Frontier triage score: ${paper.id}`);
  if (!paperStatuses.has(paper.status)) throw new Error(`Invalid Frontier paper status: ${paper.id}`);
}

process.stdout.write(`Validated ${atlas.tracks.length} tracks, ${catalog.nodes.length} catalog nodes, ${sources.sources.length} sources, ${jobs.jobs.length} ingestion jobs, ${fieldGuides.records.length} field-guide records, ${knowledge.articles.length} knowledge articles, ${hardwarePrices.snapshots.length} hardware price snapshots, ${venueRegistry.venues.length} venue records, ${workIdentities.works.length} work identities, ${controlExperiments.experiments.length} control experiment protocols, ${benchmarkRegistry.records.length} benchmark/dataset records, ${frontierPapers.papers.length} Frontier candidates, and ${requiredFiles.length} required files.\n`);
