# Robot benchmark and dataset registry

`content/benchmark-registry.json` 统一登记机器人 Benchmark、数据集和评测平台。它不制作一个跨任务总排名，而是先回答“比较的到底是不是同一个问题”。

## 固定字段

- `artifact_type`：`benchmark`、`dataset`、`benchmark-and-dataset` 或 `platform`。
- `domain`：主要问题域；用于筛选，不代表该项目只有一种用途。
- `environment`：`simulation`、`real` 或 `sim-and-real`。
- `evaluation_unit`：一次评价的最小单位，例如 episode、语言指令链或数据轨迹。
- `primary_metrics`：项目原生指标或数据覆盖指标，禁止凭空换算成跨项目分数。
- `protocol_keys`：复现时必须锁定的版本、任务、观测、动作和随机性字段。
- `comparison_boundary`：说明哪些数字不可直接横比。
- `license_note`：代码、数据和资产许可可能不同；`unknown` 保持显式。

## 规则

- “包含 1,000 个活动”不等于某届挑战评测 1,000 个任务。
- 数据集规模不等于策略质量，排行榜成绩也不等于跨本体泛化。
- 任务成功率只有在任务版本、初始状态、回合数、观测、动作空间和终止条件一致时才可比较。
- 所有记录必须连接官方来源与 `robotics-benchmark-registry` 节点。

构建脚本将源数据原样发布到 `site/data/benchmark-registry.json`，浏览入口为 `/atlas/robotics/benchmarks/`。
