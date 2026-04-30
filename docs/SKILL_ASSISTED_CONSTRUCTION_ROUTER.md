# 駿斯 CMS Skill-Assisted 施工路由

更新時間：2026-04-29

依據：

- VoltAgent `awesome-agent-skills`：作為外部技能索引，用於挑選施工時要啟用的工程、UI、測試、審查技能。
- 本機已安裝技能：`software-architecture`、`ui-ux-pro-max`、`web-design-guidelines`、`frontend-design`、`design-taste-frontend`、`web-design-reviewer`、`code-review-excellence`、`architecture-decision-records`、`verification-before-completion`、`playwright` / `qa`。
- 專案拓樸：`docs/PHASE_TOPOLOGY_MAP.md`
- 驗收門檻：`docs/PHASE_ACCEPTANCE_GATES.md`
- UI/UX 強制審理：`docs/UIUX_SKILL_REVIEW_PROTOCOL.md`

## 1. 為什麼加入 skill-assisted 路由

原本施工路徑已經有 Phase 0-3，但還缺一層「做這一刀前，應該先啟用哪種技能」。沒有這層時，容易發生：

- DB / BFF / UI 同時改，卻沒有分層驗收。
- UI 改漂亮但沒有經過可用性與極端情況檢查。
- 後端補 metadata 但沒補 smoke guard。
- 架構決策沒有 ADR 或文件回填。

新增 skill-assisted 路由後，每一刀都先決定：

1. 這刀屬於哪個 Phase。
2. 這刀需要哪些 skill。
3. 這刀要跑哪些驗收。
4. 這刀完成後要回填哪些文件。

## 2. 外部技能索引採納方式

VoltAgent `awesome-agent-skills` 是技能目錄，不是本專案要直接全量安裝的依賴。採納方式如下：

1. 先查本機已安裝技能能否覆蓋。
2. 不足時用 `npx skills find <query>` 搜尋。
3. 優先選官方或高安裝量技能。
4. 安裝前先確認用途，不因為存在就安裝。
5. 安裝後必須讀 `SKILL.md` 再使用。

本次搜尋結果納入的候選：

| 類型 | 搜尋結果 | 採納方式 |
|---|---|---|
| Architecture | `mattpocock/skills@improve-codebase-architecture`、`wshobson/agents@architecture-patterns`、`architecture-decision-records` | 目前先用本機 `software-architecture` + `architecture-decision-records`，不足再安裝 |
| Testing | `anthropics/skills@webapp-testing`、`e2e-testing-patterns` | 目前先用本機 `playwright` / `qa` / `verification-before-completion` |
| Web Design | `vercel-labs/agent-skills@web-design-guidelines` | 本機已有 `web-design-guidelines` 與 `ui-ux-pro-max`，直接啟用 |
| Frontend Design | `anthropics/skills@frontend-design` | 已安裝。用於高水準頁面與元件視覺施工 |
| Visual Taste | `leonxlnx/taste-skill@design-taste-frontend` | 已安裝。用於修正 AI 味、廉價感、空泛卡片與設計工程硬規則 |
| Design Review | `github/awesome-copilot@web-design-reviewer` | 已安裝。用於瀏覽器多 viewport 檢查與修復 |
| Code Review | `requesting-code-review`、`code-review-excellence`、PostgreSQL review skills | 本機已有 `code-review-excellence`；DB 大改時再查 PostgreSQL review skill |

## 3. Phase 對應技能路由

| Phase | 施工內容 | 必用技能 | 視情況加用 |
|---|---|---|---|
| Phase 0 | Schema、metadata helper、auth、telemetry、write path | `software-architecture`、`verification-before-completion` | `architecture-decision-records`、PostgreSQL review skill |
| Phase 1 | Employee UI/BFF 可用閉環 | `frontend-design`、`design-taste-frontend`、`web-design-reviewer`、`ui-ux-pro-max`、`web-design-guidelines`、`verification-before-completion` | `playwright` / `qa` |
| Phase 2 | Supervisor governance、公告、任務、場館 detail | `software-architecture`、`code-review-excellence`、`verification-before-completion` | `architecture-decision-records`、`qa` |
| Phase 3 | module_configs、system config、health、observability | `software-architecture`、`code-review-excellence`、`verification-before-completion` | PostgreSQL review skill、security/auth skill |
| Post Launch | LINE webhook agent、自動摘要、AI assist | `software-architecture`、integration/API skills | VoltAgent / Composio / MCP-related skills |

## 4. 每一刀的技能閘門

每次施工前：

1. 讀 `docs/PHASE_TOPOLOGY_MAP.md`，確認 Phase。
2. 讀本文件，確認要啟用的 skill。
3. 若涉及 UI / UX / 頁面 / 元件 / 互動，必須先讀 `docs/UIUX_SKILL_REVIEW_PROTOCOL.md`。
4. 若現有 skill 不足，先跑：

```bash
npx skills find <query>
```

5. 安裝新 skill 前先確認是否真的會用。
6. 執行前說明本輪使用哪些 skill，以及為什麼。

每次施工後：

1. 跑 `docs/PHASE_ACCEPTANCE_GATES.md` 指定驗收。
2. 更新 `docs/CONSTRUCTION_MAP.md`。
3. 若改架構決策，補 ADR。
4. 若新增技能依賴，記錄在本文件。

## 5. 對目前施工路徑的調整

原路徑：

```txt
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3
```

調整後：

```txt
Phase 判定
  -> Skill Route 判定
  -> 拓樸節點施工
  -> 關鍵/極端驗收
  -> 文件/registry/smoke 回填
  -> 下一刀
```

差異：

- 不再只看「下一個功能是什麼」，而是先看「這刀需要哪種專家流程」。
- UI 類工作必須走 `frontend-design` / `design-taste-frontend` / `web-design-reviewer` 與 viewport/互動驗收。
- DB/BFF 類工作必須走 architecture skill、metadata/smoke guard。
- 大決策不再只寫聊天紀錄，必須回填 ADR 或施工文件。

## 6. 近期下一刀技能配置

| 下一刀 | Phase | 技能配置 | 驗收重點 |
|---|---|---|---|
| `system_announcements` metadata retrofit | Phase 0 | `software-architecture` + `verification-before-completion` | create/update metadata、場館定向欄位不破壞、smoke guard |
| `tasks` metadata retrofit | Phase 0 | `software-architecture` + `code-review-excellence` | assignedBy/updatedBy、員工完成權限、主管派發權限 |
| `handover_entries` legacy retrofit | Phase 0 | `software-architecture` | legacy 欄位保留、不 rename、不破壞舊 portal |
| 員工教材 module | Phase 1 | `frontend-design` + `design-taste-frontend` + `web-design-reviewer` + `ui-ux-pro-max` | 影片/圖片/教材卡片 UX、觀看紀錄 telemetry、手機體驗 |
| Employee UIUX 全面審查 | Phase 1 | `web-design-reviewer` + `design-taste-frontend` + `frontend-design` | `/employee`、handover、documents、notes 多 viewport 截圖與修復 |

## 7. 不做的事

- 不全量安裝 VoltAgent 清單中的技能。
- 不因為有技能就改技術棧。
- 不為了對齊技能而重寫現有架構。
- 不讓 skill 取代本專案的 Module Registry / BFF / 5W1H 原則。
