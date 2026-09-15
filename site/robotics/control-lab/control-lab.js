const grid = document.querySelector("#experiment-grid");
const empty = document.querySelector("#experiment-empty");
const search = document.querySelector("#experiment-search");
const count = document.querySelector("#experiment-count");
let experiments = [];
let activeSetting = "all";

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
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

function readinessLabel(value) {
  return { specified: "协议已定义", running: "执行中", completed: "已完成", "safety-review-required": "需要真机安全复核" }[value] ?? value;
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = experiments.filter((experiment) => {
    const inSetting = activeSetting === "all" || experiment.setting === activeSetting;
    const haystack = [experiment.title, experiment.family, experiment.system, experiment.summary, experiment.question, ...experiment.metrics, ...experiment.controllers.map((controller) => controller.name)].join(" ").toLocaleLowerCase("zh-CN");
    return inSetting && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const experiment of filtered) {
    const card = element("article", "experiment-card");
    const top = element("div", "experiment-top");
    top.append(element("span", "", `${experiment.family} · ${experiment.setting}`), element("span", "experiment-readiness", readinessLabel(experiment.readiness)));
    card.append(top, element("h2", "", experiment.title), element("p", "experiment-question", experiment.question));

    const columns = element("div", "experiment-columns");
    const controllerColumn = element("section", "");
    controllerColumn.append(element("h3", "", "比较控制器"));
    for (const controller of experiment.controllers) {
      const block = element("div", "controller");
      block.append(element("strong", "", `${controller.name} · ${controller.role}`), element("span", "", controller.assumption));
      controllerColumn.append(block);
    }
    const protocolColumn = element("section", "");
    protocolColumn.append(element("h3", "", "固定协议"), list(experiment.fixed_protocol));
    const metricsColumn = element("section", "");
    metricsColumn.append(element("h3", "", "指标与产物"), list(experiment.metrics), element("h3", "", "必须保存"), list(experiment.artifacts));
    columns.append(controllerColumn, protocolColumn, metricsColumn);
    card.append(columns);

    const gates = element("div", "gate-row");
    const success = element("div", "gate");
    success.append(element("strong", "", "完成闸门"), document.createTextNode(experiment.success_gate));
    const risk = element("div", "gate risk");
    risk.append(element("strong", "", "风险闸门"), document.createTextNode(experiment.risk_gate));
    gates.append(success, risk);
    card.append(gates);

    const links = element("div", "experiment-links");
    for (const evidence of experiment.evidence_urls) links.append(externalLink(evidence.label, evidence.url));
    card.append(links);
    grid.append(card);
  }
  count.textContent = `${filtered.length} / ${experiments.length} 个实验协议`;
  empty.hidden = filtered.length !== 0;
}

for (const button of document.querySelectorAll("[data-setting]")) {
  button.addEventListener("click", () => {
    activeSetting = button.dataset.setting;
    document.querySelectorAll("[data-setting]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
}

search.addEventListener("input", render);

fetch("/atlas/data/control-experiments.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    experiments = data.experiments;
    document.querySelector("#experiment-total").textContent = String(experiments.length);
    document.querySelector("#simulation-total").textContent = String(experiments.filter((item) => item.setting === "simulation").length);
    document.querySelector("#hardware-total").textContent = String(experiments.filter((item) => item.setting === "hardware").length);
    document.querySelector("#experiment-updated").textContent = data.updated_at;
    render();
  })
  .catch(() => {
    count.textContent = "数据加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取实验台账";
  });
