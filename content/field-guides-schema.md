# 领域地图数据结构

`site/data/field-guides.json` 是 Robotics、Hardware 与 Adjacent 三个板块的首批可浏览内容，同时作为以后拆分独立项目站的数据源。

## 公共字段

- `id`、`track`、`section`：稳定标识和页面分组。
- `name`、`subtitle`、`kind`、`summary`：入口的名称、定位和简述。
- `use_when`：何时应考虑这个入口。
- `boundary`：它不能解决什么，或必须继续验证什么。
- `node_ids`：连接 `catalog.json` 的知识节点。
- `source_ids`：连接 `sources.json` 的一手来源。
- `facts`：同口径的短字段；未知值必须明确写 `unknown`。
- `evidence_urls`：可选，指向具体产品数据表或版本化官方证据。

## 编辑规则

1. Robotics 条目按系统职责组织，不做无条件的工具推荐。
2. Hardware 规格只使用厂商数据表；价格必须包含地区、币种和核验时间，否则写 `unknown`。
3. Adjacent 条目默认是迁移假设，必须同时写出最小验证问题。
4. 热度、Star 和厂商宣传不能直接变成质量排序。
5. 每条记录至少连接一个目录节点和一个已登记来源。
