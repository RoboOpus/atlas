const trackLabels = {
  frontier: "Frontier",
  robotics: "Robotics",
  hardware: "Hardware",
  adjacent: "Adjacent",
  lab: "Lab"
};

const kindLabels = {
  api: "API",
  standard: "标准",
  course: "课程",
  documentation: "文档",
  repository: "仓库",
  vendor: "厂商",
  "open-hardware": "开源硬件",
  dataset: "数据集",
  platform: "内容平台",
  template: "模板"
};

const modeLabels = {
  automatic: "自动接入",
  assisted: "辅助读取",
  manual: "人工核验"
};

const grid = document.querySelector("#source-grid");
const empty = document.querySelector("#source-empty");
const count = document.querySelector("#result-count");
const verifiedDate = document.querySelector("#verified-date");
const search = document.querySelector("#source-search");
const trackButtons = [...document.querySelectorAll("[data-track]")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const query = new URLSearchParams(location.search);
let activeTrack = trackLabels[query.get("track")] ? query.get("track") : "all";
let activeMode = modeLabels[query.get("mode")] ? query.get("mode") : "all";
let sources = [];

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function syncQuery() {
  const nextQuery = new URLSearchParams(location.search);
  if (activeTrack === "all") nextQuery.delete("track");
  else nextQuery.set("track", activeTrack);
  if (activeMode === "all") nextQuery.delete("mode");
  else nextQuery.set("mode", activeMode);
  history.replaceState(null, "", `${location.pathname}${nextQuery.size ? `?${nextQuery}` : ""}`);
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = sources.filter((source) => {
    const inTrack = activeTrack === "all" || source.track === activeTrack;
    const inMode = activeMode === "all" || source.access_mode === activeMode;
    const haystack = [source.name, source.owner, source.kind, source.best_for, source.reuse_note, ...source.tags].join(" ").toLocaleLowerCase("zh-CN");
    return inTrack && inMode && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const source of filtered) {
    const card = document.createElement("article");
    card.className = "source-card";

    const top = document.createElement("div");
    top.className = "source-card-top";
    const badges = document.createElement("div");
    badges.className = "source-badges";
    badges.append(createText("span", `source-badge ${source.access_mode}`, modeLabels[source.access_mode]));
    badges.append(createText("span", "source-badge", kindLabels[source.kind] || source.kind));
    badges.append(createText("span", source.official ? "source-badge official" : "source-badge lead", source.official ? "第一方" : "线索源"));
    top.append(badges, createText("span", "source-track", trackLabels[source.track]));
    card.append(top);
    card.append(createText("h2", "", source.name));
    card.append(createText("p", "source-owner", source.owner));
    card.append(createText("p", "source-best", source.best_for));
    card.append(createText("p", "source-note", `使用边界 · ${source.reuse_note}`));

    const tags = document.createElement("div");
    tags.className = "source-tags";
    for (const tag of source.tags) tags.append(createText("span", "", tag));
    card.append(tags);

    const link = createText("a", "", "访问原始来源 ↗");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    card.append(link);
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${sources.length} 个来源`;
  empty.hidden = filtered.length !== 0;
  trackButtons.forEach((button) => button.classList.toggle("active", button.dataset.track === activeTrack));
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === activeMode));
}

trackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTrack = button.dataset.track;
    syncQuery();
    render();
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeMode = button.dataset.mode;
    syncQuery();
    render();
  });
});

search.addEventListener("input", render);

fetch("/atlas/data/sources.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    verifiedDate.textContent = `全部入口核验于 ${data.verified_at}`;
    sources = data.sources.sort((a, b) => a.track.localeCompare(b.track) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    render();
  })
  .catch(() => {
    count.textContent = "来源加载失败";
    verifiedDate.textContent = "请稍后刷新页面";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取来源数据";
    empty.querySelector("p").textContent = "请稍后刷新页面。";
  });
