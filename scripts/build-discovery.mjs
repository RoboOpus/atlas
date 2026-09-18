import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeLabels, trackLabels } from "../site/search/engine.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archive = JSON.parse(await readFile(path.join(repo, "content/frontier-archive.json"), "utf8"));
const events = JSON.parse(await readFile(path.join(repo, "content/frontier-events.json"), "utf8"));
const archiveIds = new Set(archive.papers.map((paper) => paper.id));
if (archiveIds.size !== archive.papers.length) throw new Error("Duplicate archive IDs");
for (const paper of archive.papers) {
  if (!/^\d{4}\.\d{4,5}$/.test(paper.id) || !paper.title || !paper.authors?.length || !Number.isFinite(Date.parse(paper.firstSeen))) throw new Error(`Invalid archived metadata: ${paper.id}`);
  if (!["candidate", "reviewing", "verified", "reviewed", "ignored"].includes(paper.status)) throw new Error(`Invalid archived state: ${paper.id}`);
  if (!["arxiv-api", "rss-announcement", "listing-announcement", "legacy-unverified"].includes(paper.dateProvenance)) throw new Error(`Invalid date provenance: ${paper.id}`);
  if (paper.dateProvenance === "arxiv-api" && (!Number.isFinite(Date.parse(paper.published)) || !Number.isFinite(Date.parse(paper.updated)))) throw new Error(`Invalid archive API timestamps: ${paper.id}`);
  if (!paper.url.startsWith("https://arxiv.org/abs/") || !paper.pdfUrl.startsWith("https://arxiv.org/pdf/")) throw new Error(`Invalid archived arXiv link: ${paper.id}`);
}
if (new Set(events.events.map((event) => event.id)).size !== events.events.length) throw new Error("Duplicate discovery events");
for (const event of events.events) {
  if (!["baseline", "discovery"].includes(event.kind) || !Number.isFinite(Date.parse(event.at))) throw new Error("Invalid discovery event");
  if ([...(event.added ?? []), ...(event.updated ?? []), ...(event.baseline_ids ?? [])].some((id) => !archiveIds.has(id))) throw new Error("Event references missing archive paper");
}
for (const [name, data] of [["frontier-archive", archive], ["frontier-events", events]]) await writeFile(path.join(repo, "site/data", `${name}.json`), JSON.stringify(data, null, 2) + "\n");
const read = async (name) => JSON.parse(await readFile(path.join(repo, "site/data", `${name}.json`), "utf8"));
const [knowledge, guides, catalog, sources, frontier, benchmarks, experiments, works, prices, venues, jobs] = await Promise.all([
  "knowledge", "field-guides", "catalog", "sources", "frontier-papers", "benchmark-registry",
  "control-experiments", "work-identities", "hardware-price-snapshots", "venue-registry", "ingestion-jobs"
].map(read));
const records = [];
const reading = await read("reading-notes");
if (frontier.papers.some((paper) => !archiveIds.has(paper.id))) throw new Error("Radar window contains a paper missing from the durable archive");
const flatten = (value) => typeof value === "string" ? value : Array.isArray(value) ? value.map(flatten).join(" ") : value && typeof value === "object" ? Object.values(value).map(flatten).join(" ") : "";
function add(type, item, options) {
  records.push({
    id: `${type}:${item.id}`, type, title: item.title ?? item.name ?? item.product,
    tracks: [item.track ?? "frontier"], summary: item.summary ?? item.best_for ?? item.focus ?? "",
    text: flatten(item).replace(/\s+/gu, " ").trim(), updated_at: null,
    evidence: "结构化整理 · 未标记人工终审", ...options
  });
}
for (const note of reading.notes) add("note", note, { url: note.url, updated_at: note.checked_at, date_label: "来源核对", evidence: "原创来源笔记 · 未经人工终审" });
for (const article of knowledge.articles) {
  const target = path.resolve(repo, article.source_file);
  if (!target.startsWith(path.join(repo, "content/knowledge") + path.sep)) throw new Error(`Unsafe article source: ${article.id}`);
  const markdown = await readFile(target, "utf8");
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "").replace(/[`#*]/g, "").replace(/\s+/gu, " ").trim();
  add("article", article, { url: article.url, text: body, updated_at: article.updated_at, evidence: article.human_reviewed && article.editorial_state === "reviewed" ? "人工已复核" : "来源已核对 · 待人工复核" });
}
for (const guide of guides.records) add("guide", guide, { url: `/atlas/${guide.track}/#${encodeURIComponent(guide.id)}`, updated_at: guides.updated_at });
for (const node of catalog.nodes) add("node", node, { url: `/atlas/catalog/?track=${node.track}#${encodeURIComponent(node.id)}`, evidence: "知识树节点 · 不代表已有完整正文", updated_at: catalog.updated_at });
for (const source of sources.sources) add("source", source, { url: source.url, evidence: source.official ? "第一方来源入口 · 非结论背书" : "发现线索 · 需回溯一手证据" });
for (const paper of archive.papers) add("paper", paper, { url: paper.url, tracks: [...new Set(["frontier", ...paper.routes])], summary: paper.abstract ? "预印本候选；下方为作者摘要检索片段，不是本站评审结论。" : "标题级元数据候选；摘要尚未补齐。", evidence: `候选 · ${paper.metadataCompleteness === "abstract" ? "含作者摘要" : "仅列表元数据"}`, updated_at: paper.firstSeen, date_label: "首次收录" });
for (const item of benchmarks.records) add("benchmark", item, { tracks: ["robotics", "wam"], url: `/atlas/robotics/benchmarks/#${encodeURIComponent(item.id)}`, updated_at: benchmarks.updated_at });
for (const item of experiments.experiments) add("experiment", item, { url: `/atlas/robotics/control-lab/#${encodeURIComponent(item.id)}`, evidence: `实验状态：${item.readiness} · 协议不等于结果`, updated_at: experiments.updated_at });
for (const item of works.works) add("work", item, { tracks: ["frontier", ...item.routes], url: item.canonical_url, summary: item.notes, updated_at: item.checked_at, evidence: `身份关联：${item.identity_state} · 非质量评级` });
for (const item of prices.snapshots) add("price", item, { tracks: ["hardware"], title: `${item.product} · ${item.variant}`, url: item.source_url, summary: `${item.price ?? "未知价格"} ${item.currency} · ${item.region} · 税：${item.tax} · 运费：${item.freight}`, updated_at: item.captured_at, date_label: "价格快照", evidence: "历史价格快照 · 非实时报价" });
for (const item of venues.venues) add("venue", item, { tracks: ["frontier", ...item.relevance_routes], url: item.venue_url, summary: item.collection_note, updated_at: item.checked_at, evidence: `采集状态：${item.paper_ingestion} · Group 可访问不代表论文公开` });

const seen = new Set();
for (const item of records) {
  if (seen.has(item.id)) throw new Error(`Duplicate search ID: ${item.id}`);
  seen.add(item.id);
  if (!item.title || !typeLabels[item.type] || !item.tracks.every((track) => trackLabels[track])) throw new Error(`Invalid search record: ${item.id}`);
  if (item.url.startsWith("/atlas/")) {
    const url = new URL(item.url, "https://roboopus.github.io");
    await access(path.join(repo, "site", url.pathname.slice(7), "index.html"));
  } else if (!item.url.startsWith("https://")) throw new Error(`Unsafe search URL: ${item.id}`);
}
records.sort((a, b) => a.id.localeCompare(b.id));
const maintenance = {
  schema_version: "1.0.0",
  policy: "构建时统计公开仓库快照；不是实时网络健康检查，不代表人工审核完成。日期取源字段，不把构建日期伪装成核验日期。",
  archive: { count: archive.papers.length, window_count: frontier.papers.length, created_at: archive.created_at, last_success_at: archive.last_success_at, events: events.events.length },
  coverage: Object.keys(trackLabels).map((track) => {
    const nodes = catalog.nodes.filter((node) => node.track === track);
    const articles = knowledge.articles.filter((article) => article.track === track);
    return { track, nodes: nodes.length, articles: articles.length, guides: guides.records.filter((guide) => guide.track === track).length,
      nodes_without_article: nodes.filter((node) => !articles.some((article) => article.node_ids.includes(node.id))).map(({ id, title }) => ({ id, title })),
      note: track === "wam" ? "这里只统计 Atlas 本地条目；统一检索另外按需加载 WAM 的论文、正文、地图与 Benchmark。加载状态在搜索页单独显示，不把跨站数量当成本地覆盖。" : track === "lab" ? "等待用户提供可公开履历与项目材料；不生成虚构个人内容。" : "没有正文不等于没有领域卡片或外部来源。" };
  }),
  review_queue: knowledge.articles.filter((article) => !article.human_reviewed || article.editorial_state !== "reviewed").map(({ id, title, url, updated_at, editorial_state }) => ({ id, title, url, updated_at, editorial_state })),
  prices: prices.snapshots.map(({ id, product, variant, captured_at, source_url }) => ({ id, title: `${product} · ${variant}`, checked_at: captured_at, url: source_url })),
  feeds: [{ id: "arxiv", title: "Frontier arXiv", checked_at: frontier.generated_at, count: frontier.papers.length, mode: frontier.source.mode, url: "/atlas/frontier/", threshold_days: 3 },
    { id: "openreview", title: "OpenReview 会议元数据", checked_at: venues.generated_at, count: venues.venues.length, url: "/atlas/frontier/venues/", threshold_days: 10 }],
  jobs: jobs.jobs.map(({ id, title, status, next_action, detail_url }) => ({ id, title, status, next_action, url: detail_url ?? "/atlas/pipeline/" }))
};
for (const [filename, data] of [["search-index", { schema_version: "1.0.0", scope: "Atlas public content snapshot. The search UI separately loads the WAM public index; this JSON does not embed WAM records.", records }], ["maintenance", maintenance]]) {
  await writeFile(path.join(repo, "site/data", `${filename}.json`), JSON.stringify(data, null, 2) + "\n");
}
console.log(`Built unified search: ${records.length} records in ${new Set(records.map((item) => item.type)).size} types; maintenance: ${maintenance.review_queue.length} articles awaiting review.`);
