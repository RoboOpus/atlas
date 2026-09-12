import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(repo, "site", "data", "atlas.json");
const catalogPath = path.join(repo, "site", "data", "catalog.json");
const sourcesPath = path.join(repo, "site", "data", "sources.json");
const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "site/data/atlas.json",
  "site/data/catalog.json",
  "site/data/sources.json",
  "site/catalog/index.html",
  "site/catalog/catalog.css",
  "site/catalog/catalog.js",
  "site/sources/index.html",
  "site/sources/sources.css",
  "site/sources/sources.js",
  "content/catalog-schema.md",
  "content/source-registry-schema.md",
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
const allowedStatuses = new Set(["live", "seeded", "planned", "awaiting-source-material"]);

if (atlas.repository !== "RoboOpus/atlas") throw new Error("Unexpected Atlas repository target");
if (!Array.isArray(atlas.tracks) || atlas.tracks.length !== 6) throw new Error("Atlas must contain exactly six top-level tracks");

const ids = new Set();
for (const track of atlas.tracks) {
  if (!track.id || ids.has(track.id)) throw new Error(`Missing or duplicate track id: ${track.id}`);
  ids.add(track.id);
  if (!track.repository.startsWith("RoboOpus/")) throw new Error(`Repository outside RoboOpus: ${track.repository}`);
  if (track.repository === "RoboOpus/RoboOpus.github.io") throw new Error("Organization Pages repository is protected");
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
if (sources.verified_at !== "2026-09-12") throw new Error("Source registry verification date is stale or unexpected");
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

process.stdout.write(`Validated ${atlas.tracks.length} tracks, ${catalog.nodes.length} catalog nodes, ${sources.sources.length} trusted sources, and ${requiredFiles.length} required files.\n`);
