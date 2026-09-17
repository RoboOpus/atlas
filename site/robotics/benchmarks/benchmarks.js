const grid = document.querySelector("#benchmark-grid");
const empty = document.querySelector("#benchmark-empty");
const search = document.querySelector("#benchmark-search");
const count = document.querySelector("#benchmark-count");
let records = [];
let activeType = "all";
let activeEnvironment = "all";

const typeLabels = {
  benchmark: "Benchmark",
  dataset: "数据集",
  "benchmark-and-dataset": "Benchmark + 数据集",
  platform: "评测平台"
};
const environmentLabels = { simulation: "仿真", real: "真机数据", "sim-and-real": "仿真 + 真机" };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function list(items) {
  const ul = document.createElement("ul");
  for (const item of items) ul.append(element("li", "", item));
  return ul;
}

function externalLink(label, url) {
  const link = element("a", "", `${label} ↗`);
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function typeMatches(record) {
  if (activeType === "all") return true;
  if (activeType === "benchmark") return record.artifact_type === "benchmark" || record.artifact_type === "benchmark-and-dataset";
  if (activeType === "dataset") return record.artifact_type === "dataset" || record.artifact_type === "benchmark-and-dataset";
  return record.artifact_type === activeType;
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = records.filter((record) => {
    const environmentMatches = activeEnvironment === "all" || record.environment === activeEnvironment;
    const haystack = [record.name, record.domain, record.focus, record.scale_statement, record.evaluation_unit, record.comparison_boundary, ...record.primary_metrics, ...record.tags].join(" ").toLocaleLowerCase("zh-CN");
    return typeMatches(record) && environmentMatches && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const record of filtered) {
    const card = element("article", "benchmark-card");
    card.id = record.id;
    const top = element("div", "benchmark-card-top");
    top.append(element("span", "", `${typeLabels[record.artifact_type]} · ${environmentLabels[record.environment]}`), element("span", "", record.domain));
    card.append(top, element("h2", "", record.name), element("p", "focus", record.focus));

    const meta = element("div", "benchmark-card-meta");
    for (const tag of record.tags) meta.append(element("span", "", tag));
    card.append(meta);

    const body = element("div", "benchmark-card-body");
    const scale = element("section", "");
    scale.append(element("h3", "", "规模与评测单位"), element("p", "", record.scale_statement), element("p", "", record.evaluation_unit));
    const metrics = element("section", "");
    metrics.append(element("h3", "", "原生指标"), list(record.primary_metrics));
    const protocol = element("section", "");
    protocol.append(element("h3", "", "复现必须锁定"), list(record.protocol_keys));
    body.append(scale, metrics, protocol);
    card.append(body);

    const boundary = element("div", "boundary");
    boundary.append(element("strong", "", "不可直接横比"), document.createTextNode(record.comparison_boundary));
    card.append(boundary, element("p", "license", `许可边界：${record.license_note}`));

    const links = element("div", "benchmark-card-links");
    const linkLabels = { project: "项目页", repository: "代码", paper: "论文", data: "数据" };
    for (const [kind, url] of Object.entries(record.links)) if (url) links.append(externalLink(linkLabels[kind], url));
    card.append(links);
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${records.length} 条记录`;
  empty.hidden = filtered.length !== 0;
}

for (const button of document.querySelectorAll("[data-type]")) {
  button.addEventListener("click", () => {
    activeType = button.dataset.type;
    document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

for (const button of document.querySelectorAll("[data-environment]")) {
  button.addEventListener("click", () => {
    activeEnvironment = button.dataset.environment;
    document.querySelectorAll("[data-environment]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

search.addEventListener("input", render);

fetch("/atlas/data/benchmark-registry.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    records = data.records;
    document.querySelector("#record-total").textContent = String(records.length);
    document.querySelector("#benchmark-total").textContent = String(records.filter((item) => item.artifact_type.includes("benchmark")).length);
    document.querySelector("#dataset-total").textContent = String(records.filter((item) => item.artifact_type === "dataset").length);
    document.querySelector("#sim-real-total").textContent = String(records.filter((item) => item.environment === "sim-and-real").length);
    render();
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  })
  .catch(() => {
    count.textContent = "数据加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取注册表";
  });
