# 任务：当前版本恢复第一版候选筛选逻辑

## 背景

用户确认希望保留当前产品体验，但候选人筛选部分使用第一版逻辑。

第一版逻辑为：

- 原始通讯录数据
- `intro + need`
- bigram 文本相关度预筛
- 候选池 `cap = 40`
- 再交给 AI 做最终推荐

## 目标

1. 保留当前滑卡、8 人推荐、换一批、排重、图谱等功能。
2. 删除当前候选筛选里的业务词/同义词扩展。
3. 候选筛选恢复第一版 `prefilter(query, people, excludeIds, cap=40)`。
4. `/api/match` 调用恢复为 `prefilter(`${intro} ${need}`, people, excludeIds)`。

## 修改记录

- 修改文件：`files/server.mjs`
  - 删除 `MATCH_QUERY_EXPANSIONS` 和 `expandMatchQuery`。
  - `prefilter` 默认候选数从 60 改为 40。
  - 名字命中加分逻辑恢复第一版写法。
  - `/api/match` 候选查询恢复为原始 `intro + need`。

## 验证记录

- `node --check files/server.mjs` 通过。
- 本地服务 `http://localhost:8787/` 启动成功。
- 使用“上海驾校陪练 / 城市合伙人 / 招商加盟”需求测试：
  - `/api/match` 返回 `candidateCount: 40`。
  - 不再返回 `matchMode`、`roughCandidateCount`。
  - Carlchen陈罡在第一版候选池中排名第 21，能进入候选 40。

## 结果

已完成：当前版本保留产品体验，候选筛选部分恢复为第一版逻辑。
