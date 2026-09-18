const urlInput = document.querySelector("#source-url");
const track = document.querySelector("#source-track");
const intent = document.querySelector("#source-intent");
const status = document.querySelector("#intake-status");
const download = document.querySelector("#download-request");
const clear = document.querySelector("#clear-request");
download.disabled = false; clear.disabled = false;
status.textContent = "只会生成本地 JSON 文件；本站没有接收此链接的在线服务。";
download.addEventListener("click", () => {
  if (!urlInput.reportValidity() || !intent.reportValidity()) return;
  let url;
  try { url = new URL(urlInput.value.trim()); } catch { status.textContent = "请输入完整 HTTPS 链接。"; return; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) { status.textContent = "只接受无账号密码、无自定义端口的 HTTPS 链接。"; return; }
  const request = { schema_version: "1.0.0", url: url.href, track: track.value, intent: intent.value.trim(), visibility: "private" };
  const blob = new Blob([JSON.stringify(request, null, 2) + "\n"], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = href; anchor.download = "roboopus-inbox-request.json"; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  status.textContent = "已发起本地文件下载；尚未进入工作区，也没有公开发布。将文件交给助手或用 inbox import 导入。";
});
clear.addEventListener("click", () => { urlInput.value = ""; intent.value = ""; track.value = "frontier"; status.textContent = "输入已清空；若之前下载过文件，文件仍在你的下载目录。"; urlInput.focus(); });
