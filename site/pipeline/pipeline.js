const trackLabels = { frontier: "Frontier", robotics: "Robotics", hardware: "Hardware", adjacent: "Adjacent", lab: "Lab" };
const statusLabels = { active: "运行中", ready: "可执行", planned: "待排期", "awaiting-input": "等待材料" };
const modeLabels = { automatic: "自动", assisted: "辅助", manual: "人工" };

const grid = document.querySelector("#job-grid");
const empty = document.querySelector("#job-empty");
const count = document.querySelector("#result-count");
const search = document.querySelector("#job-search");
const trackButtons = [...document.querySelectorAll("[data-track]")];
const statusButtons = [...document.querySelectorAll("[data-status]")];
const query = new URLSearchParams(location.search);
let activeTrack = trackLabels[query.get("track")] ? query.get("track") : "all";
let activeStatus = statusLabels[query.get("status")] ? query.get("status") : "all";
let jobs = [];
let sourcesById = new Map();
let nodesById = new Map();

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
  if (activeStatus === "all") nextQuery.delete("status");
  else nextQuery.set("status", activeStatus);
  history.replaceState(null, "", `${location.pathname}${nextQuery.size ? `?${nextQuery}` : ""}`);
}

function linkTag(label, href) {
  const link = createText("a", "", label);
  link.href = href;
  return link;
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = jobs.filter((job) => {
    const inTrack = activeTrack === "all" || job.track === activeTrack;
    const inStatus = activeStatus === "all" || job.status === activeStatus;
    const sourceNames = job.source_ids.map((id) => sourcesById.get(id)?.name ?? id);
    const nodeNames = job.target_node_ids.map((id) => nodesById.get(id)?.title ?? id);
    const haystack = [job.id, job.title, job.summary, job.output, job.next_action, ...sourceNames, ...nodeNames].join(" ").toLocaleLowerCase("zh-CN");
    return inTrack && inStatus && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const job of filtered) {
    const card = document.createElement("article");
    card.className = "job-card";

    const top = document.createElement("div");
    top.className = "job-top";
    top.append(
      createText("span", "job-meta", `${trackLabels[job.track]} · ${modeLabels[job.access_mode]}`),
      createText("span", `job-status ${job.status}`, statusLabels[job.status])
    );
    card.append(top);
    card.append(createText("h2", "", job.title));
    card.append(createText("p", "job-summary", job.summary));

    const facts = document.createElement("dl");
    facts.className = "job-facts";
    facts.append(
      createText("dt", "", "频率"), createText("dd", "", job.cadence),
      createText("dt", "", "产物"), createText("dd", "", job.output)
    );
    card.append(facts);

    card.append(createText("p", "job-label", `来源 · ${job.source_ids.length}`));
    const sourceTags = document.createElement("div");
    sourceTags.className = "job-tags";
    if (job.source_ids.length === 0) sourceTags.append(createText("span", "", "等待用户材料"));
    for (const id of job.source_ids) {
      const source = sourcesById.get(id);
      sourceTags.append(linkTag(source?.name ?? id, `/atlas/sources/?track=${source?.track ?? job.track}`));
    }
    card.append(sourceTags);

    card.append(createText("p", "job-label", `目标节点 · ${job.target_node_ids.length}`));
    const targetTags = document.createElement("div");
    targetTags.className = "job-tags";
    for (const id of job.target_node_ids) {
      const node = nodesById.get(id);
      targetTags.append(linkTag(node?.title ?? id, `/atlas/catalog/?track=${node?.track ?? job.track}`));
    }
    card.append(targetTags);

    const next = document.createElement("p");
    next.className = "job-next";
    next.append(createText("strong", "", "下一步 · "), document.createTextNode(job.next_action));
    card.append(next);
    if (job.detail_url) card.append(linkTag("打开当前产物 →", job.detail_url));
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${jobs.length} 个任务`;
  empty.hidden = filtered.length !== 0;
  trackButtons.forEach((button) => button.classList.toggle("active", button.dataset.track === activeTrack));
  statusButtons.forEach((button) => button.classList.toggle("active", button.dataset.status === activeStatus));
}

trackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTrack = button.dataset.track;
    syncQuery();
    render();
  });
});

statusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;
    syncQuery();
    render();
  });
});

search.addEventListener("input", render);

function getJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

Promise.all([
  getJson("/atlas/data/ingestion-jobs.json"),
  getJson("/atlas/data/sources.json"),
  getJson("/atlas/data/catalog.json")
])
  .then(([jobData, sourceData, catalogData]) => {
    jobs = jobData.jobs;
    sourcesById = new Map(sourceData.sources.map((source) => [source.id, source]));
    nodesById = new Map(catalogData.nodes.map((node) => [node.id, node]));
    document.querySelector("#job-total").textContent = String(jobs.length);
    document.querySelector("#job-active").textContent = String(jobs.filter((job) => job.status === "active").length);
    document.querySelector("#job-ready").textContent = String(jobs.filter((job) => job.status === "ready").length);
    document.querySelector("#node-coverage").textContent = `${new Set(jobs.flatMap((job) => job.target_node_ids)).size}/${catalogData.nodes.length}`;
    document.querySelector("#source-coverage").textContent = `${new Set(jobs.flatMap((job) => job.source_ids)).size}/${sourceData.sources.length}`;
    document.querySelector("#job-waiting").textContent = String(jobs.filter((job) => job.status === "awaiting-input").length);
    render();
  })
  .catch(() => {
    count.textContent = "任务加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取采集任务";
    empty.querySelector("p").textContent = "请稍后刷新页面。";
  });
