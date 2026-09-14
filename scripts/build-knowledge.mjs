import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputDir = path.join(repo, "content", "knowledge");
const outputDir = path.join(repo, "site", "knowledge");
const sourceData = JSON.parse(await readFile(path.join(repo, "site", "data", "sources.json"), "utf8"));
const catalogData = JSON.parse(await readFile(path.join(repo, "site", "data", "catalog.json"), "utf8"));
const hardwarePriceData = JSON.parse(await readFile(path.join(repo, "content", "hardware-price-snapshots.json"), "utf8"));
const venueRegistryData = JSON.parse(await readFile(path.join(repo, "content", "venue-registry.json"), "utf8"));
const workIdentityData = JSON.parse(await readFile(path.join(repo, "content", "work-identities.json"), "utf8"));
const sourcesById = new Map(sourceData.sources.map((source) => [source.id, source]));
const nodesById = new Map(catalogData.nodes.map((node) => [node.id, node]));
const trackLabels = { robotics: "Robotics", hardware: "Hardware", adjacent: "Adjacent", frontier: "Frontier", lab: "Lab" };
const stateLabels = { "source-checked-draft": "来源已核对 · 待人工复核", reviewed: "人工已复核" };

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return value
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "") || "section";
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[S(\d+)\]/g, '<a class="source-ref" href="#source-$1">[S$1]</a>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  const headings = [];
  let paragraph = [];
  let listType = null;
  let code = null;
  let codeLanguage = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    if (code !== null) {
      if (line.startsWith("```")) {
        html.push(`<pre class="${codeLanguage === "math" ? "math-block" : ""}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
        codeLanguage = "";
      } else code.push(line);
      continue;
    }
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      closeList();
      code = [];
      codeLanguage = fence[1].trim();
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slugify(title);
      headings.push({ level, title, id });
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(title)}</h${level}>`);
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = ordered ? "ol" : "ul";
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${inline((ordered ?? unordered)[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  if (code !== null) throw new Error("Unclosed code fence in knowledge article");
  return { html: html.join("\n"), headings };
}

function parseArticle(text, filename) {
  const match = text.replaceAll("\r\n", "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
  if (!match) throw new Error(`Missing JSON front matter: ${filename}`);
  return { meta: JSON.parse(match[1]), body: match[2].trim() };
}

function pageShell({ title, description, body }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#f4f0e8">
    <title>${escapeHtml(title)} · RoboOpus Atlas</title>
    <link rel="stylesheet" href="/atlas/styles.css">
    <link rel="stylesheet" href="/atlas/catalog/catalog.css">
    <link rel="stylesheet" href="/atlas/knowledge/knowledge.css">
  </head>
  <body>${body}</body>
</html>\n`;
}

const files = (await readdir(inputDir)).filter((file) => file.endsWith(".md")).sort();
const articles = [];

for (const filename of files) {
  const { meta, body } = parseArticle(await readFile(path.join(inputDir, filename), "utf8"), filename);
  const required = ["id", "slug", "track", "category", "title", "summary", "difficulty", "editorial_state", "updated_at"];
  for (const field of required) if (!meta[field]) throw new Error(`Missing ${field} in ${filename}`);
  if (!trackLabels[meta.track]) throw new Error(`Unknown track in ${filename}: ${meta.track}`);
  if (!stateLabels[meta.editorial_state]) throw new Error(`Unknown editorial state in ${filename}: ${meta.editorial_state}`);
  if (meta.editorial_state === "reviewed" && meta.human_reviewed !== true) throw new Error(`Reviewed article lacks human review flag: ${filename}`);
  if (!Array.isArray(meta.source_ids) || !meta.source_ids.length) throw new Error(`Missing sources in ${filename}`);
  if (!Array.isArray(meta.node_ids) || !meta.node_ids.length) throw new Error(`Missing nodes in ${filename}`);
  const articleSources = meta.source_ids.map((id) => {
    const source = sourcesById.get(id);
    if (!source) throw new Error(`Unknown source ${id} in ${filename}`);
    return source;
  });
  const articleNodes = meta.node_ids.map((id) => {
    const node = nodesById.get(id);
    if (!node) throw new Error(`Unknown node ${id} in ${filename}`);
    return node;
  });
  const rendered = renderMarkdown(body);
  const plainLength = body.replace(/[`#*\[\]()>-]/g, "").length;
  const readingMinutes = Math.max(2, Math.ceil(plainLength / 500));
  const url = `/atlas/knowledge/${meta.slug}/`;
  const sourceItems = articleSources.map((source, index) => `<li id="source-${index + 1}"><span>S${index + 1}</span><div><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)} ↗</a><p>${escapeHtml(source.owner)} · ${escapeHtml(source.best_for)}</p></div></li>`).join("\n");
  const tocItems = rendered.headings.filter((heading) => heading.level === 2).map((heading) => `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`).join("\n");
  const nodeLinks = articleNodes.map((node) => `<a href="/atlas/catalog/?track=${escapeHtml(node.track)}">${escapeHtml(node.title)}</a>`).join("");
  const takeaways = (meta.takeaways ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const prerequisites = (meta.prerequisites ?? []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");

  const articleBody = `
    <header class="topbar">
      <a class="wordmark" href="/atlas/knowledge/" aria-label="返回知识正文"><span class="mark">R/O</span><span>Knowledge</span></a>
      <nav aria-label="知识正文导航"><a href="/atlas/">Atlas</a><a href="/atlas/knowledge/">全部正文</a><a href="/atlas/robotics/">Robotics</a><a href="/atlas/hardware/">Hardware</a><a href="/atlas/adjacent/">Adjacent</a></nav>
    </header>
    <main class="article-main">
      <header class="article-header">
        <p class="eyebrow">${escapeHtml(trackLabels[meta.track])} · ${escapeHtml(meta.category)}</p>
        <h1>${escapeHtml(meta.title)}</h1>
        <p class="article-summary">${escapeHtml(meta.summary)}</p>
        <div class="article-meta"><span>${escapeHtml(stateLabels[meta.editorial_state])}</span><span>${escapeHtml(meta.difficulty)}</span><span>约 ${readingMinutes} 分钟</span><span>更新 ${escapeHtml(meta.updated_at)}</span></div>
        <div class="article-prerequisites"><strong>前置</strong>${prerequisites || "<span>无</span>"}</div>
      </header>
      <div class="article-layout">
        <aside class="article-toc"><strong>本文目录</strong>${tocItems}<a href="#evidence">来源与证据</a></aside>
        <article class="article-content">
          <section class="takeaway-box"><strong>读完应带走</strong><ul>${takeaways}</ul></section>
          ${rendered.html}
          <section id="evidence" class="evidence-section"><h2>来源与证据</h2><p>正文为 RoboOpus 的原创整理；以下是一手来源。当前状态尚未经过人工终审。</p><ol>${sourceItems}</ol></section>
          <section class="node-section"><strong>连接的知识节点</strong><div>${nodeLinks}</div></section>
        </article>
      </div>
    </main>
    <footer><p>RoboOpus Atlas · Source-backed knowledge</p><p><a href="/atlas/data/knowledge.json">机器可读正文索引</a></p></footer>`;

  await mkdir(path.join(outputDir, meta.slug), { recursive: true });
  await writeFile(path.join(outputDir, meta.slug, "index.html"), pageShell({ title: meta.title, description: meta.summary, body: articleBody }), "utf8");
  articles.push({ ...meta, source_file: `content/knowledge/${filename}`, url, reading_minutes: readingMinutes, source_count: articleSources.length, node_count: articleNodes.length });
}

articles.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.track.localeCompare(b.track) || a.title.localeCompare(b.title, "zh-CN"));
const cards = articles.map((article) => {
  const searchText = [article.title, article.summary, article.category, article.track, ...(article.takeaways ?? [])].join(" ");
  return `<article class="knowledge-card" data-track="${escapeHtml(article.track)}" data-search="${escapeHtml(searchText.toLocaleLowerCase("zh-CN"))}">
    <div class="knowledge-card-top"><span>${escapeHtml(trackLabels[article.track])} · ${escapeHtml(article.category)}</span><span>${escapeHtml(article.difficulty)}</span></div>
    <h2><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a></h2>
    <p>${escapeHtml(article.summary)}</p>
    <div class="knowledge-card-facts"><span>${article.source_count} 个一手来源</span><span>${article.node_count} 个知识节点</span><span>${article.reading_minutes} 分钟</span></div>
    <a class="knowledge-open" href="${escapeHtml(article.url)}">阅读正文 →</a>
  </article>`;
}).join("\n");

const indexBody = `
  <header class="topbar">
    <a class="wordmark" href="/atlas/" aria-label="返回 RoboOpus Atlas 首页"><span class="mark">R/O</span><span>Knowledge</span></a>
    <nav aria-label="知识正文导航"><a href="/atlas/">Atlas</a><a href="/atlas/knowledge/">全部正文</a><a href="/atlas/robotics/">Robotics</a><a href="/atlas/hardware/">Hardware</a><a href="/atlas/adjacent/">Adjacent</a></nav>
  </header>
  <main class="knowledge-main">
    <section class="knowledge-intro"><div><p class="eyebrow">Knowledge units · source backed</p><h1>知识正文</h1></div><p>这里不是目录槽位，而是可阅读、可引用、可继续修订的知识单元。每篇都公开来源、知识节点、编辑状态和更新时间。</p></section>
    <section class="knowledge-controls" aria-label="知识正文筛选">
      <label class="search-field"><span>搜索正文</span><input id="knowledge-search" type="search" placeholder="例如：SE(3)、状态估计、机械臂、迁移" autocomplete="off"></label>
      <div class="filter-row" aria-label="按板块筛选"><button type="button" data-track="all" class="active">全部</button><button type="button" data-track="robotics">Robotics</button><button type="button" data-track="hardware">Hardware</button><button type="button" data-track="adjacent">Adjacent</button></div>
      <div class="result-line"><strong id="knowledge-count">${articles.length} / ${articles.length} 篇正文</strong><span>来源已核对不等于人工终审。</span></div>
    </section>
    <section id="knowledge-grid" class="knowledge-grid" aria-label="知识正文列表">${cards}</section>
    <div id="knowledge-empty" class="catalog-empty" hidden><strong>没有匹配正文</strong><p>换一个关键词，或切回“全部”。</p></div>
  </main>
  <footer><p>RoboOpus Atlas · 内容与页面同步生长</p><p><a href="/atlas/data/knowledge.json">机器可读正文索引</a></p></footer>
  <script src="/atlas/knowledge/knowledge.js"></script>`;

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "index.html"), pageShell({ title: "知识正文", description: "RoboOpus Atlas 具身智能与机器人知识正文。", body: indexBody }), "utf8");
await writeFile(path.join(repo, "site", "data", "knowledge.json"), `${JSON.stringify({ schema_version: "0.1.0", updated_at: articles[0]?.updated_at ?? null, articles }, null, 2)}\n`, "utf8");
await writeFile(path.join(repo, "site", "data", "hardware-price-snapshots.json"), `${JSON.stringify(hardwarePriceData, null, 2)}\n`, "utf8");
await writeFile(path.join(repo, "site", "data", "venue-registry.json"), `${JSON.stringify(venueRegistryData, null, 2)}\n`, "utf8");
await writeFile(path.join(repo, "site", "data", "work-identities.json"), `${JSON.stringify(workIdentityData, null, 2)}\n`, "utf8");
process.stdout.write(`Built ${articles.length} source-backed knowledge articles, ${hardwarePriceData.snapshots?.length ?? 0} hardware price snapshots, ${venueRegistryData.venues?.length ?? 0} venue records, and ${workIdentityData.works?.length ?? 0} work identities.\n`);
