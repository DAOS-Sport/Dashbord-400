# Known Issues - 駿斯 CMS

Last updated: 2026-05-15

## Format

每個項目格式：
- **ID**：原始 audit 編號或 issue tracker id
- **嚴重度**：🔴 / ⚠ / 💡
- **影響**：使用者實際感受
- **暫時 workaround**：（如有）
- **計畫修復時間**：

## Currently Tracking

- **ID**：🔴-002
  - **嚴重度**：🔴
  - **影響**：群組公告真入口未證明有資料落地，公告鏈路不能視為上線完成。
  - **暫時 workaround**：公告系統先維持人工確認，不作為唯一通知來源。
  - **計畫修復時間**：Phase 1
- **ID**：🔴-003
  - **嚴重度**：🔴
  - **影響**：公告候選審核仍走 LINE Bot proxy，和本地 Neon candidates 脫節。
  - **暫時 workaround**：審核結果需以 LINE Bot 後台/DB 查核交叉確認。
  - **計畫修復時間**：Phase 1
- **ID**：⚠-003
  - **嚴重度**：⚠
  - **影響**：員工失物招領與救生細節頁仍停在場館 gating 畫面。
  - **暫時 workaround**：使用救生員工作台或主管總覽交叉查詢。
  - **計畫修復時間**：Phase B
- **ID**：⚠-004
  - **嚴重度**：⚠
  - **影響**：群組公告員工頁可進但 0 筆，且無明確來源狀態。
  - **暫時 workaround**：員工先以首頁 pinned announcement 與主管公告為準。
  - **計畫修復時間**：Phase C / Phase 1
- **ID**：⚠-005
  - **嚴重度**：⚠
  - **影響**：Supervisor announcement-groups 仍可能露出技術性 token 訊息。
  - **暫時 workaround**：主管端不以該訊息作為操作指引，IT 端查 env。
  - **計畫修復時間**：Phase C
- **ID**：⚠-006
  - **嚴重度**：⚠
  - **影響**：prod / Replit log 未能完整檢查，部署端仍有未知風險。
  - **暫時 workaround**：上線前補一次部署 log audit。
  - **計畫修復時間**：Release candidate 前
- **ID**：⚠-007
  - **嚴重度**：⚠
  - **影響**：build bundle 偏大，首頁首次載入可能變慢。
  - **暫時 workaround**：先保留現況，避免止血期動 bundle split。
  - **計畫修復時間**：Phase 後段
- **ID**：⚠-008
  - **嚴重度**：⚠
  - **影響**：Browserslist / PostCSS warning 會降低 build 訊號可信度。
  - **暫時 workaround**：人工確認 warning 非功能性錯誤。
  - **計畫修復時間**：Phase 後段
- **ID**：⚠-009
  - **嚴重度**：⚠
  - **影響**：migrations 編號有兩個 `0007`，未來 schema diff 追蹤容易混淆。
  - **暫時 workaround**：DB 變更前人工檢查 migration order。
  - **計畫修復時間**：下一次 DB migration 前
- **ID**：⚠-010
  - **嚴重度**：⚠
  - **影響**：`module_settings` 使用舊 module id 命名，DB 治理層不能作為真實權限來源。
  - **暫時 workaround**：以 code manifest 為真。
  - **計畫修復時間**：DB governance phase
- **ID**：⚠-011
  - **嚴重度**：⚠
  - **影響**：audit trail 有資料，但部分 registry 仍標 planned/partial，狀態判讀不夠一致。
  - **暫時 workaround**：以實際 audit row 與 module-governance 文件交叉確認。
  - **計畫修復時間**：Phase 1 後
- **ID**：⚠-012
  - **嚴重度**：⚠
  - **影響**：watchdog token gate OK，但 watchdog data 為 0，IT 視角缺少真實事件。
  - **暫時 workaround**：人工 curl token ingestion 測試。
  - **計畫修復時間**：Release candidate 前
- **ID**：⚠-013
  - **嚴重度**：⚠
  - **影響**：跨館測試只驗證 `xinbei_pool`，多館資料隔離仍未完整證明。
  - **暫時 workaround**：上線前人工抽三個館別測一次。
  - **計畫修復時間**：Release candidate 前
- **ID**：⚠-014
  - **嚴重度**：⚠
  - **影響**：PT scheduling / swimming class 邊界未定，容易被誤認為本 CMS 已完整承擔排程。
  - **暫時 workaround**：家教預約/排課保留預告 surface，不提供未接線操作。
  - **計畫修復時間**：獨立 scheduling phase

## Recently Resolved

- **ID**：🔴-001
  - **嚴重度**：🔴
  - **影響**：任務管理頁標題錯誤會讓員工誤解目前模組。
  - **暫時 workaround**：已修正。
  - **計畫修復時間**：Phase 0 completed, commit pending
- **ID**：🔴-004
  - **嚴重度**：🔴
  - **影響**：employee home fallback 回傳非 canonical facility key，造成個人工作貼/Q&A 403。
  - **暫時 workaround**：已修正 canonical key 與 invalid key hard-fail。
  - **計畫修復時間**：Phase 0 completed, commit pending
- **ID**：🔴-005
  - **嚴重度**：🔴
  - **影響**：System read endpoints 未登入可讀。
  - **暫時 workaround**：已加 `requireSession + requireRole("system")`。
  - **計畫修復時間**：Phase 0 completed, commit pending
- **ID**：🔴-006
  - **嚴重度**：🔴
  - **影響**：real mode 下 mock adapter 會讓 IT 誤判整合健康。
  - **暫時 workaround**：mock adapter 在 real mode 標 degraded 並回傳原因。
  - **計畫修復時間**：Phase 0 completed, commit pending
- **ID**：🔴-007
  - **嚴重度**：🔴
  - **影響**：DB module_settings 與 code manifest 規模不一致。
  - **暫時 workaround**：已宣告 code manifest 為真，DB 作為 legacy/cache。
  - **計畫修復時間**：Phase 0 lightweight completed, commit pending
- **ID**：⚠-001
  - **嚴重度**：⚠
  - **影響**：raw-inspector / topology / lifeguard-audit 以獨立 system route 殘留。
  - **暫時 workaround**：已移除獨立 route/API/page/registry entry；governance 保留摘要。
  - **計畫修復時間**：Phase 0 completed, commit pending
- **ID**：⚠-002
  - **嚴重度**：⚠
  - **影響**：lifeguard-audit API 權限語意不一致。
  - **暫時 workaround**：已隨獨立 route 移除。
  - **計畫修復時間**：Phase 0 completed, commit pending
