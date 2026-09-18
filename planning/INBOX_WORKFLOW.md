# 单链接收件箱：使用方式与边界

更新时间：2026-09-18。适用于 RoboOpus/atlas；不会改动第三方来源仓库。

## 可以做什么

提供一条公开网站、博客、访谈、论文或 GitHub 仓库链接，先进入本地私有收件箱。普通 HTML 页可尝试提取标题、描述和声明作者；这些仍是未经信任的页面元数据，不是已经读懂文章。助手或编辑需要实际查看来源，写出原创笔记并关联证据，再选择是否发布。

微信、小红书、带登录/临时访问参数的页面不自动抓取，只允许用户提供单链接后浏览器辅助或手动整理。遇到登录、验证码、反爬或 robots 限制不绕过。PDF 内容使用合适的论文阅读工具，不把二进制文件交给 HTML 解析器。

## 最简方式

在当前对话中提供链接，并说明目标板块与关注问题。助手可直接执行本地命令。私人 idea、未公开 CV 或项目资料请标为私密；不进入公开 GitHub 仓库。

网站 `/atlas/inbox/` 提供另一种方式：填写链接后下载 JSON。页面没有在线提交服务；下载本身不表示已经入库。请求文件可能含私人备注或临时访问参数，不要上传到公开 Issue。

## 本地命令

在 Atlas 仓库目录执行：

```powershell
npm run inbox -- add --url=https://github.com/RoboOpus/wam --track=wam
# 或导入网页下载的单链接请求
npm run inbox -- import --file="C:/path/to/roboopus-inbox-request.json"
npm run inbox -- list
```

命令返回 `url-...` ID。以下用实际 ID 替换占位符：

```powershell
npm run inbox -- fetch --id=url-...
npm run inbox -- template --id=url-...
# 编辑命令返回的 annotation.json，保留原创摘要、证据与局限
npm run inbox -- annotate --id=url-... --file=private-cache/inbox/url-....annotation.json
npm run inbox -- preview --id=url-...
# 确认预览只含可公开资料后，才导出公开草稿
npm run inbox -- publish --id=url-... --public
npm run build
npm test
```

`fetch` 失败不会产生假成功；记录转为 needs-assistance。单链接原始记录、内部备注、页面元数据和操作历史在 Git 忽略目录 `private-cache/inbox/`。`template` 不覆盖已有模板，重复 add/import 保留已有记录，publish 不覆盖已存在的公开笔记。

## 公开字段

每篇笔记需提供标题、原创摘要、干净的公开永久链接、来源类型、核对日期、至少一条证据关联主张和至少一个局限。原文作者或日期未知时保持空值/null，不用当天日期补造原文发布时间。

主张分为：

- source-statement：来源明确陈述的内容，不等于本站独立证实。
- editor-inference：从来源作出的推断，需要后续验证。
- community-opinion：社区观点，不能直接升格为科学事实。

`publish --public` 仅把白名单字段写到 `content/reading-notes/<id>.json`；不会复制原始 URL、私密 intent、Cookie、原始页面或内部历史。带 token/auth/session 等疑似凭据参数的公开 URL 会被拒绝，需提供干净永久链接。来源链接里的必要身份参数不会任意丢弃；公开目标路径需与原始/实际读取页相符。

导出后始终为 source-noted-draft、human_reviewed=false。这是“选择公开草稿”，不是“人工科学终审”，也不代表运行过第三方代码。修改公开笔记需明确编辑源 JSON 并检查 Git 差异，不能靠重复 publish 悄悄覆盖。

## 生成与部署

构建会生成 `/atlas/reading/` 详情页、公开笔记 JSON，并接入统一搜索。来源笔记不替代长篇知识正文。私有目录不参与构建、不在 Pages 上传目录内。

当前验证样例：

- Paper-Leaderboard-For-You、Xbotics-Embodied-Guide：直接 HTTPS 读取在本机超时，转为辅助读取；依据已查看的仓库 README 写原创笔记，预览白名单字段后导出。
- arXiv API 官方手册：普通公开网页的 robots 检查和标题/描述读取成功，仅保留私有元数据，不自动发布正文。
- 微信/小红书：代码与测试确认只走辅助路径；尚无用户提供的实际文章作为端到端读取验收样本。

## 网络实现边界

只接受 HTTPS、标准端口、无 userinfo 的域名 URL。每次请求校验 DNS，拒绝私有/保留地址并把连接固定到验证后的地址；重定向重新检查，最多 4 次。无 Cookie、无网页登录、无脚本执行。DNS 和请求有超时，响应限制 1 MiB。优先读取 robots；无法确认规则时保守转为人工辅助，尊重 noindex。

这是轻量单页元数据读取器，不是完整网页抓取平台。当前不支持 HTTP、PDF、压缩/超大页面、代理专用网络及复杂动态网页；这些转交对应阅读工具。robots 实现覆盖本项目所需规则，不宣称完整实现 RFC 全部边界。

参考：[Node HTTPS](https://nodejs.org/api/https.html)、[Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)。
