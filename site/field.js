const track = document.body.dataset.track;
const grid = document.querySelector("#field-grid");
const empty = document.querySelector("#field-empty");
const count = document.querySelector("#field-count");
const search = document.querySelector("#field-search");
const filters = document.querySelector("#section-filter");
let activeSection = "all";
let records = [];
let sourcesById = new Map();
let nodesById = new Map();

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function makeLink(label, href) {
  const link = createText("a", "", label);
  link.href = href;
  if (href.startsWith("https://")) {
    link.target = "_blank";
    link.rel = "noreferrer";
  }
  return link;
}

function renderFilters() {
  const sections = [...new Set(records.map((record) => record.section))];
  filters.replaceChildren();
  const options = [["all", "全部"], ...sections.map((section) => [section, section])];
  for (const [value, label] of options) {
    const button = createText("button", value === activeSection ? "active" : "", label);
    button.type = "button";
    button.dataset.section = value;
    button.addEventListener("click", () => {
      activeSection = value;
      renderFilters();
      render();
    });
    filters.append(button);
  }
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = records.filter((record) => {
    const inSection = activeSection === "all" || record.section === activeSection;
    const sourceNames = record.source_ids.map((id) => sourcesById.get(id)?.name ?? id);
    const nodeNames = record.node_ids.map((id) => nodesById.get(id)?.title ?? id);
    const facts = record.facts.flatMap((fact) => [fact.label, fact.value]);
    const haystack = [record.name, record.subtitle, record.kind, record.summary, record.use_when, record.boundary, ...record.tags, ...sourceNames, ...nodeNames, ...facts].join(" ").toLocaleLowerCase("zh-CN");
    return inSection && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const record of filtered) {
    const card = document.createElement("article");
    card.className = "field-card";

    const top = document.createElement("div");
    top.className = "field-top";
    top.append(createText("span", "", record.section), createText("span", "field-kind", record.kind));
    card.append(top);
    card.append(createText("h2", "", record.name));
    card.append(createText("p", "field-subtitle", record.subtitle));
    card.append(createText("p", "field-summary-text", record.summary));

    const facts = document.createElement("dl");
    facts.className = "fact-grid";
    for (const fact of record.facts) facts.append(createText("dt", "", fact.label), createText("dd", "", fact.value));
    card.append(facts);

    const useBlock = document.createElement("div");
    useBlock.className = "field-block";
    useBlock.append(createText("strong", "", "适合什么时候用"), createText("p", "", record.use_when));
    card.append(useBlock);

    const boundaryBlock = document.createElement("div");
    boundaryBlock.className = "field-block";
    boundaryBlock.append(createText("strong", "", "边界 / 待验证"), createText("p", "", record.boundary));
    card.append(boundaryBlock);

    const footer = document.createElement("footer");
    const nodeTags = document.createElement("div");
    nodeTags.className = "field-tags";
    for (const id of record.node_ids) {
      const node = nodesById.get(id);
      nodeTags.append(makeLink(node?.title ?? id, `/atlas/catalog/?track=${node?.track ?? track}`));
    }
    footer.append(nodeTags);

    const links = document.createElement("div");
    links.className = "field-links";
    for (const id of record.source_ids) {
      const source = sourcesById.get(id);
      if (source) links.append(makeLink(`${source.name} ↗`, source.url));
    }
    for (const evidence of record.evidence_urls ?? []) links.append(makeLink(`${evidence.label} ↗`, evidence.url));
    footer.append(links);
    card.append(footer);
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${records.length} 条记录`;
  empty.hidden = filtered.length !== 0;
}

function getJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

search.addEventListener("input", render);

Promise.all([
  getJson("/atlas/data/field-guides.json"),
  getJson("/atlas/data/sources.json"),
  getJson("/atlas/data/catalog.json")
])
  .then(([guideData, sourceData, catalogData]) => {
    records = guideData.records.filter((record) => record.track === track);
    sourcesById = new Map(sourceData.sources.map((source) => [source.id, source]));
    nodesById = new Map(catalogData.nodes.map((node) => [node.id, node]));
    const linkedSources = new Set(records.flatMap((record) => record.source_ids));
    const linkedNodes = new Set(records.flatMap((record) => record.node_ids));
    const unknownFacts = records.flatMap((record) => record.facts).filter((fact) => fact.value.toLocaleLowerCase().includes("unknown")).length;
    document.querySelector("#guide-total").textContent = String(records.length);
    document.querySelector("#guide-sections").textContent = String(new Set(records.map((record) => record.section)).size);
    document.querySelector("#guide-sources").textContent = String(linkedSources.size);
    document.querySelector("#guide-nodes").textContent = String(linkedNodes.size);
    const unknownLabel = document.querySelector("#unknown-note");
    if (unknownLabel && unknownFacts > 0) unknownLabel.textContent = `${unknownFacts} 个未知字段被明确保留，未做推测。`;
    renderFilters();
    render();
  })
  .catch(() => {
    count.textContent = "数据加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取领域地图";
    empty.querySelector("p").textContent = "请稍后刷新页面。";
  });
