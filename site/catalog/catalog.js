const trackLabels = {
  frontier: "Frontier",
  robotics: "Robotics",
  hardware: "Hardware",
  adjacent: "Adjacent",
  lab: "Lab"
};

const grid = document.querySelector("#catalog-grid");
const empty = document.querySelector("#catalog-empty");
const count = document.querySelector("#result-count");
const search = document.querySelector("#catalog-search");
const buttons = [...document.querySelectorAll("[data-track]")];
const query = new URLSearchParams(location.search);
let activeTrack = trackLabels[query.get("track")] ? query.get("track") : "all";
let nodes = [];

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  const filtered = nodes.filter((node) => {
    const inTrack = activeTrack === "all" || node.track === activeTrack;
    const haystack = [node.title, node.title_en, node.section, node.summary, ...node.tags].join(" ").toLocaleLowerCase("zh-CN");
    return inTrack && (!needle || haystack.includes(needle));
  });

  grid.replaceChildren();
  for (const node of filtered) {
    const card = document.createElement("article");
    card.className = "node-card";

    const top = document.createElement("div");
    top.className = "node-top";
    top.append(createText("span", "", `${trackLabels[node.track]} · ${node.section}`));
    top.append(createText("span", "priority", node.priority));
    card.append(top);
    card.append(createText("h2", "", node.title));
    card.append(createText("p", "node-en", node.title_en));
    card.append(createText("p", "node-summary", node.summary));

    const tags = document.createElement("div");
    tags.className = "tag-row";
    for (const tag of node.tags) tags.append(createText("span", "", tag));
    card.append(tags);

    const next = document.createElement("p");
    next.className = "node-next";
    next.append(createText("strong", "", "下一步 · "), document.createTextNode(node.next_step));
    card.append(next);
    grid.append(card);
  }

  count.textContent = `${filtered.length} / ${nodes.length} 个节点`;
  empty.hidden = filtered.length !== 0;
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.track === activeTrack));
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTrack = button.dataset.track;
    const nextQuery = new URLSearchParams(location.search);
    if (activeTrack === "all") nextQuery.delete("track");
    else nextQuery.set("track", activeTrack);
    history.replaceState(null, "", `${location.pathname}${nextQuery.size ? `?${nextQuery}` : ""}`);
    render();
  });
});
search.addEventListener("input", render);

buttons.forEach((button) => button.classList.toggle("active", button.dataset.track === activeTrack));
fetch("/atlas/data/catalog.json")
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    nodes = data.nodes.sort((a, b) => a.priority.localeCompare(b.priority) || a.track.localeCompare(b.track) || a.title.localeCompare(b.title, "zh-CN"));
    render();
  })
  .catch(() => {
    count.textContent = "目录加载失败";
    empty.hidden = false;
    empty.querySelector("strong").textContent = "暂时无法读取目录数据";
    empty.querySelector("p").textContent = "请稍后刷新页面。";
  });
