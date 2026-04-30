# 駿斯 CMS 關鍵與極端情況驗收點

更新時間：2026-04-29

目的：讓每個 Phase 都有可執行的驗收門檻。BFF 架構的核心價值是把資料聚合、權限、錯誤隔離放在後端，讓前端專心做高水準、低摩擦、可形成工作習慣的操作體驗。

## 1. 驗收總原則

每個功能上線前都要同時通過三層驗收：

1. **架構驗收**：module registry、BFF DTO、API、DB metadata、permission、telemetry 都接上。
2. **體驗驗收**：員工不用學太多就能完成工作；慢網路、空資料、錯誤時也不破版。
3. **極端情況驗收**：權限越界、資料源故障、重複提交、手機小螢幕、長文字、大量資料都能穩定。

不可接受的上線狀態：

- UI 看起來有資料，但其實是 mock。
- 前端自行拼多個來源資料。
- 一個 BFF section 掛掉造成整個首頁 500。
- localStorage 決定 role、facility、session truth。
- 沒有 empty / not_connected / error state。
- 寫入沒有 actor、role、facility、source、updated metadata。

## 2. 全域關鍵驗收點

### 2.1 Module Registry

| 驗收點 | 必須結果 |
|---|---|
| 每個頁面都有 moduleId | sidebar、quick action、card、detail page 都能對到 registry |
| 每個 module 有 stage/status | 不得把 planned/mock 寫成 implemented |
| navigation 從 API 產生 | 不在 component 內硬編主導覽真相 |
| module health 可檢查 | route、BFF、permission、telemetry 狀態可被系統頁看到 |
| check:modules 通過 | `npm run check:modules` 不可倒退 |

### 2.2 BFF DTO

| 驗收點 | 必須結果 |
|---|---|
| DTO shape 穩定 | 前端不因單一資料欄位缺失而 crash |
| section 有狀態 | `ready / empty / not_connected / error` 四態齊全 |
| sourceStatus 明確 | 每張 card 知道來源、連線狀態、錯誤訊息 |
| 權限由後端裁定 | BFF 根據 session activeRole / activeFacility 回傳 |
| 單源失敗隔離 | shift API 掛掉不影響 handover / announcements |

### 2.3 DB / Metadata

| 驗收點 | 必須結果 |
|---|---|
| 建立者可追 | `created_by` 或 legacy equivalent 存在 |
| 建立角色可追 | `created_by_role` 存在 |
| 更新者可追 | `updated_by` 存在 |
| 場館可追 | `facility_key` 或明確 global scope |
| 來源可追 | `source = manual / external / webhook / system / migration` |
| migration 可重跑 | additive migration 不破壞既有資料 |

### 2.4 Telemetry / Audit

| 驗收點 | 必須結果 |
|---|---|
| UI 行為不阻塞 | telemetry 寫入失敗不影響主流程 |
| correlationId 存在 | ui event / client error / audit 可串起來 |
| 重要寫入有 audit | create/update/delete/complete/acknowledge 記 actor |
| client error 可落地 | 前端錯誤不只 console |
| 事件 taxonomy 不亂長 | eventType 命名有規則 |

### 2.5 UI/UX

| 驗收點 | 必須結果 |
|---|---|
| 主要任務 3 秒內理解 | 員工看到首頁能知道下一步要做什麼 |
| 44px 以上觸控目標 | 手機按鈕、card、icon 不難點 |
| 不靠 hover 才能操作 | 手機與平板完全可用 |
| 沒有橫向捲動 | 320px 到 1920px 都不破版 |
| loading 有保留空間 | 不跳版，不閃爍，不讓使用者誤點 |
| 錯誤在原位呈現 | 不用使用者猜哪裡壞 |
| 表單有可恢復性 | 送出失敗不清空輸入 |

## 3. 全域極端情況驗收點

### 3.1 權限與場館

| 情境 | 預期 |
|---|---|
| employee 手動打開 `/system/*` | 403 或導回可用頁，不顯示 system 資料 |
| employee 改 query facilityKey 到別館 | 後端拒絕或回空，不回資料 |
| supervisor 沒有某館權限但打該館 API | 403 |
| session 過期時操作新增 | 回 401，前端保留輸入並引導重新登入 |
| localStorage 被手動改 role | 不影響後端回傳權限 |

### 3.2 資料源故障

| 情境 | 預期 |
|---|---|
| DATABASE_URL 不存在 | 寫入功能顯示 not_connected，不假裝成功 |
| Ragic timeout | 登入候選館別顯示資料來源暫不可用 |
| Smart Schedule timeout | 今日班表 card 顯示 not_connected，首頁其他 card 正常 |
| telemetry DB 寫入失敗 | 主流程成功，server 記 error |
| BFF 某 section exception | 該 section 狀態 error，整體 DTO 仍 200 |

### 3.3 操作競態

| 情境 | 預期 |
|---|---|
| 連點新增按鈕 | button loading/disabled，不重複建立 |
| 同一交辦兩人同時完成 | 只有一次完成成功，另一方看到已完成狀態 |
| 編輯時資料被刪除 | 顯示已不存在，不 crash |
| 快速切場館 | 前一館 request 不覆蓋新館畫面 |
| 離線後再送出 | 顯示網路錯誤，保留草稿 |

### 3.4 UI 極端資料

| 情境 | 預期 |
|---|---|
| 標題 120 字 | wrap 或 truncate，有完整檢視方式，不撐爆 card |
| 公告 2000 字 | detail page 可讀，列表只顯示摘要 |
| 100 筆常用文件 | 搜尋、分類、排序仍順，不一次塞爆首頁 |
| 50 筆交辦 pending | 首頁最多 3-5 筆，完整頁可查詢與排序 |
| 無資料新員工 | 首頁有清楚 empty state，不像壞掉 |
| 小手機 320px | 無水平捲動、底部操作不被 safe area 擋住 |

## 4. Phase 0 驗收點：基礎層

目標：後續每個 module 寫入都能追 5W1H，Auth/Telemetry 不再 fail-open。

關鍵驗收：

- `npm run type-check` pass。
- `npm run check` pass。
- `npm run smoke:modules` pass。
- `npm run check:modules` pass。
- 所有高頻寫入點逐步使用 metadata helper。
- `employee_resources` 與 `quick_links` 已有 helper guard。
- Auth 不存在 `isSupervisor ?? true`。
- Supervisor BFF 有 role guard。
- Telemetry DB-backed path 存在，mock 才走 memory。

極端情況：

- 無 session 打 BFF：不能回授權資料。
- employee 打 supervisor dashboard：不能回主管資料。
- metadata helper 遺漏時 smoke 能報錯。
- DATABASE_URL 不存在時，本機不應假裝寫入成功。

Phase 0 未完成前，不應大規模新增寫入型功能。

## 5. Phase 1 驗收點：員工端可用閉環

目標：員工每天上班第一眼打開就能完成核心工作，形成習慣。

### 5.1 Employee Home

關鍵驗收：

- 首頁 1 秒內先顯示穩定骨架，不整頁空白。
- Quick Search、日期、天氣、交辦、家教預約、公告、快速操作、班表、活動、文件、便利貼都走 BFF DTO。
- 每張卡都有主 CTA 或清楚 empty state。
- 快速操作最多 7 個，排序可自訂。
- 查看全部導向正確 detail route。

極端情況：

- 任一 card API 掛掉，其他 card 仍可用。
- 使用者快速切場館，舊資料不殘留。
- 快速操作拖曳排序不造成 layout jump。
- 首頁資料 0 筆時仍像正式產品，不像半成品。

### 5.2 常用文件

關鍵驗收：

- 可新增連結、分類、備註。
- 分類可由員工新增。
- 首頁卡片點擊項目直接開連結。
- 只有「查看更多」進管理頁。
- 支援排序：自訂、名稱、分類、最近更新。

極端情況：

- URL 是內部路徑 `/employee/checkins` 可正常開。
- 外部 URL 無 protocol 時應提示修正。
- 分類很多時不撐爆 select/chip。
- 連結失效時顯示可理解狀態，不讓人以為系統壞。

### 5.3 便利貼

關鍵驗收：

- 快速新增使用 modal/sheet，不跳頁。
- 開啟後游標直接在內容輸入區。
- 日期與時間選填。
- 輸入框不用 placeholder 當 label。
- 失敗時保留草稿。

極端情況：

- 空內容不可送出。
- 送出中重複點擊不重複建立。
- modal 不跳動、不產生雙 scrollbar。
- ESC / 點背景 / 關閉按鈕都有清楚行為。
- 手機鍵盤彈出後，送出按鈕仍可用。

### 5.4 櫃台交辦

關鍵驗收：

- 首頁顯示未完成，依剩餘時間近到遠。
- 完整頁可切未完成 / 已完成。
- 新增、標記完成、回覆補充可用。
- 寫入有 actor / role / facility / source。

極端情況：

- 到期時間已過但 pending，BFF 顯示 expired。
- 同一筆被別人完成，前端刷新為已完成。
- 長內容不撐爆列表。
- 刪除前有確認。

### 5.5 員工教材

關鍵驗收：

- 員工可看影片、圖片、文件、注意事項。
- 主管可新增與管理同館教材。
- IT 可看觀看紀錄。
- 觀看行為寫 telemetry event。

極端情況：

- 影片連結失效，顯示「教材來源無法開啟」。
- 圖片大檔 lazy load，不阻塞整頁。
- 教材很多時有分類與搜尋。
- 新員工第一次進入有引導，但不打擾日常使用者。

## 6. Phase 2 驗收點：主管治理閉環

目標：主管首頁保持 overview，下鑽到場館 detail 才呈現完整員工端視角。

關鍵驗收：

- Supervisor dashboard 只回授權場館摘要。
- 場館 detail 可看到該館員工端視角。
- 公告可手動發布、定向場館、設定時間。
- 員工公告端只讀，可已讀 / 確認。
- 任務可主管派發、員工完成。
- 所有主管寫入有 audit。

極端情況：

- 主管沒有某館權限時不可下鑽。
- 公告過期後員工端不再顯示，但歷史可查。
- 已發布公告被編輯時，保留 `published_at` 與更新紀錄。
- 大量員工/場館資料時 supervisor 首頁不超載。

## 7. Phase 3 驗收點：系統配置與觀測

目標：上線前先完成 module label、排序、enabled 的最小配置能力。

關鍵驗收：

- IT 可看 module registry、module health。
- IT 可調整 label、enabled、sort order。
- 配置變更寫 audit。
- employee / supervisor 不可看 system-only config。
- 修改後 navigation/home-layout 能反映設定。

極端情況：

- 關閉某 module 後，舊 route 不暴露敏感資料。
- 排序值重複時有穩定 fallback。
- 配置 DB 掛掉時 fallback 到 static registry。
- 錯誤配置不可讓整個 dashboard 空白。

## 8. 上線前總驗收清單

必跑命令：

```bash
npm run type-check
npm run check
npm run smoke:modules
npm run check:modules
npm run build
```

必跑人工流程：

1. 員工登入 -> 選場館 -> 進 `/employee`。
2. 新增常用文件分類與連結。
3. 點首頁常用文件連結，確認直接開啟。
4. 快速新增便利貼，含不填日期、填日期時間兩種。
5. 新增櫃台交辦，完成後查已完成。
6. 查看公告列表與公告 detail，確認已讀/確認。
7. 切換場館，確認資料跟著變。
8. 主管登入，確認只看授權場館。
9. IT/system 登入，確認 module health 與 telemetry。

必測 viewport：

- 320 x 640
- 375 x 812
- 768 x 1024
- 1366 x 768
- 1920 x 1080

必測網路/資料狀態：

- 正常資料
- 空資料
- DB 未連線
- 外部 API timeout
- session 過期
- 慢網路 loading

## 9. 體驗標準

員工端不是「能用」就好，而是要做到：

- 每天打開第一眼知道要做什麼。
- 常用入口比 LINE 群、紙本、口頭交接更快。
- 錯誤時知道是資料沒接、網路壞，還是自己沒權限。
- 新員工不用問太多人也能找到教材、文件、交辦。
- 老員工能靠排序、分類、快速新增，把系統調成自己的工作習慣。

BFF 的存在是為了讓前端可以呈現得非常穩：資料複雜、來源很多、權限很多，但畫面永遠是清楚、可預期、不卡手。
