# 知识正文与发布链

真正的知识内容存放在 `content/knowledge/*.md`，网页不是唯一来源。每次执行 `npm run build` 时，构建脚本会生成：

- `/atlas/knowledge/` 正文索引；
- `/atlas/knowledge/<slug>/` 独立正文页；
- `site/data/knowledge.json` 机器可读索引。

结构化事实可以使用独立源文件。例如硬件价格以 `content/hardware-price-snapshots.json` 追加保存，并在构建时同步到 `/atlas/data/hardware-price-snapshots.json`。正文负责解释字段、适用范围和风险，JSON 负责机器读取与历史追加。

## Markdown 约定

每篇文件使用 JSON front matter，至少包含：

- `id`、`slug`、`track`、`category`、`title`、`summary`；
- `difficulty`、`updated_at`；
- `editorial_state` 与 `human_reviewed`；
- `source_ids`，连接可信来源注册表；
- `node_ids`，连接一级知识目录；
- `prerequisites` 与 `takeaways`。

正文中的 `[S1]`、`[S2]` 按 `source_ids` 顺序链接到自动生成的来源列表。

## 编辑状态

- `source-checked-draft`：由机器辅助撰写并核对一手来源，但尚未经过人工终审。
- `reviewed`：必须同时设置 `human_reviewed: true`，仅在人工确认后使用。

目录、领域地图和采集任务都应反向链接到知识正文，防止“页面”和“内容”成为两套系统。
