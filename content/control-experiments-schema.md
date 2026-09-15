# Control experiment registry

`content/control-experiments.json` 把控制算法对比从“方法名称”推进到“可复现实验协议”。一条记录只表示实验已经定义，不表示结果已经完成。

## 固定字段

- `system`、`setting`：被控系统与仿真/真机环境。
- `controllers`：每种控制器的角色与关键假设。
- `fixed_protocol`：比较双方必须共享的模型、初值、约束、采样和重复次数。
- `metrics`：必须从原始时序日志可重算的指标。
- `artifacts`：复现实验至少保留的配置、版本、原始日志和失败记录。
- `success_gate`：什么情况下可以称为“完成实验”。
- `risk_gate`：真机前必须满足的安全闸门；自动化不得跳过。
- `readiness`：目前只允许 `specified`、`running`、`completed`、`safety-review-required`。

构建脚本发布镜像到 `site/data/control-experiments.json`，浏览入口为 `/atlas/robotics/control-lab/`。
