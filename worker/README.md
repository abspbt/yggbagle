# Worker（Phase 3）

Cloudflare Worker，讀寫「歪嘴雞烘焙預購系統」的 Google Sheets 資料庫。

## 一、準備 Google Cloud Service Account（老闆需要做的部分）

Service Account 是一個「機器人帳號」，讓 Worker 可以用程式化方式讀寫 Google Sheets，不需要透過老闆的個人帳號登入。以下步驟只需要做一次。

### 1. 建立 Google Cloud 專案

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)（用老闆平常的 Google 帳號登入即可，不用另外申請）
2. 左上角點專案下拉選單 → 「新增專案」
3. 專案名稱填 `yggbagle`（或任何好記的名字）→ 建立
4. 建立後，確認畫面上方切換到這個新專案

### 2. 啟用 Google Sheets API

1. 左側選單「API 和服務」→「程式庫」
2. 搜尋 `Google Sheets API`
3. 點進去 → 按「啟用」

### 3. 建立 Service Account

1. 左側選單「API 和服務」→「憑證」
2. 上方「建立憑證」→「服務帳戶」
3. 服務帳戶名稱填 `yggbagle-worker`，其他欄位可以留預設 → 「建立並繼續」
4. 「這個服務帳戶的存取權」這步可以直接跳過（點「繼續」）不用指定角色
5. 最後「完成」

### 4. 產生 JSON 金鑰

1. 在「憑證」頁面的「服務帳戶」清單，點剛建立的 `yggbagle-worker`
2. 上方分頁切到「金鑰」
3. 「新增金鑰」→「建立新的金鑰」→ 格式選 **JSON** → 建立
4. 瀏覽器會自動下載一個 `.json` 檔案，**這個檔案只會出現這一次，請妥善保存**（不要放進 Google 雲端硬碟公開資料夾、不要傳一般 LINE 群組）
5. 這個 JSON 檔裡有一個 `client_email` 欄位，格式類似：
   `yggbagle-worker@專案代號.iam.gserviceaccount.com`
   下一步要用到這個信箱

### 5. 把 Service Account 加到 Google Sheets 的共用權限

1. 打開 Phase 2 建好的那份 Google Sheets 試算表
2. 右上角「共用」
3. 貼上上一步的 `client_email` 信箱
4. 權限選 **編輯者**（因為 Worker 之後要寫入訂單，不能只給檢視者）
5. 取消勾選「通知使用者」（這是機器人帳號，不用寄信通知）→ 傳送/共用

### 6. 記下試算表 ID

打開 Google Sheets 網址，格式是：

```
https://docs.google.com/spreadsheets/d/【這一串就是試算表 ID】/edit
```

把 `/d/` 和 `/edit` 中間那一串記下來，等一下要填進 Worker 設定。

---

## 二、Worker 專案設定（開發者做，本檔案所在的 `worker/` 資料夾）

### 本機安裝與測試

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
```

編輯 `.dev.vars`，填入：
- `SPREADSHEET_ID`：上面第 6 步記下的試算表 ID
- `GOOGLE_SERVICE_ACCOUNT_KEY`：把下載的整個 JSON 檔內容貼成**一行**（貼上前用 JSON 格式化工具轉成單行，或直接 `cat 你的檔名.json | tr -d '\n'` 產生單行字串）

啟動本機測試伺服器：

```bash
npm run dev
```

瀏覽器打開 `http://localhost:8787/api/test-sheets`，如果看到 `{"ok":true,"values":[...]}` 就代表 Service Account 授權成功、Worker 能讀到 Sheets 資料。

也可以打開 `http://localhost:8787/products`、`/campaigns`、`/orders` 測試 Phase 3-2 新增的讀取 API（見下方「讀取 API」章節）。

`POST /orders`（Phase 3-3 新增的建立訂單 API，見下方「寫入 API」章節）沒辦法用瀏覽器網址列直接測試，因為瀏覽器打開網址預設是 `GET`。開發時可以用終端機：

```bash
curl -X POST http://localhost:8787/orders \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":"C001","customer_name":"測試","customer_phone":"0912345678","pickup_slot_id":"S001","items":[{"product_id":"P001","quantity":1}]}'
```

或用 [Postman](https://www.postman.com/) 這類圖形化工具（不用打指令，填表單即可）送出 POST 請求測試。

Phase 3-4 新增的 `PATCH` endpoint（`/products/:id`、`/orders/:id`、`/settings`）也一樣要用 curl 或 Postman 測試，瀏覽器網址列沒辦法送出 `PATCH` 請求，例如：

```bash
curl -X PATCH http://localhost:8787/products/P001 \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

### 部署到 Cloudflare（正式環境）

#### 方法 A：不用終端機，全部在網頁上做（推薦給不熟終端機的人）

1. 打開 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers 和 Pages → 點進你已經建立好、也設定好 `SPREADSHEET_ID` 和 `GOOGLE_SERVICE_ACCOUNT_KEY` 的那個 Worker
2. 上方分頁切到「概觀」或「部署」，找到「編輯程式碼」（Edit code，有的介面也叫「快速編輯」Quick edit）按鈕並點進去，會打開一個網頁版的程式碼編輯器
3. 把編輯器裡原本的預設程式碼**整個刪掉**
4. 打開這個 repo 裡的 `worker/dashboard-single-file.js`，把整份內容複製、貼進編輯器
5. 按右上角「部署」（Deploy / Save and deploy）
6. 部署完，瀏覽器打開該 Worker 的網址加上 `/api/test-sheets`（Worker 網址可以在「概觀」頁複製，長得像 `https://ygg-hidden-star-9fe8.你的帳號.workers.dev`），確認看到 `{"ok":true,"values":[...]}`
7. 也可以打開網址加上 `/products`、`/campaigns`、`/orders`，確認看到 `{"ok":true,"products":[...]}` 這類回應（如果 Sheets 裡還沒有 status 是 `active` 的檔期，`/products` 和 `/campaigns` 會回傳空陣列，這是正常的，先去 `Campaigns` 分頁把某個檔期的 `status` 改成 `active` 再測試看看）

之所以要用 `dashboard-single-file.js` 這份「整合版」而不是 `src/index.js`，是因為網頁版編輯器不像本機開發環境，沒辦法拆成多個檔案互相 `import`，所以把三個檔案的內容先合併成一份，貼上就能直接用。之後如果程式邏輯有改，也要記得同步更新這份檔案。

#### 方法 B：用終端機 + wrangler 指令（開發者/之後迭代用）

`wrangler.toml` 的 `name` 要跟 Dashboard 上這個 Worker 的名字完全一致（例如 `ygg-hidden-star-9fe8`），部署才會部署到「同一個」已經設好機密的 Worker，而不是另外建一個新的。因為機密已經在 Dashboard 設定好了，`wrangler.toml` 刻意沒有再宣告這兩個變數，避免部署時把 Dashboard 上設定好的值覆蓋掉。

```bash
npx wrangler login
npm run deploy
```

> 如果之後想改用指令設定機密（例如要輪替金鑰），可以用：
> ```bash
> npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
> npx wrangler secret put SPREADSHEET_ID
> ```

## 讀取 API（Phase 3-2）

三個 endpoint 都是 `GET`，不需要帶任何參數，回傳格式都是 `{"ok": true, ...}`；失敗時是 `{"ok": false, "error": "..."}`（HTTP 狀態碼會是 4xx/5xx）。

### `GET /campaigns`

回傳目前 `status` 是 `active` 的檔期，每個檔期底下帶著自己的取貨時段（`PickupSlots`）。

```json
{
  "ok": true,
  "campaigns": [
    {
      "campaign_id": "C001",
      "name": "8 月中秋預購",
      "status": "active",
      "start_date": "2026-08-10",
      "end_date": "2026-08-20",
      "total_quantity_cap": 200,
      "pickup_slots": [
        { "slot_id": "S001", "date": "2026-08-22", "time_range": "14:00-16:00" }
      ]
    }
  ]
}
```

### `GET /products`

回傳目前 active 檔期、且上架中（`active` 勾選）的商品。`ordered_quantity` 是即時從 `Order_Items` 加總算出來的已訂購量（只算該商品所屬檔期、且訂單狀態不是 `cancelled` 的訂單），**不是**存在 Sheets 裡的欄位，延續 Phase 2 「不存彙總欄位」的原則。

```json
{
  "ok": true,
  "products": [
    {
      "product_id": "P001",
      "campaign_id": "C001",
      "name": "原味貝果（無餡）",
      "category": "貝果",
      "price": 45,
      "max_per_order": 10,
      "ordered_quantity": 12
    }
  ]
}
```

### `GET /orders`

給老闆後台看的訂單列表，每張訂單帶著自己的品項明細（`Order_Items`），依 `created_at` 新到舊排序。這支目前沒有依 active 檔期過濾，回傳全部訂單。

```json
{
  "ok": true,
  "orders": [
    {
      "order_id": "ORD-20260812-0001",
      "campaign_id": "C001",
      "created_at": "2026-08-12T10:30:00+08:00",
      "customer_name": "王小明",
      "customer_phone": "0912345678",
      "pickup_slot_id": "S001",
      "total": 450,
      "payment_status": "pending",
      "order_status": "new",
      "note": "",
      "items": [
        { "product_id": "P001", "product_name": "原味貝果（無餡）", "unit_price": 45, "quantity": 10, "subtotal": 450 }
      ]
    }
  ]
}
```

## 寫入 API（Phase 3-3）

### `POST /orders`

顧客下單用，建立一筆訂單（同時寫入 `Orders` 和 `Order_Items` 兩張表）。

**請求範例**：

```json
{
  "campaign_id": "C001",
  "customer_name": "王小明",
  "customer_phone": "0912345678",
  "pickup_slot_id": "S001",
  "note": "麻煩切半",
  "items": [
    { "product_id": "P001", "quantity": 2 },
    { "product_id": "P002", "quantity": 1 }
  ]
}
```

- `campaign_id`、`customer_name`、`customer_phone`、`pickup_slot_id`、`items` 為必填，`items` 至少要有一筆，`note` 可省略
- 商品單價一律以 Sheets 上 `Products` 分頁當下的資料為準，**不採信前端傳來的價格**，避免被竄改
- 會檢查：檔期是否為 `active`、取貨時段是否屬於這個檔期、商品是否存在／上架、單一商品數量是否超過該商品的 `max_per_order`
- **檔期/時段的總量上限（`total_quantity_cap`）檢查是 Phase 5 的範圍，這支目前不會擋**，超賣風險留到 Phase 5 處理
- 訂單編號格式 `ORD-YYYYMMDD-XXXX`（西元年月日 + 當天流水號，從 `0001` 開始），日期以台北時區計算
- 這是簡單的「讀了再寫」（讀 `Orders` 找當天最大流水號 +1），不是原子操作——極端情況下（幾乎同時送出兩張訂單）理論上有極低機率撞號，跟 Phase 5 的總量控制走一樣的取捨（老闆手動處理即可），不做額外的鎖

**成功回應**（HTTP 201）：

```json
{
  "ok": true,
  "order": {
    "order_id": "ORD-20260812-0001",
    "campaign_id": "C001",
    "created_at": "2026-08-12T14:05:00+08:00",
    "customer_name": "王小明",
    "customer_phone": "0912345678",
    "pickup_slot_id": "S001",
    "total": 135,
    "payment_status": "pending",
    "order_status": "new",
    "note": "麻煩切半",
    "items": [
      { "product_id": "P001", "product_name": "原味貝果（無餡）", "unit_price": 45, "quantity": 2, "subtotal": 90 },
      { "product_id": "P002", "product_name": "巧克力貝果（有餡）", "unit_price": 45, "quantity": 1, "subtotal": 45 }
    ]
  }
}
```

**失敗回應**（HTTP 400，例如檔期未開放、商品已下架、超過 `max_per_order` 等）：

```json
{ "ok": false, "error": "此檔期目前未開放預購" }
```

## 老闆端寫入 API（Phase 3-4）

> ⚠️ **這四支 endpoint 目前完全沒有登入驗證，誰知道網址都能打。** PIN 登入 + 短期 Token 驗證是 Phase 3-5 的範圍，屆時會補上；在那之前不要把這些網址公開分享。

### `POST /products`

新增商品。

```json
{
  "campaign_id": "C001",
  "name": "抹茶紅豆貝果（有餡）",
  "category": "貝果",
  "price": 55,
  "max_per_order": 5,
  "active": true
}
```

- `campaign_id`、`name` 為必填，其他欄位可省略（`active` 預設 `true`）
- 商品編號自動產生，格式 `P001`、`P002`...，取現有商品裡最大編號 +1（不分檔期，跨檔期共用同一組編號）
- 成功回傳 HTTP 201，內容跟 `GET /products` 裡單筆商品的格式一樣（多一個 `product_id`）

### `PATCH /products/:product_id`

編輯商品，例如上下架切換、改價格。只有請求裡帶到的欄位會被更新，其他欄位維持原樣。

```json
{ "active": false }
```

```json
{ "price": 50, "max_per_order": 8 }
```

- 找不到該 `product_id` 回 HTTP 404
- 成功回傳更新後的完整商品內容

### `PATCH /orders/:order_id`

老闆核對付款截圖後標記付款狀態、更新訂單狀態（4 段：`new` → `prepping_done` → `picked_up`，或 `cancelled`）、改備註。三個欄位都可選，至少要帶一個。

```json
{ "payment_status": "confirmed" }
```

```json
{ "order_status": "prepping_done" }
```

- `payment_status` 只能是 `pending` 或 `confirmed`；`order_status` 只能是 `new`、`prepping_done`、`picked_up`、`cancelled`，帶了不在清單內的值會回 HTTP 400
- 找不到該 `order_id` 回 HTTP 404
- 成功回傳更新後的訂單內容（不含 `items`，品項明細請用 `GET /orders`）

### `PATCH /settings`

改公告、開關預購、改店家資料等單一設定值。`Settings` 分頁是 key-value 格式（欄位「key」「value」），這支可以一次更新多組 key，Sheets 裡已經有的 key 會更新該列，沒有的話會新增一列（upsert）。

```json
{
  "announcement_text": "本週六預購開放中！",
  "preorder_open": "true"
}
```

- ⚠️ **這裡假設 `Settings` 分頁的欄位名稱是「key」「value」，實際 key 值要跟 Phase 2 建好的那份 Sheets 對照**（例如公告文字、預購開關的 key 到底叫 `announcement_text` 還是別的名字，請先打開 Sheets 的 `Settings` 分頁確認，再讓前端用正確的 key 呼叫這支 API）
- 因為是 upsert，key 打錯字不會報錯、只會在 Sheets 裡多一列新的設定，要小心拼字

## 檔案結構

- `wrangler.toml`：Worker 設定（名稱、非機密環境變數）
- `src/index.js`：Worker 進入點，包含讀取 API（`/api/test-sheets`、`/products`、`/campaigns`、`/orders` 的 GET）和寫入 API（`POST /orders`、`POST /products`、`PATCH /products/:id`、`PATCH /orders/:id`、`PATCH /settings`）
- `src/googleAuth.js`：用 Service Account JSON 金鑰換 Google API access token（RS256 JWT 簽章，純 Web Crypto API，無額外套件）
- `src/sheets.js`：呼叫 Google Sheets API 讀寫資料——`getSheetRows` 把整張表轉成物件陣列、`appendRows` 附加新列、`findRowByKey` 依欄位值找到某一列、`updateRow` 覆寫指定列
- `.dev.vars.example`：本機測試環境變數範本（`.dev.vars` 本身已加進 `.gitignore`，不會被 commit）
- `dashboard-single-file.js`：合併版程式碼，專門給不用終端機、直接在 Cloudflare Dashboard 網頁編輯器貼上部署用

## 下一步（Phase 3-5）

- PIN 登入 + 短期 Token 驗證機制，並補到 Phase 3-4 這幾支寫入 API 上
