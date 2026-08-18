# 交接摘要｜Phase 6：老闆後台 PWA 串接真實 API

我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets
（不需要 D1 / Durable Objects，不做逐件庫存鎖定，付款是人工核對截圖，非串金流 API）。

**Repo**：`abspbt/yjg-order`（原名 `abspbt/yggbagle`，已於 2026-08-17 改名；⚠️ GitHub Pages 網址不會跟著自動轉址，
舊的 `https://abspbt.github.io/yggbagle/...` 已經失效，正式網址是 `https://abspbt.github.io/yjg-order/`）
**Worker 網址**：`https://ygg-hidden-star-9fe8.drum3126.workers.dev`

**⚠️ 重要：我不熟悉終端機下指令，都是用網頁操作。Worker 部署請用 Cloudflare Dashboard
網頁編輯器（貼 `worker/dashboard-single-file.js`），不要預設要我開終端機打指令。**

**⚠️ 一律用中文回應，不要用英文。**

---

## 這次要做什麼（一句話）

老闆後台 PWA（`index.html`、`js/app.js`、`js/data.js`）目前還是 **Phase 1 假資料版**，
所有資料都存在 `localStorage`，沒有打過任何 API。這次要把它換成真的串接 Worker API
（`GET /auth/login`、`GET /products`、`GET /orders`、`PATCH /products/:id` 等），
並且順便把顧客介面改版（大小規格、宅配）新增的欄位也一起做進 PWA 介面。

---

## 分支現況

- Google Sheets 表結構 + Worker API + 顧客網站的改版都已經完成並**併回 `main`**
  （PR #13），這次可以放心從 `main` 開新分支做，不用擔心接續舊分支
- 建議開新分支，例如 `claude/pwa-phase6-xxx`

---

## 目前對 PWA 的評估結論（上一個 session 做的，還沒動手實作）

看過 `js/app.js` 裡商品管理、訂單列表、今日 Dashboard 這三頁的程式碼，整理出以下要調整的地方：

### 🥖 商品管理頁（`renderProductsList` / `renderProductEdit`，`js/app.js:621-771`）
- **編輯表單**（`renderProductEdit`）目前沒有 `variant_group`／`variant_label` 欄位，
  大小規格是直接寫死在商品名稱裡（例如「（有餡）原味卡士達（大 5顆/袋）」）。
  要加兩個新欄位：「規格分組」「規格標籤」，讓同一款商品的大/小可以分開建立，
  又能在顧客端配對成一組
- **商品列表**（`renderProductsList`）目前是每個商品一張獨立卡片，沒有依
  `variant_group` 分組顯示——可以考慮跟顧客端一樣把同組大小規格合併顯示，
  或至少在卡片上標出規格標籤，不然大小規格會變成兩張看起來無關的卡片

### 📦 訂單列表／詳情頁（`renderOrdersList` / `renderOrderDetail`，`js/app.js:442-616`）
- 訂單卡片跟詳情頁目前只有 `pickupSlot`，完全沒有處理宅配訂單——要加：
  取貨方式（自取／宅配）、宅配地址（自取訂單不顯示這欄）、運費（獨立顯示在
  金額明細裡，不要跟商品小計混在一起）
- 篩選 chip、搜尋目前都跟取貨方式無關，可以評估要不要加「自取／宅配」篩選，
  方便老闆抓宅配訂單另外處理出貨

### 🏠 今日 Dashboard（`renderDashboard`，`js/app.js:319-418`）
- 「備料總覽」「已訂購量」目前用 `item.name === product.name` 對應商品
  （`getProductOrderedQty`/`getProductPrepQty`，`js/app.js:67-84`），這是假資料時代
  的權宜寫法。真接上 API 後這裡本來就要改成用 `product_id` 比對（跟大小規格無關，
  但這次會一起改到）
- 大小規格分開算沒有問題（大/小本來就是不同 `product_id`），不用額外處理

### 資料模型層面
`js/data.js` 的假資料完全沒有 `variant_group`/`variant_label`/`delivery_method`/
`shipping_fee`/`delivery_address` 這些欄位——這些欄位串上真實 API 之後會自然帶進來，
現在的假資料只是示範用，屆時 `js/data.js` 這支檔案應該會被拿掉或大幅簡化
（改成直接呼叫 API，不再需要本機假資料 + localStorage 模擬）。

---

## PWA 現有程式碼結構（給接手的人參考）

- `index.html`：PWA 進入點，載入 `js/data.js`、`js/app.js`
- `js/data.js`：Phase 1 假資料 + `Store`（localStorage 讀寫），**Phase 6 會大幅改動或整支移除**
- `js/app.js`（約 1180 行）：所有頁面邏輯，用 hash routing（`#/dashboard`、`#/orders`、
  `#/products/:id` 等），純手刻 DOM 渲染（無框架）
  - PIN 登入現在是**假的**：`hasValidToken()`/`clearToken()`（`js/app.js:35-49`）只檢查
    `sessionStorage` 裡有沒有存一個「假 token + 到期時間」，PIN 對不對完全沒驗證。
    Phase 6 要改成真的呼叫 `POST /auth/login`，把拿到的 token 存起來，之後每支需要
    登入的 API 都要帶 `Authorization: Bearer <token>`
  - 目前完全沒有 `fetch`／API_BASE 常數，跟顧客網站 `site/js/app.js` 不一樣（那邊已經
    是真的在打 API 了），可以參考 `site/js/app.js` 開頭的 `API_BASE` 寫法跟 `fetchJson`
    輔助函式的做法
- `css/style.css`、`manifest.json`、`sw.js`、`icons/`：PWA 外觀與安裝設定，這次應該不用大改
- **PWA 目前還沒有部署到任何網址**（Phase 7才會做，例如 `admin.yourdomain.com`），
  目前都是老闆在本機瀏覽器打開 `index.html` 測試

---

## Worker API 清單（PWA 這次會用到的）

老闆專用的寫入 API 都需要先登入拿 token，見 `worker/README.md` 的「PIN 登入 API」章節。

**公開（不需要登入）**：
- `GET /campaigns`、`GET /products`、`GET /settings`

**需要登入**（`Authorization: Bearer <token>`）：
- `POST /auth/login`：PIN 換 token（12 小時有效）
- `GET /orders`：訂單列表（含顧客個資，含 `delivery_method`/`shipping_fee`/`delivery_address`）
- `POST /products`：新增商品（可帶 `variant_group`/`variant_label`）
- `PATCH /products/:id`：編輯商品（可改 `variant_group`/`variant_label`）
- `PATCH /orders/:id`：確認付款、改訂單狀態、改備註
- `PATCH /settings`：改公告、開關預購、改店家資料、改 `shipping_fee`

完整請求/回應格式、範例都在 `worker/README.md`，開發時直接對照那份文件即可，
不用重新猜欄位長什麼樣子。

---

## 目前專案進度

- ✅ Phase 0～5：完成
- ✅ 顧客介面改版（前端＋後端）：已完成並併回 `main`（PR #13）
- 🔄 **現在：Phase 6，PWA 串接真實 API**（這份文件的內容），上一個 session 只做了
  評估、還沒動手寫程式碼
- ⏭️ 之後：Phase 7（Cloudflare Pages 部署 + 網域設定，PWA 跟顧客網站都還沒正式上線）、
  Phase 8（打磨 + 測試，其中「真實 iPhone Safari 測試」這條從 Phase 4 就一直延到現在）

---

## 開新對話時的開場白

```
我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets。
Google Sheets 表結構、Worker API、顧客網站（大小規格商品、自取/宅配運費）都已經
做完並併回 main 了。

現在要做 Phase 6：把老闆後台 PWA（index.html、js/app.js、js/data.js，目前是
Phase 1 假資料版）換成真的串接 Worker API，包含 PIN 登入、商品管理（含大小規格
設定）、訂單列表（含取貨方式/運費/宅配地址顯示）、今日 Dashboard。

上一個 session 已經評估過 PWA 需要調整的地方，詳細內容、API 清單、現有程式碼
結構都寫在 HANDOFF_PWA_PHASE6.md，請先讀這份文件再開始。

建議開新分支（例如 claude/pwa-phase6-xxx），不用接續舊分支。
```

（這份文件已經放在 repo 根目錄，開新對話貼上面這段開場白、附上這份文件就可以接手）
