const grid = document.querySelector("#work-grid");
const empty = document.querySelector("#work-empty");
const search = document.querySelector("#work-search");
const count = document.querySelector("#work-count");
let works = [];
let activeRoute = "all";
let activeState = "all";

function textElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function externalLink(label, href) {
  const link = textElement("a", "", label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function stateLabel(value) {
  return {
    "arxiv-only": "仅 arXiv",
    "project-linked": "项目已连接",
    "venue-linked": "正式论文集已连接",
    "fully-linked": "主要身份已连接"
  }[value] ?? value;
}

function valueOrUnknown(value) {
  return value || "unknown";
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = works.filter((work) => {
    const inRoute = activeRoute === "all" || work.routes.includes(activeRoute);
    const inState = activeState === "all" || work.identity_state === activeState;
    const haystack = [work.title, work.id, work.year, ...work.lead_authors, ...work.routes, ...Object.values(work.identifiers).filter(Boolean), work.venue ?? ""].join(" ").toLocaleLowerCase("zh-CN");
    return inRoute && inState && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const work of filtered) {
    const card = document.createElement("article");
    card.className = "work-card";
    const top = document.createElement("div");
    top.className = "work-top";
    top.append(textElement("span", "", `${work.year} · ${work.id}`), textElement("span", "work-state", stateLabel(work.identity_state)));
    card.append(top, textElement("h2", "", work.title), textElement("p", "work-authors", `${work.lead_authors.join(" · ")}${work.lead_authors.length > 1 ? " · et al." : ""}`));

    const facts = document.createElement("dl");
    facts.className = "work-facts";
    const rows = [
      ["arXiv", valueOrUnknown(work.identifiers.arxiv)],
      ["DOI", valueOrUnknown(work.identifiers.doi)],
      ["OpenReview", valueOrUnknown(work.identifiers.openreview)],
      ["Venue", valueOrUnknown(work.venue)],
      ["核验日期", work.checked_at]
    ];
    for (const [label, value] of rows) facts.append(textElement("dt", "", label), textElement("dd", "", value));
    card.append(facts, textElement("p", "work-note", work.notes));

    const links = document.createElement("div");
    links.className = "work-links";
    links.append(externalLink("Canonical ↗", work.canonical_url));
    const linkLabels = { project: "项目页 ↗", code: "代码 ↗", model: "模型 ↗", venue_publication: "论文集 ↗", official_paper: "官方 PDF ↗" };
    for (const [key, label] of Object.entries(linkLabels)) if (work.links[key]) links.append(externalLink(label, work.links[key]));
    for (const route of work.routes) links.append(textElement("span", "work-route", route));
    card.append(links);
    grid.append(card);
  }
  count.textContent = `${filtered.length} / ${works.length} 个成果`;
  empty.hidden = filtered.length !== 0;
}

for (const button of document.querySelectorAll("[data-route]")) {
  button.addEventListener("click", () => {
    activeRoute = button.dataset.route;
    document.querySelectorAll("[data-route]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

for (const button of document.querySelectorAll("[data-state]")) {
  button.addEventListener("click", () => {
    activeState = button.dataset.state;
    document.querySelectorAll("[data-state]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

search.addEventListener("input", render);

fetch("/atlas/data/work-identities.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    works = data.works;
    document.querySelector("#work-total").textContent = String(works.length);
    document.querySelector("#venue-total").textContent = String(works.filter((work) => work.links.venue_publication).length);
    document.querySelector("#code-total").textContent = String(works.filter((work) => work.links.code).length);
    document.querySelector("#work-updated").textContent = data.updated_at;
    render();
  })
  .catch(() => {
    count.textContent = "数据加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取论文身份表";
  });
