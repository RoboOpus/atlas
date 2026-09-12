import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(repo, "site", "data", "atlas.json");
const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "site/data/atlas.json",
  "content/frontier.md",
  "content/robotics.md",
  "content/hardware.md",
  "content/adjacent.md",
  "content/lab.md"
];

for (const file of requiredFiles) await access(path.join(repo, file));
const atlas = JSON.parse(await readFile(dataPath, "utf8"));
const allowedStatuses = new Set(["live", "planned", "awaiting-source-material"]);

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

process.stdout.write(`Validated ${atlas.tracks.length} tracks and ${requiredFiles.length} required files.\n`);
