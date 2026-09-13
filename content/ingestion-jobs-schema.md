# Atlas 采集任务规范

`site/data/ingestion-jobs.json` 把来源注册表与一级知识目录连接起来。它描述当前可执行的建设任务，不保存论文或产品事实本身。

## 关键字段

| 字段 | 含义 |
|---|---|
| `id` / `track` | 稳定任务 ID 与所属板块 |
| `source_ids` | 指向 `site/data/sources.json` 的来源 ID |
| `target_node_ids` | 指向 `site/data/catalog.json` 的知识节点 ID |
| `access_mode` | `automatic` / `assisted` / `manual` |
| `cadence` | 定时、周期复核或按需触发方式 |
| `status` | `active` / `ready` / `planned` / `awaiting-input` |
| `output` | 预期机器数据、知识矩阵或人工收件箱 |
| `next_action` | 下一步最小可执行动作 |

## 状态解释

- `active`：已有代码和运行入口。
- `ready`：来源、目标和字段边界已明确，可以开始第一批采集。
- `planned`：方向成立，但去重键、许可或数据结构仍需先完成。
- `awaiting-input`：只能等待用户材料，不从其他账户或仓库推断个人事实。
