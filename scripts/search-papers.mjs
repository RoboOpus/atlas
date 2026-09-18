import { readFile, writeFile, readdir, mkdir, open, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchRequest, requestPapers, parseSearchFeed, selectedBatch, validateBatch, paperFingerprint } from "./paper-search-core.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(repo, "private-cache/paper-search"), publicFolder = path.join(repo, "content/paper-selections");
const args = process.argv.slice(2), command = args[0] ?? "help";
const flag = (key) => args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const save = async (file, data) => writeFile(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const runPath = (id) => { if (!/^search-[a-f0-9-]{36}$/.test(id ?? "")) throw new Error("Use a search run ID returned by run/list"); return path.join(cache, `${id}.json`); };
async function filenames(folder) { try { return (await readdir(folder)).filter((name) => name.endsWith(".json")).sort(); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
const commands = { run: ["query", "track", "limit", "start", "sort", "since", "until", "input-file"], list: [], show: ["run"], preview: ["run", "ids"], publish: ["run", "ids", "public"], help: [] };
try {
  if (!commands[command]) throw new Error("Unknown command; use help");
  const seenFlags = new Set();
  for (const arg of args.slice(1)) {
    const name = arg.match(/^--([a-z-]+)(?:=|$)/)?.[1];
    if (!commands[command].includes(name) || seenFlags.has(name) || (name !== "public" && !arg.includes("=")) || (name === "public" && arg !== "--public")) throw new Error(`Invalid or duplicate flag: ${name ?? "argument"}`);
    seenFlags.add(name);
  }
  if (command === "run") {
    const request = searchRequest({ query: flag("query"), track: flag("track"), limit: flag("limit"), start: flag("start"), sort: flag("sort"), since: flag("since"), until: flag("until") });
    await mkdir(cache, { recursive: true });
    const id = `search-${randomUUID()}`, startedAt = new Date().toISOString();
    const run = { schema_version: "1.0.0", id, visibility: "private", request, started_at: startedAt, state: "pending", source_mode: flag("input-file") ? "fixture" : "arxiv-api", papers: [] };
    const lockPath = path.join(cache, "request.lock"); let lock;
    try {
      if (flag("input-file")) Object.assign(run, parseSearchFeed(await readFile(path.resolve(flag("input-file")), "utf8")));
      else {
        try { lock = await open(lockPath, "wx"); } catch (error) { if (error.code === "EEXIST") throw new Error("Search lock exists. Check for a live request or a stale lock before retrying; do not run concurrent arXiv clients."); throw error; }
        let last = 0;
        try { last = Number(await readFile(path.join(cache, "last-request.txt"), "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
        if (!Number.isFinite(last)) throw new Error("Invalid request cooldown state");
        const wait = Math.max(0, 3000 - (Date.now() - last));
        if (wait > 3000) throw new Error("Request clock is ahead; inspect the clock before retrying");
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        try { Object.assign(run, await requestPapers(request)); }
        finally { await writeFile(path.join(cache, "last-request.txt"), String(Date.now()), { mode: 0o600 }); }
      }
      run.state = run.papers.length ? "success" : "empty";
      run.finished_at = new Date().toISOString();
      await save(runPath(id), run);
      console.log(`${id}\t${run.state}\treturned=${run.papers.length}\ttotal=${run.total}\tprivate; nothing published`);
    } catch (error) {
      run.state = "failed"; run.finished_at = new Date().toISOString(); run.error = error.message;
      await save(runPath(id), run);
      console.error(`${id}\tfailed; private error record saved; nothing published`); process.exitCode = 1;
    } finally { if (lock) { await lock.close(); await unlink(lockPath); } }
  } else if (command === "list") {
    for (const file of (await filenames(cache)).filter((name) => /^search-[a-f0-9-]{36}\.json$/.test(name))) {
      const run = await json(path.join(cache, file)); console.log(`${run.id}\t${run.state}\t${run.papers.length}\t${run.started_at}`);
    }
  } else if (["show", "preview", "publish"].includes(command)) {
    const run = await json(runPath(flag("run")));
    if (run.schema_version !== "1.0.0" || run.id !== flag("run")) throw new Error("Run identity mismatch");
    if (command === "show") console.log(JSON.stringify({ id: run.id, state: run.state, source_mode: run.source_mode, total: run.total, error: run.error ?? null, papers: run.papers.map(({ id, title, published, url }) => ({ id, title, published, url })) }, null, 2));
    else {
      const ids = flag("ids")?.split(",").map((id) => id.trim());
      const batch = selectedBatch(run, ids, `selection-${randomUUID()}`, new Date().toISOString());
      if (command === "preview") console.log(JSON.stringify(batch, null, 2));
      else {
        if (!args.includes("--public")) throw new Error("Inspect preview first, then supply --public to export selected candidate metadata");
        const prior = (await Promise.all((await filenames(publicFolder)).map((name) => json(path.join(publicFolder, name))))).map(validateBatch);
        batch.papers = batch.papers.filter((paper) => !prior.some((old) => old.track === batch.track && old.papers.some((item) => item.id === paper.id && paperFingerprint(item) === paperFingerprint(paper))));
        if (!batch.papers.length) console.log("Selected metadata already published for this track; no files changed.");
        else {
          await mkdir(publicFolder, { recursive: true }); await save(path.join(publicFolder, `${batch.id}.json`), batch);
          console.log(`Exported ${batch.papers.length} candidates: content/paper-selections/${batch.id}.json. Query excluded. Build/test and inspect the diff before deploying.`);
        }
      }
    }
  } else console.log(`On-demand arXiv discovery (private by default; not paper quality ranking)
  npm run papers:search -- run --query='all:"world action model"' --track=wam --limit=10
  Optional: --since=2025-01-01 --until=2026-09-18 --sort=submittedDate --start=0
  npm run papers:search -- list
  npm run papers:search -- show --run=search-...
  npm run papers:search -- preview --run=search-... --ids=2602.15922
  npm run papers:search -- publish --run=search-... --ids=2602.15922 --public
No private query is published. The query IS sent to arXiv. Never include private ideas.
Single page, up to 100 results; serialize with all other arXiv clients. Fixtures cannot publish.`);
} catch (error) { console.error(`Paper search: ${error.message}`); process.exitCode = 1; }
