# Ragic H05 場館候選接線

本文件記錄員工登入後 Step 2「選擇你的場館」的資料來源與規則。

## 資料來源

- Ragic host: `RAGIC_HOST`，預設 `ap7.ragic.com`
- Account path: `RAGIC_ACCOUNT_PATH`，預設 `xinsheng`
- H05 sheet: `RAGIC_FACILITY_SHEET`，預設 `/ragicforms4/7`
- API key: `RAGIC_API_KEY`

API key 只允許透過環境變數或 Replit Secret 注入，不可寫入 repo。

## 欄位對應

H05 adapter 會讀取以下中文欄位，若 Ragic 欄位名稱調整，需同步更新 `server/integrations/ragic/facility-adapter.ts`。

| DTO 欄位 | Ragic 欄位候選 |
| --- | --- |
| `departmentName` | `部門名稱`、`部門`、`場館名稱`、`名稱` |
| `operationType` | `運營性質`、`營運性質` |
| `statusLabel` | `狀態`、`場館狀態`、`合約狀態` |

## 過濾規則

只顯示：

- `運營性質 = OT`
- 狀態不是 `結束`
- 能對應到本系統 `facilityKey`
- 存在於目前 session 的 `grantedFacilities`

若 H05 暫時無法連線，API 會回傳 `sourceStatus.connected = false`，並以 session 已授權場館作為降級候選；畫面必須顯示未連線狀態，不可假裝 H05 成功。

## 區域授權

員工部門會先映射到區域，再展開可選館別。

| Ragic 部門區域 | 可選館別 |
| --- | --- |
| 三蘆區 | 新北高中、三重商工、三民高中 |
| 台北 | 松山國小 |
| 新竹 | 竹科 / 新竹科學園區 |

主管或 system 角色仍由 session `grantedFacilities` 決定可選範圍。

## 驗證

```bash
npm run check:ragic-h05
```

此腳本會檢查候選資料是否符合 `OT` 與非 `結束` 規則，並列出目前抓到的候選館別。
