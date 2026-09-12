# RoboOpus Atlas

RoboOpus 具身智能与机器人知识库的总入口与跨项目治理仓库。

目标项目站：<https://roboopus.github.io/atlas/>

## 当前范围

- 汇总 WAM、Frontier、Robotics、Hardware、Adjacent、Lab 六条建设线。
- 保存各板块的一级知识树和首批字段规范。
- 在 `/atlas/catalog/` 发布可搜索、可筛选的非 WAM 一级目录。
- 发布机器可读的 `site/data/atlas.json`。
- 发布 58 个种子节点组成的 `site/data/catalog.json`。
- 不在这里复制各专题的全部内容；专题稳定后进入各自普通仓库和 GitHub Pages 项目站。

## 本地运行

```powershell
npm run dev
```

打开 <http://localhost:3001/atlas/>。

## 校验

```powershell
npm run build
```

## 仓库边界

- 只允许写入 `RoboOpus/atlas` 及用户明确授权的其他 `RoboOpus` 仓库。
- 不创建、不修改、不部署 `RoboOpus/RoboOpus.github.io`。
- 不操作用户的其他仓库或组织。
- 所有网站使用 `https://roboopus.github.io/<repository>/` 项目站。
