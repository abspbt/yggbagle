# 交接摘要｜回頭處理 Google Sheets 表結構 + Worker API（大小規格／宅配運費／地址）

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

顧客介面改版的**前端部分已經做完並測試過**，這次要回頭把後端補上：
Google Sheets 新增欄位（商品大小規格、宅配運費/地址）+ 修改 Worker API，
讓前端已經寫好、目前用假資料測過的功能（大小規格商品卡、自取/宅配流程、運費）
真正串上真實資料。

---

## 分支現況（照著用就好，不用開新分支）

- 開發分支：**`claude/yggbagle-site-ui-updates-hhavht`**
- 前端改版已經有 4 個 commit 在這個分支上（見下方「這次 session 做了什麼」）
- **後端的改動請接著放在同一個分支、一起併回 `main`**。理由不變：前端已經在用新欄位，
  分兩次併會出現「前端要的欄位後端還沒有」的壞掉狀態

---

## 這次 session（顧客介面改版）做了什麼

### commit 1：整體排版改版
- 品牌識別區：圓形 logo + 店名 + 副標
- 購物車摘要列從畫面下方改到**固定在上方**，可展開/收合看明細，運費用虛線跟商品分隔
- 新增分類頁籤（用現有 `Products.category` 欄位），固定在購物車列下方，**只在選商品步驟顯示**
  （其他步驟會自動隱藏，避免佔位置又沒作用）
- 商品卡片支援大/小規格分組顯示：依 `variant_group`（分組用）/`variant_label`（大/小標籤）
  兩個新欄位分組；**這兩個欄位 Sheets 現在還沒有**，所以目前每個商品都被當成獨立一組，
  照舊顯示成單一規格卡，不影響現有商品的顯示
- 新增「選自取／宅配」步驟：自取沿用原本選時段流程；宅配改成填收件地址，
  跳過選時段。運費從 `Settings.shipping_fee` 讀取（**這個 key 現在也還沒有**，
  目前前端讀不到值會當作 NT$0）
- 除了選商品之外，每個步驟都加上「‹ 上一頁」
- 步驟切換從「索引」改成用「步驟名稱字串」判斷（`activeSteps()` 動態算出目前是
  自取路線還是宅配路線），避免兩條不同長度的路線互相踩到

### commit 2：完成頁加上訂購明細
- 之前完成頁只顯示訂單編號 + 匯款資訊，客人容易忘記訂了什麼，事後對不上帳
- 加了「訂購明細」卡片：取貨方式（自取時段／宅配地址）、每項品名數量小計、運費、總計
- 「請匯款至」卡片金額改成含運費的總計
- 品項名稱會比對前端記憶體裡的商品清單補上 `variant_label`，避免同一組大/小規格
  在明細裡看起來像重複買了兩次同一項商品

### commit 3：換上真實 logo + 分享功能（第一版，已被 commit 4 簡化）
- 品牌識別區、favicon、apple-touch-icon 換成老闆提供的真實 logo（已壓縮成小尺寸）
- 完成頁加上明確的 3 步驟提醒（截圖／分享儲存／傳 LINE）

### commit 4：簡化分享按鈕
- 原本分享按鈕會依裝置支援度做不同的事（圖片+文字分享／純文字分享／複製+下載），
  客人猜不到按下去會怎樣，所以簡化成**只做一件事：把明細複製成文字**，
  每支手機行為都保證一樣，順便拿掉了只有這個功能在用的 html2canvas（200KB）
- 最終 3 步驟文案：① 截圖（客人自己操作，存畫面）② 複製文字明細（按鈕，一定是複製文字）
  ③ 開啟 LINE 貼上傳給老闆

### 測試方式（因為真實 API 還沒有新欄位）
用 Playwright + 本機假資料（假商品含 `variant_group`/`variant_label`、假 `Settings.shipping_fee`）
截圖驗證過完整畫面和流程，包含：大小規格分組卡片、購物車展開收合、分類頁籤、
自取/宅配兩條路線、上一頁按鈕、訂購明細、複製文字明細按鈕（有驗證剪貼簿內容正確）。
**還沒有用真實 iPhone Safari 測過**（這點原本 Phase 4 就還沒補測，一直延到現在）。

---

## 目前對真實 API 會發生什麼事（很重要，先知道這件事）

- **「自取」路線完全可用**：商品沒有 `variant_group`/`variant_label` 時前端會自動退回
  單一規格卡顯示，不影響現有下單流程
- **「宅配」路線目前無法真的送出訂單**：前端會把 `delivery_method: "delivery"` 和
  `delivery_address` 送給 `POST /orders`，但現在的 Worker 還是要求一定要有
  `pickup_slot_id`（見 `worker/src/index.js` 的 `handleCreateOrder`），沒有的話會回
  `400 缺少必要欄位`。這是**預期中的過渡狀態**，這次就是要把它補上

---

## 前端已經在用的資料格式（後端要對齊，這是「契約」）

### `GET /products` 回傳的每個商品，前端會找這兩個新欄位

```
variant_group   // 同一組大/小規格用同一個值分組；沒有這個欄位或空白 = 自己一組（單一規格）
variant_label   // 顯示在卡片上的規格標籤，例如 "大　5顆/袋"、"小　8顆/袋"
```

分組邏輯（`site/js/app.js` 的 `productGroups()`）：用 `variant_group || product_id` 當
分組 key，同一組如果只有 1 個商品就顯示單一規格卡，2 個以上才顯示大/小並排卡片。

### `GET /settings` 前端會找這個新 key

```
shipping_fee   // 宅配運費金額（純數字，字串或數字都可以，前端用 Number() 轉換）
```

沒有這個 key 時前端會當作 0（`Number(undefined) || 0`）。

### `POST /orders` 前端送出的 request body（`site/js/app.js` 的 submit 事件）

```jsonc
{
  "campaign_id": "...",
  "customer_name": "...",
  "customer_phone": "...",
  "note": "...",
  "delivery_method": "pickup" | "delivery",
  "items": [{ "product_id": "...", "quantity": 1 }],

  // 自取才會帶：
  "pickup_slot_id": "...",

  // 宅配才會帶：
  "delivery_address": "..."
}
```

**Worker 這邊要改的驗證邏輯**：
- `delivery_method === "pickup"` 時，跟現在一樣要求 `pickup_slot_id` 必填、檢查時段合法性
- `delivery_method === "delivery"` 時，改成要求 `delivery_address` 必填（非空字串），
  **不要求** `pickup_slot_id`
- 運費一律從 `Settings.shipping_fee` 讀取（`delivery_method === "delivery"` 才加），
  **不採信前端傳來的金額**——跟現在商品價格「以 Sheets 當下資料為準」是同一套防呆邏輯

### `POST /orders` 回傳的 `order` 物件，前端目前這樣用（⚠️ 有一個要注意的銜接點）

前端完成頁 (`showDone()`) 目前的邏輯是：

```js
var fee = state.deliveryMethod === "delivery" ? shippingFee() : 0; // 前端自己算的運費
var grandTotal = (order.total || 0) + fee; // 用後端回傳的 total 再加一次運費
```

這是因為**現在**後端的 `order.total` 只有商品小計、不含運費（因為 Worker 還不知道
有運費這件事）。等這次後端改完、`POST /orders` 把運費算進 `order.total` 一起回傳之後，
**前端這段「再加一次運費」的邏輯會變成重複計算，要記得回來拿掉**（`site/js/app.js`
搜尋 `grandTotal` 那几處，`showDone()` 跟 `renderSummary()`/`estimatedTotal()` 都要看一下）。

建議後端 `order` 物件直接回傳算好的最終金額：

```jsonc
{
  "order_id": "...",
  "total": 930,           // 建議：商品小計 + 運費的最終總額
  "delivery_method": "delivery",
  "shipping_fee": 150,    // 建議新增：運費金額，方便前端顯示不用自己再查 Settings
  "delivery_address": "...",
  "items": [{ "product_id": "...", "product_name": "...", "unit_price": 280, "quantity": 2, "subtotal": 560 }]
}
```

（是否要多回傳 `shipping_fee`/`delivery_method`/`delivery_address` 這幾個欄位不是硬性
規定，但如果有回傳，前端可以少寫一些「自己重新算一次」的邏輯，實作時可以自己評估。）

---

## 後端要改什麼（這次 session 的主要任務）

### Google Sheets

| 表 | 改動 |
|---|---|
| `Products` | 新增 `variant_group`、`variant_label` 兩個欄位 |
| `Orders` | 新增 `delivery_method`、`shipping_fee`、`delivery_address` 三個欄位 |
| `Settings` | 新增一筆 `setting_key = shipping_fee` 的資料列（`setting_value` 填運費金額） |

⚠️ 改 Google Sheets 欄位時要注意：`訂單查詢`、`月報表` 這兩個分頁是用公式即時讀
`Orders`/`Order_Items` 的，欄位位置變動可能會讓公式抓錯欄，**改完要回頭檢查這兩個分頁**
（這條是從 Phase 2 就留著的提醒，這次真的會動到 `Orders` 欄位，要記得檢查）。

### Worker API（`worker/src/index.js` + 同步更新 `worker/dashboard-single-file.js`）

| Endpoint | 改動 |
|---|---|
| `GET /products` | 回傳 `variant_group`、`variant_label` |
| `POST /products`（老闆端，需登入） | 新增商品時可以帶 `variant_group`、`variant_label` |
| `PATCH /products/:id`（老闆端，需登入） | 編輯商品時可以改 `variant_group`、`variant_label` |
| `GET /settings` | 回傳 `shipping_fee`（現有邏輯應該已經是把整張 `Settings` 表轉成 key-value 物件回傳，新增一筆資料應該不用改程式碼，但要確認） |
| `PATCH /settings`（老闆端，需登入） | 確認 `shipping_fee` 這個 key 可以透過現有的 upsert 邏輯改到 |
| `POST /orders` | 見上面「前端已經在用的資料格式」那段，要處理 `delivery_method`／`delivery_address`／運費計算／依取貨方式做不同欄位驗證 |

- Phase 5 的總量上限檢查邏輯**不用改**（本來就是一個 product_id 各自算，大/小規格
  在 Sheets 裡本來就是不同列、不同 product_id，天生就分開算，符合現況）
- 改完記得同步更新 `worker/README.md` 的 API 文件（欄位清單、範例 request/response）

### 老闆後台 PWA（這次不用做，先評估就好）

資料表結構改了之後，PWA 這幾頁「之後」可能要跟著調整：
- 商品管理頁：新增/編輯商品時要能設定大小規格
- 訂單列表頁：要顯示取貨方式、運費、收件地址
- 今日 Dashboard：備料總覽的數字算法可能要考慮規格

**這次 session 先不動 PWA**，等這次後端 + 之前的前端一起併回 `main` 之後，
下一個 Phase（Phase 6：PWA 串接真實 API）會處理。

---

## 現有程式碼結構（給接手的人參考）

### 顧客網站 `site/`（純前端，無框架、無建置流程）

- `site/index.html`：畫面結構。這次改版後新增了 `step-delivery`、`step-address` 兩個
  步驟區塊，完成頁多了「訂購明細」卡片跟「複製文字明細」按鈕
- `site/css/style.css`：樣式，顏色變數在最上方
- `site/js/app.js`：
  - `API_BASE` 常數（Worker 網址）在最上面
  - `state.deliveryMethod`（"pickup" | "delivery" | null）、`state.selectedSlotId`、
    `state.activeCategory` 是這次新增的狀態
  - `activeSteps()`：依 `state.deliveryMethod` 動態算出目前該走哪幾個步驟
    （自取路線經過 `slot`，宅配路線經過 `address`）
  - `productGroups()` / `buildVariantGroupCard()`：大小規格分組渲染邏輯
  - `cartItems()` / `renderSummary()` / `showDone()`：三個地方都有「補上 variant_label」
    跟「運費」的邏輯，是後端改完後要回來檢查的地方（見上面「⚠️ 有一個要注意的銜接點」）
- `site/assets/`：這次新增，店家 logo（`logo.jpg`）+ favicon + apple-touch-icon
- ~~`site/js/vendor/`~~：曾經放過 html2canvas，已經在 commit 4 拿掉了，不用管

### Worker `worker/`

- `src/index.js`：進入點，所有路由邏輯，`handleCreateOrder`（約在 134 行）是
  `POST /orders` 的處理函式，這次主要改動點
- `src/googleAuth.js`：Service Account 金鑰換 Google API access token（不用動）
- `src/sheets.js`：讀寫 Google Sheets 輔助函式（`getSheetRows`、`appendRows`、
  `findRowByKey`、`updateRow`，應該都不用改，新欄位用現有函式就能讀寫）
- `src/auth.js`：PIN 登入 token（不用動）
- **`dashboard-single-file.js`：四個 src 檔案的合併版，實際部署用的就是這份，
  改完 `src/` 底下的程式碼記得同步這份**
- `README.md`：完整 API 文件，改完 API 記得同步更新

### 環境變數（Cloudflare Dashboard「秘密」類型，沒寫進 repo，這次應該不用新增）

`SPREADSHEET_ID`、`GOOGLE_SERVICE_ACCOUNT_KEY`、`ADMIN_PIN`、`TOKEN_SECRET`

### 公開 API（不需登入）

`GET /campaigns`、`GET /products`、`GET /settings`、`POST /orders`

### 需登入 API（`Authorization: Bearer <token>`）

`GET /orders`、`POST /products`、`PATCH /products/:id`、`PATCH /orders/:id`、`PATCH /settings`

---

## 目前專案進度

- ✅ Phase 0～5：完成（PWA wireframe、假資料 PWA、Sheets 表設計、Worker API、
  顧客網站前端、總量上限控制）
- ✅ 顧客介面改版（前端）：這次 session 之前完成，4 個 commit 在
  `claude/yggbagle-site-ui-updates-hhavht` 分支上
- 🔄 **現在：回頭處理 Google Sheets 表結構 + Worker API**（這份文件的內容）
- ⏭️ 之後：
  - 評估老闆後台 PWA 要不要連帶改動（商品管理、訂單列表、Dashboard）
  - 前後端都併回 `main` 後才能開始 Phase 6（PWA 串接真實 API）
  - Phase 7（部署 + 網域）、Phase 8（打磨 + 測試，其中「真實 iPhone Safari 測試」
    這條從 Phase 4 就一直延到現在還沒補）

---

## 開新對話時的開場白

```
我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets。
顧客介面改版的前端已經做完並測試過，這次要回頭處理 Google Sheets 表結構跟 Worker
API（商品大小規格、宅配運費/地址），把前端已經在用、目前是假資料測試的功能，
真正串上真實資料。

分支：claude/yggbagle-site-ui-updates-hhavht（不用開新分支，接著在這個分支上做，
完成後前後端會一起併回 main）

詳細背景、前端已經在用的資料格式、後端要改的項目清單，都寫在
HANDOFF_BACKEND_SHEETS_WORKER.md，請先讀這份文件再開始。
```

（這份文件已經放在 repo 根目錄，開新對話貼上面這段開場白、附上這份文件就可以接手）
