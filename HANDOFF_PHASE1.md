# 交接摘要｜Phase 1 完成（假資料版 PWA）

我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets
（不需要 D1 / Durable Objects，不做逐件庫存鎖定，付款是人工核對截圖，非串金流 API）。

**Repo**：`abspbt/yjg-order`（原名 `abspbt/yggbagle`，已於 2026-08-17 改名，GitHub 會自動把舊網址轉過來）
**分支**：`claude/bakery-preorder-phase-1-x4zghn`

## 已完成 Phase 0
PWA 資訊架構與 Wireframe，8 頁全部定案，內容已寫入 `CLAUDE.md`。

## 已完成 Phase 1：假資料版 PWA
純前端、無框架、無建置流程，用 hash 路由（`#/dashboard` 等）+ localStorage 存假資料，
互動（切換上下架、確認付款、儲存表單等）都會實際反映在畫面上並保留，方便老闆感受操作邏輯。

### 檔案結構
```
index.html      — App shell
manifest.json   — PWA manifest（相對路徑，GitHub Pages 子路徑可正常運作）
sw.js           — Service Worker（cache-first + 背景更新）
css/style.css   — 全站樣式
js/data.js      — 假資料 + localStorage 存取（Store）
js/app.js       — 路由 + 8 頁的渲染邏輯
icons/          — icon-192 / icon-512 / apple-touch-icon（老闆提供的小雞叼貝果插圖）
```

### 已實作的 8 個頁面
- 🏠 今日 Dashboard（含「備料總覽」卡片，商品依已訂購量由多到少排序）
- 🥖 商品管理（新增／編輯／上下架切換）
- 📦 訂單列表＋付款確認（篩選、搜尋、確認付款、標記取貨、取消訂單）
- 📢 公告設定（字數限制、顯示開關、即時預覽）
- 📅 預購檔期設定（取貨時段可多筆新增刪除、已有訂單的檔期不可刪除只能結束）
- 🏪 店家資料（單頁表單，無清單概念）
- 🔴 預購開關（大 Toggle + 防手滑確認 dialog + 暫停訊息設定）
- 🔑 PIN 登入（PIN：`123456`，連續錯誤 5 次鎖定 60 秒，30 分鐘短期 token 免重複輸入）

### 這次對話額外處理的事項
1. 修掉 GitHub Pages 部署後白屏問題：把 `index.html`、`manifest.json`（`start_url` / `scope` / icons）、
   `sw.js`（precache 清單 + registration 路徑）裡的絕對路徑 `/xxx` 全部改成相對路徑
2. Dashboard 新增「備料總覽」卡片：商品依已訂購量由多到少排序，數量用醒目數字標示
3. 把展示用的預設 icon 換成老闆提供的小雞叼貝果插圖，產出 192×192／512×512／apple-touch-icon 三種尺寸

## 測試狀況
目前只用 Playwright 模擬瀏覽器走過全部 8 頁互動（登入/鎖定、切換上下架、確認付款、表單儲存等），
**老闆真機試用（iPhone 加入主畫面）目前進行中，尚未回報結果**。
這是 Phase 1 驗收標準裡最重要的一步，完成後請把回饋帶回下一個對話。

## 尚未做的事
- 真機試用回饋收集與對應調整
- Google Sheets 資料表設計（Phase 2）
- 任何後端串接（Phase 3 之後）

## 下一步（依實際情況擇一）
- 如果試用中發現要調整的地方：繼續在 Phase 1 修改，把老闆的意見列出來
- 如果試用順利：進入 Phase 2，設計 Google Sheets 資料表結構
  （`Campaigns` / `Products` / `Orders` / `Order_Items` / `Settings`，欄位定義見 CLAUDE.md）

---

## 開新對話的建議開場白

```
我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets。
Repo：abspbt/yjg-order（原名 abspbt/yggbagle），分支：claude/bakery-preorder-phase-1-x4zghn

已完成 Phase 0（Wireframe）與 Phase 1（假資料版 PWA，8 頁全部做完，含 PIN 登入、
備料總覽、GitHub Pages 部署路徑修正、自訂 icon）。詳細內容見附件 HANDOFF_PHASE1.md。

老闆真機試用目前進行中，回饋是：[貼上老闆的意見/要調整的地方]

現在要做：[試用有問題就繼續調整 Phase 1；試用 OK 就開始 Phase 2：設計 Google Sheets 資料表結構]
```
