import { searchRecords, excerpt, typeLabels, trackLabels } from "./engine.js";
const form = document.querySelector("#search-form");
const query = document.querySelector("#query");
const track = document.querySelector("#track");
const type = document.querySelector("#type");
const results = document.querySelector("#results");
const status = document.querySelector("#result-status");
const more = document.querySelector("#more");
let records = [];
let limit = 20;
let ready = false;
function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
for (const [select, labels] of [[track, trackLabels], [type, typeLabels]]) {
  for (const [value, label] of Object.entries(labels)) {
    const option = element("option", label);
    option.value = value;
    select.append(option);
  }
}
function restore() {
  const params = new URLSearchParams(location.search);
  query.value = (params.get("q") ?? "").slice(0, 300);
  track.value = trackLabels[params.get("track")] ? params.get("track") : "all";
  type.value = typeLabels[params.get("type")] ? params.get("type") : "all";
}
function render() {
  if (!ready) return;
  const matches = searchRecords(records, { q: query.value, track: track.value, type: type.value });
  results.replaceChildren();
  for (const record of matches.slice(0, limit)) {
    const card = element("article", "", "search-result");
    const meta = element("div", "", "result-meta");
    meta.append(element("span", typeLabels[record.type], "kind"), element("span", record.tracks.map((id) => trackLabels[id]).join(" / ")));
    if (record.updated_at) meta.append(element("span", `${record.date_label ?? "记录日期"} ${record.updated_at.slice(0, 10)}`));
    const heading = element("h2", "");
    const link = element("a", record.title);
    link.href = record.url;
    if (record.url.startsWith("https://")) { link.target = "_blank"; link.rel = "noreferrer"; link.append(" ↗"); }
    heading.append(link);
    card.append(meta, heading, element("p", record.summary, "result-summary"));
    if (query.value.trim()) card.append(element("p", excerpt(record, query.value), "result-excerpt"));
    card.append(element("p", record.evidence, "evidence-label"));
    results.append(card);
  }
  status.textContent = `${matches.length} 条匹配 · 已显示 ${Math.min(limit, matches.length)} 条 · 索引共 ${records.length} 条`;
  document.querySelector("#empty").hidden = matches.length !== 0;
  more.hidden = matches.length <= limit;
}
function update() {
  limit = 20;
  const params = new URLSearchParams();
  if (query.value.trim()) params.set("q", query.value.trim());
  if (track.value !== "all") params.set("track", track.value);
  if (type.value !== "all") params.set("type", type.value);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
  render();
}
form.addEventListener("submit", (event) => { event.preventDefault(); update(); });
let timer;
query.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 150); });
track.addEventListener("change", update);
type.addEventListener("change", update);
document.querySelector("#clear").addEventListener("click", () => { query.value = ""; track.value = "all"; type.value = "all"; update(); query.focus(); });
more.addEventListener("click", () => { limit += 20; render(); });
window.addEventListener("popstate", () => { restore(); limit = 20; render(); });
restore();
try {
  const response = await fetch("/atlas/data/search-index.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.schema_version !== "1.0.0" || !Array.isArray(data.records)) throw new Error("Invalid index");
  records = data.records;
  ready = true;
  render();
} catch {
  status.textContent = "索引加载失败。请刷新重试，或通过知识正文与领域目录继续阅读。";
}
