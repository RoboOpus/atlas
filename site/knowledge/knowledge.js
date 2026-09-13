const cards = [...document.querySelectorAll(".knowledge-card")];
const search = document.querySelector("#knowledge-search");
const buttons = [...document.querySelectorAll("[data-track]")];
const count = document.querySelector("#knowledge-count");
const empty = document.querySelector("#knowledge-empty");
const query = new URLSearchParams(location.search);
const allowedTracks = new Set(["robotics", "hardware", "adjacent"]);
let activeTrack = allowedTracks.has(query.get("track")) ? query.get("track") : "all";

function syncQuery() {
  const nextQuery = new URLSearchParams(location.search);
  if (activeTrack === "all") nextQuery.delete("track");
  else nextQuery.set("track", activeTrack);
  history.replaceState(null, "", `${location.pathname}${nextQuery.size ? `?${nextQuery}` : ""}`);
}

function render() {
  const needle = search.value.trim().toLocaleLowerCase("zh-CN");
  let visible = 0;
  for (const card of cards) {
    const show = (activeTrack === "all" || card.dataset.track === activeTrack) && (!needle || card.dataset.search.includes(needle));
    card.hidden = !show;
    if (show) visible += 1;
  }
  count.textContent = `${visible} / ${cards.length} 篇正文`;
  empty.hidden = visible !== 0;
  buttons.forEach((button) => button.classList.toggle("active", button.dataset.track === activeTrack));
}

buttons.forEach((button) => button.addEventListener("click", () => {
  activeTrack = button.dataset.track;
  syncQuery();
  render();
}));
search.addEventListener("input", render);
render();
