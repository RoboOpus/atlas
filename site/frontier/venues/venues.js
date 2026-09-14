const grid = document.querySelector("#venue-grid");
const empty = document.querySelector("#venue-empty");
const search = document.querySelector("#venue-search");
const count = document.querySelector("#venue-count");
let venues = [];
let activeDomain = "all";
let activeMode = "all";

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function makeLink(label, href) {
  const link = createText("a", "", label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function ingestionLabel(value) {
  return {
    "ready-public-submissions": "公开投稿可自动发现",
    "metadata-only": "仅会议元数据",
    "manual-proceedings": "官网 / 论文集人工接入"
  }[value] ?? value;
}

function publicLabel(value) {
  if (value === true) return "是";
  if (value === false) return "否";
  return "不适用 / 未知";
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = venues.filter((venue) => {
    const inDomain = activeDomain === "all" || venue.domain === activeDomain;
    const inMode = activeMode === "all" || venue.capture_mode === activeMode;
    const haystack = [venue.family, venue.title, venue.domain, venue.location, venue.group_id ?? "", venue.date_text, ...venue.relevance_routes].join(" ").toLocaleLowerCase("zh-CN");
    return inDomain && inMode && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const venue of filtered) {
    const card = document.createElement("article");
    card.className = "venue-card";
    const top = document.createElement("div");
    top.className = "venue-top";
    top.append(createText("span", "", `${venue.domain} · ${venue.cycle}`), createText("span", "venue-system", venue.capture_mode));
    card.append(top, createText("h2", "", venue.family), createText("p", "venue-title", venue.title));

    const facts = document.createElement("dl");
    facts.className = "venue-facts";
    const rows = [
      ["地点 / 开始", `${venue.location} · ${venue.start_date}`],
      ["投稿时间", venue.date_text],
      ["OpenReview Group", venue.group_id ?? "未配置"],
      ["公开投稿", publicLabel(venue.submissions_public)],
      ["本次核验", `${venue.fetch_state} · ${new Date(venue.checked_at).toLocaleString("zh-CN")}`]
    ];
    for (const [label, value] of rows) facts.append(createText("dt", "", label), createText("dd", "", value));
    card.append(facts);

    const ingestion = document.createElement("div");
    ingestion.className = `venue-ingestion${venue.paper_ingestion === "ready-public-submissions" ? " ready" : ""}`;
    ingestion.append(createText("strong", "", ingestionLabel(venue.paper_ingestion)), createText("p", "", venue.collection_note));
    card.append(ingestion);

    const links = document.createElement("div");
    links.className = "venue-links";
    if (venue.venue_url !== "unknown") links.append(makeLink("会议官网 ↗", venue.venue_url));
    if (venue.group_url) links.append(makeLink("OpenReview Group ↗", venue.group_url));
    for (const route of venue.relevance_routes) links.append(createText("span", "venue-route", route));
    card.append(links);
    grid.append(card);
  }
  count.textContent = `${filtered.length} / ${venues.length} 个会议周期`;
  empty.hidden = filtered.length !== 0;
}

for (const button of document.querySelectorAll("[data-domain]")) {
  button.addEventListener("click", () => {
    activeDomain = button.dataset.domain;
    document.querySelectorAll("[data-domain]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => {
    activeMode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

search.addEventListener("input", render);

fetch("/atlas/data/venue-registry.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    venues = data.venues;
    document.querySelector("#venue-total").textContent = String(venues.length);
    document.querySelector("#fresh-total").textContent = String(venues.filter((venue) => venue.fetch_state === "fresh").length);
    document.querySelector("#ready-total").textContent = String(venues.filter((venue) => venue.paper_ingestion === "ready-public-submissions").length);
    document.querySelector("#venue-updated").textContent = new Date(data.generated_at).toLocaleString("zh-CN");
    render();
  })
  .catch(() => {
    count.textContent = "数据加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取会议注册表";
  });
