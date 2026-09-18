import { searchRecords, excerpt, typeLabels, trackLabels } from "./engine.js";
import { loadWamIndex, mergeIndexes } from "./federation.js";
const form = document.querySelector("#search-form");
const query = document.querySelector("#query");
const track = document.querySelector("#track");
const type = document.querySelector("#type");
const origin = document.querySelector("#origin");
const federationStatus = document.querySelector("#federation-status");
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
  origin.value = ["atlas", "wam"].includes(params.get("origin")) ? params.get("origin") : "all";
}
function render() {
  if (!ready) return;
  const matches = searchRecords(records, { q: query.value, track: track.value, type: type.value, origin: origin.value });
  results.replaceChildren();
  for (const record of matches.slice(0, limit)) {
    const card = element("article", "", "search-result");
    const meta = element("div", "", "result-meta");
    meta.append(element("span", typeLabels[record.type], "kind"), element("span", record.tracks.map((id) => trackLabels[id]).join(" / ")));
    meta.append(element("span", (record.origins ?? ["atlas"]).map((id) => id === "wam" ? "WAM" : "Atlas").join(" + ")));
    if (record.updated_at) meta.append(element("span", `${record.date_label ?? "记录日期"} ${record.updated_at.slice(0, 10)}`));
    const heading = element("h2", "");
    const link = element("a", record.title);
    link.href = record.url;
    if (record.url.startsWith("https://")) { link.target = "_blank"; link.rel = "noreferrer"; link.append(" ↗"); }
    heading.append(link);
    card.append(meta, heading, element("p", record.summary, "result-summary"));
    if (query.value.trim()) card.append(element("p", excerpt(record, query.value), "result-excerpt"));
    card.append(element("p", record.evidence, "evidence-label"));
    for (const source of record.alternate_sources ?? []) {
      const alternate = element("a", `${source.title} ↗`); alternate.href = source.url; alternate.target = "_blank"; alternate.rel = "noreferrer"; card.append(alternate);
    }
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
  if (origin.value !== "all") params.set("origin", origin.value);
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
  render();
}
form.addEventListener("submit", (event) => { event.preventDefault(); update(); });
let timer;
query.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 150); });
track.addEventListener("change", update);
type.addEventListener("change", update);
origin.addEventListener("change", update);
document.querySelector("#clear").addEventListener("click", () => { query.value = ""; track.value = "all"; type.value = "all"; origin.value = "all"; update(); query.focus(); });
more.addEventListener("click", () => { limit += 20; render(); });
window.addEventListener("popstate", () => { restore(); limit = 20; render(); });
restore();
let atlasRecords = [], wamRecords = [], atlasReady = false, wamReady = false;
function refreshSources() { records = mergeIndexes(atlasRecords, wamRecords); ready = atlasReady || wamReady; render(); }
const atlasLoad = (async () => { try {
  const response = await fetch("/atlas/data/search-index.json", { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.schema_version !== "1.0.0" || !Array.isArray(data.records)) throw new Error("Invalid index");
  atlasRecords = data.records; atlasReady = true; refreshSources();
} catch {
  status.textContent = "Atlas 索引加载失败。WAM 若加载成功仍可搜索；也可通过目录继续阅读。";
} })();
const wamLoad = (async () => { try {
  const data = await loadWamIndex(); wamRecords = data.records; wamReady = true; refreshSources();
  federationStatus.textContent = `WAM 已连接：${data.records.length} 条公开资料 · 索引生成 ${data.generated_at.slice(0, 10)} · 来源版本 ${data.source_revision.slice(0, 7)}。私密材料不参与检索。`;
} catch {
  federationStatus.textContent = "WAM 索引暂不可用（网络、超时或格式错误）。目前仅检索成功加载的 Atlas 内容；刷新可重试，不能据此判断 WAM 没有相关资料。";
} })();
await Promise.all([atlasLoad, wamLoad]);
if (!atlasReady && wamReady) federationStatus.textContent += " Atlas 加载失败，当前结果仅来自 WAM。";
if (!atlasReady && !wamReady) status.textContent = "两个索引均未加载成功，请刷新或通过目录继续阅读。";
