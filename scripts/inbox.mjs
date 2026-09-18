import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newInboxRecord, validateAnnotation, publicProjection, publicUrl, sourceUrl } from "./inbox-core.mjs";
import { readPageMetadata } from "./public-page.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inbox = path.join(repo, "private-cache/inbox");
const published = path.join(repo, "content/reading-notes");
const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const exists = async (file) => { try { await access(file); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } };
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const save = async (file, value, options = {}) => writeFile(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, ...options });
const idPath = (id) => { if (!/^url-[a-f0-9]{20}$/.test(id ?? "")) throw new Error("Use an inbox ID returned by add/import/list"); return path.join(inbox, `${id}.json`); };
const now = () => new Date().toISOString();
async function annotateHistory(record, action) { record.updated_at = now(); record.history.push({ at: record.updated_at, action }); await save(idPath(record.id), record); }

try {
  await mkdir(inbox, { recursive: true });
  if (command === "add" || command === "import") {
    const request = command === "import" ? await json(path.resolve(flag("file") ?? "")) : { url: flag("url"), track: flag("track") ?? "frontier", intent: flag("intent") ?? "" };
    const record = newInboxRecord(request);
    const target = idPath(record.id);
    if (await exists(target)) console.log(`Already in private inbox: ${record.id}. Existing notes preserved.`);
    else { await save(target, record, { flag: "wx" }); console.log(`Private inbox created: ${record.id} (${record.access_mode}). Nothing published.`); }
  } else if (command === "list") {
    for (const file of (await readdir(inbox)).filter((name) => /^url-[a-f0-9]{20}\.json$/.test(name)).sort()) {
      const record = await json(path.join(inbox, file));
      // No full URLs, intents or titles in routine logs; those may be private.
      console.log(`${record.id}\t${record.track}\t${record.state}\t${record.access_mode}`);
    }
  } else if (["fetch", "template", "annotate", "preview", "publish"].includes(command)) {
    const record = await json(idPath(flag("id")));
    if (record.id !== flag("id")) throw new Error("Inbox identity mismatch");
    if (command === "fetch") {
      if (record.access_mode !== "public-metadata") throw new Error("Single-link browser assistance required. Do not export cookies or raw logged-in HTML.");
      try {
        record.metadata = { ...await readPageMetadata(record.url), fetched_at: now() };
        if (record.state === "inbox" || record.state === "needs-assistance") record.state = "metadata-ready";
        await annotateHistory(record, "public-metadata-fetched");
        console.log(`Metadata retained locally for ${record.id}; no page body saved and nothing published.`);
      } catch (error) {
        if (!record.annotation) record.state = "needs-assistance";
        await annotateHistory(record, "metadata-fetch-failed");
        throw error;
      }
    } else if (command === "template") {
      const template = path.join(inbox, `${record.id}.annotation.json`);
      let cleanUrl = ""; try { cleanUrl = publicUrl(record.metadata?.url ?? record.url); } catch { /* User supplies a clean permalink. */ }
      await save(template, { title: record.metadata?.title ?? "", summary: "", public_url: cleanUrl, source_author: "", source_published_at: null, checked_at: now().slice(0, 10), source_type: "website", rights: "original-notes-with-links", claims: [{ kind: "source-statement", text: "", evidence_url: cleanUrl }], limitations: [""], tags: [] }, { flag: "wx" });
      console.log(`Edit the local annotation template: ${template}. Existing templates are never overwritten.`);
    } else if (command === "annotate") {
      if (!flag("file")) throw new Error("Provide --file with your original evidence-linked note");
      record.annotation = validateAnnotation(await json(path.resolve(flag("file"))));
      const publicLink = sourceUrl(record.annotation.public_url);
      const matches = [record.url, record.metadata?.url].filter(Boolean).some((value) => { const original = sourceUrl(value); return original.origin === publicLink.origin && original.pathname === publicLink.pathname; });
      if (!matches) throw new Error("Public permalink must match the supplied or fetched page; add a new inbox entry for a different page");
      record.state = "annotated";
      await annotateHistory(record, "original-note-attached");
      console.log(`Validated original note for ${record.id}; still private and not human-reviewed.`);
    } else {
      const output = publicProjection(record);
      if (command === "preview") console.log(JSON.stringify(output, null, 2));
      else {
        if (!args.includes("--public")) throw new Error("Publishing requires --public after inspecting preview. This exports an unreviewed public draft, not a human-reviewed conclusion.");
        await mkdir(published, { recursive: true });
        const target = path.join(published, `${record.id}.json`);
        // Existing public notes require an explicit revision in source control, not accidental CLI overwrite.
        await save(target, output, { flag: "wx" });
        record.state = "exported-public-draft";
        await annotateHistory(record, "public-draft-exported");
        console.log(`Public draft exported: content/reading-notes/${record.id}.json. Run build/test and review the git diff before deploying.`);
      }
    }
  } else {
    console.log(`RoboOpus single-link inbox (private by default)
  npm run inbox -- add --url=https://public.example/path --track=robotics
  npm run inbox -- import --file=path/to/roboopus-inbox-request.json
  npm run inbox -- list
  npm run inbox -- fetch --id=url-...
  npm run inbox -- template --id=url-...
  npm run inbox -- annotate --id=url-... --file=private-cache/inbox/url-....annotation.json
  npm run inbox -- preview --id=url-...
  npm run inbox -- publish --id=url-... --public

WeChat/Xiaohongshu/login pages: single-link browser assistance only.
No auto-submit, no login bypass, no automatic human-reviewed status.`);
    if (command && command !== "help") process.exitCode = 1;
  }
} catch (error) { console.error(`Inbox: ${error.message}`); process.exitCode = 1; }
