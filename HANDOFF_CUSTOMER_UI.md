# 交接摘要｜顧客介面改版（設計已定案，尚未寫任何程式碼）

我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets
（不需要 D1 / Durable Objects，不做逐件庫存鎖定，付款是人工核對截圖，非串金流 API）。

**Repo**：`abspbt/yggbagle`
**Worker 網址**：`https://ygg-hidden-star-9fe8.drum3126.workers.dev`

**⚠️ 重要：我不熟悉終端機下指令，都是用網頁操作。Worker 部署請用 Cloudflare Dashboard
網頁編輯器（貼 `worker/dashboard-single-file.js`），不要預設要我開終端機打指令。**

**⚠️ 一律用中文回應，不要用英文。**

---

## 這次要做什麼（一句話）

顧客預購網站 `site/` 的介面大改版。改版過程中發現有些新功能（商品大小規格、宅配運費）
沒辦法只改前端，會連帶要改 Google Sheets 表結構和 Worker API，**已經確認要一起做**。

**執行順序（重要）**：
1. **先做顧客介面**，做到我可以在瀏覽器上實際操作、確認流程順不順手
2. 介面確認 OK 之後，**再回頭改後端**（Google Sheets 欄位 + Worker API）
3. 最後再評估**老闆後台 PWA 要不要連帶改動**（因為資料表結構變了，商品管理頁、訂單列表頁可能要跟著調整）

---

## 分支現況（已經處理好，照著用就好）

- 開發分支：**`claude/yggbagle-site-ui-updates-hhavht`**
- 這個分支目前**只有這份交接文件一個 commit**，其餘跟 `main` 完全一樣
- 前面幾輪對話只產出「設計模擬圖」（在對話裡的 Artifact 連結，沒進 repo），**`site/`、`worker/` 底下的程式碼一行都還沒動**
- **不需要開新分支，也不需要合併任何東西**，直接在這個分支上繼續做
- 分支名稱雖然叫 `site-ui-updates`（原本以為只改介面），但現在範圍擴大到含後端，名字就不改了，不影響任何功能
- **前端和後端的改動請放在同一個分支、一起併回 `main`**。理由：前端會用到後端新增的欄位（例如商品的大小規格、訂單的宅配運費），如果分兩次併，中間會出現「前端要的欄位後端還沒有」的壞掉狀態

---

## 已經定案的設計內容

設計模擬圖（HTML，可以直接開來看）：
https://claude.ai/code/artifact/36174e10-52d9-47c7-9ee8-ab595cafbdc8

### 1. 品牌識別區（畫面最上方）

- 圓形 logo + 店名 + 一行副標
- **目前沒有 logo 圖檔**，模擬圖用 🐥 emoji 佔位，之後有實際圖檔再換上

### 2. 分類頁籤（無餡系列／有餡系列）

- 用現有 Google Sheets `Products` 表本來就有的 `category` 欄位分類，**不用新增欄位**
- **要固定在畫面上，往下捲動商品列表時不會消失**（這點我特別要求過）
- 頁籤本身可以左右滑動（之後分類變多時不會擠爆）

### 3. 購物車摘要列

- 顯示「已選 N 件｜合計 NT$X」+「去結算」按鈕
- **點一下可以展開／收合看明細**（每個品項的名稱、數量、小計）
- 宅配運費也會列在明細裡，跟商品之間用虛線隔開
- **從選商品到送出訂單前，每個步驟都要固定顯示在畫面上，不會消失**
- ⚠️ **尚未決定**：這一列要固定在畫面「上方」還是「下方」。
  模擬圖畫的是上方（照我提供的參考圖），但目前正式站是固定在下方（比較好單手按）。
  **開始做之前先問我要哪一種。**

### 4. 商品卡片：大／小規格（新功能）

同一個商品有大、小兩種規格，各自獨立的價格和數量選擇器，例如：

```
（有餡）原味卡士達
┌─────────────┬─────────────┐
│ 大 5顆/袋    │ 小 8顆/袋    │
│ NT$280       │ NT$250       │
│ 每人限購5袋   │ 每人限購5袋   │
│  − 1 +       │  − 2 +       │
└─────────────┴─────────────┘
```

**這個要改後端**：`Products` 表要新增欄位來表達「這兩筆是同一組商品的不同規格」
（例如 `variant_group` 標示同一組、`variant_label` 標示大/小），
並修改 3 支 Worker API：`GET /products`、`POST /products`、`PATCH /products/:id`
（這三支目前都是明確列出固定欄位在讀寫，新欄位要一併加進去）。

### 5. 自取／宅配選擇（新功能，新增一個步驟）

完整流程（灰底是原本就有的，**粗體**是新增的）：

```
選商品 → 【選自取／宅配】 →  自取：選時段
                          →  宅配：【填收件地址】
                                         ↓
                          填姓名電話 → 訂單摘要 → 送出
```

- 選「自取」：不出現地址欄位，下一步進到原本的「選時段」畫面
- 選「低溫宅配」：出現**收件地址欄位（必填）**，跳過選時段，直接進到「填姓名電話」
- 宅配運費目前是 **NT$150**，但**金額不要寫死在程式碼裡**，要存在 `Settings` 表
  （新增一個 key，例如 `shipping_fee`），老闆之後可以自己在後台改
- **Worker 送單時一律用 `Settings` 裡的運費值計算，不採信前端傳來的數字**
  （跟現在商品價格的防竄改邏輯是同一套做法，見 Phase 3-3 備註）

### 6. 上一頁按鈕

- 目前正式站完全沒有「上一步」，只能往前不能往後
- **每個步驟（選商品以外）都要有「‹ 上一頁」可以回到前一步**

### 7. 配色

- **這次先維持現有的橘色系**（`#D97B3F` / `#B85C28` 等，就是 `site/css/style.css` 現在的顏色）
- 我想換成 **Pantone 12-2904 TCX Primrose Pink（`#EED4D9`）** 當主視覺，
  **但要等部署前才決定**，先不要動
- 換色時的建議搭配（已經先配好，模擬圖最上方有色票可以看）：

  | 用途 | 色碼 |
  |---|---|
  | 主視覺淺色（背景色塊、選中淺底） | `#EED4D9` ← Pantone 本尊 |
  | 按鈕／頁籤選中狀態 | `#C9506A` |
  | 強調文字（價格）／按下狀態 | `#A32E48` |
  | 頁面背景 | `#FCF4F5` |
  | 內文文字 | `#3A262B` |
  | 邊框、分隔線 | `#F1DEE1` |

  註：`#EED4D9` 亮度 88%（很接近白色），直接當按鈕底色配白字會看不清楚，
  所以按鈕要用同色相加深的版本。

- ⚠️ 換粉色時要注意：現在的警示紅（`#C0503E`，用在「額滿擋單」等錯誤訊息）
  跟粉色系色相很接近，換色時要一併調整警示色，否則使用者分不出「這是警示」還是「這是品牌色」

---

## 後端要改什麼（介面確認後才做）

### Google Sheets

| 表 | 改動 |
|---|---|
| `Products` | 新增規格欄位（`variant_group`、`variant_label` 之類，實際命名再討論） |
| `Orders` | 新增 `delivery_method`（自取/宅配）、`shipping_fee`、`delivery_address` |
| `Settings` | 新增 key：`shipping_fee`（運費金額） |

⚠️ 改 Google Sheets 欄位時要注意：`訂單查詢`、`月報表` 這兩個分頁是用公式即時讀
`Orders`/`Order_Items` 的，欄位位置變動可能會讓公式抓錯欄，**改完要回頭檢查這兩個分頁**。

### Worker API

| Endpoint | 改動 |
|---|---|
| `GET /products` | 回傳新增的規格欄位 |
| `POST /products` | 新增商品時可帶規格欄位 |
| `PATCH /products/:id` | 編輯商品時可改規格欄位 |
| `POST /orders` | ①接收取貨方式、收件地址 ②選宅配時驗證地址必填 ③運費從 `Settings` 讀取後加進總金額 ④選自取才檢查取貨時段 |

- Phase 5 的總量上限檢查邏輯**不用改**（本來就是一個 product_id 各自算）
- 改完記得**同步更新 `worker/dashboard-single-file.js`**（Dashboard 網頁編輯器貼上用的合併版）和 `worker/README.md`

### 老闆後台 PWA（最後才評估）

資料表結構改了之後，PWA 這幾頁可能要跟著調整，**但這個等顧客端做完再討論，先不要動**：
- 商品管理頁：新增/編輯商品時要能設定大小規格
- 訂單列表頁：要顯示取貨方式、運費、收件地址
- 今日 Dashboard：備料總覽的數字算法可能要考慮規格

---

## 目前專案進度

- ✅ Phase 0：老闆 PWA 資訊架構 + Wireframe（8 頁定案）
- ✅ Phase 1：假資料版 PWA（純前端、hash 路由 + localStorage，已併入 main）
- ✅ Phase 2：Google Sheets 資料表設計（已建好，在老闆的 Google 雲端空間）
- ✅ Phase 3-1～3-5：Cloudflare Worker API 全部完成
- ✅ Phase 4：顧客預購網站前端（`site/`，已測過完整下單流程）
- ✅ Phase 5：預購總量上限控制邏輯
- 🔄 **現在：顧客介面改版（這份文件的內容）**
- ⏭️ 之後：Phase 6（PWA 串接真實 API）、Phase 7（部署+網域）、Phase 8（打磨+測試）

**⚠️ Phase 6 要等這次改版併回 `main` 之後再開始。**
因為這次會改 Google Sheets 表結構，如果 Phase 6 先做，會照著舊結構串接，之後還要再改一次。

---

## 現有程式碼結構（給接手的人參考）

### 顧客網站 `site/`（純前端，無框架、無建置流程）

- `site/index.html`：所有畫面區塊都寫在這裡，用 `hidden` class 控制顯示/隱藏
- `site/css/style.css`：所有樣式，顏色都定義在最上方的 CSS 變數
- `site/js/app.js`：
  - `API_BASE` 常數（Worker 網址）寫在最上面
  - `state` 物件存所有狀態（購物車、選中的時段、目前步驟）
  - `STEPS` 陣列定義步驟順序，`goToStep()` 切換步驟
  - `cartItems()` 已經會算出每個品項的名稱/單價/數量/小計（購物車明細可以直接用這個）
  - `fetchJson()` 統一處理 API 呼叫和錯誤訊息

### Worker `worker/`

- `src/index.js`：進入點，所有路由邏輯
- `src/googleAuth.js`：Service Account 金鑰換 Google API access token
- `src/sheets.js`：讀寫 Google Sheets 輔助函式（`getSheetRows`、`appendRows`、`findRowByKey`、`updateRow`）
- `src/auth.js`：PIN 登入 token 簽發與驗證
- **`dashboard-single-file.js`：四個 src 檔案的合併版，實際部署用的就是這份，改程式碼一定要同步更新**
- `README.md`：完整 API 文件

### 環境變數（Cloudflare Dashboard「秘密」類型，沒寫進 repo）

`SPREADSHEET_ID`、`GOOGLE_SERVICE_ACCOUNT_KEY`、`ADMIN_PIN`、`TOKEN_SECRET`

### 公開 API（不需登入）

`GET /campaigns`、`GET /products`、`GET /settings`、`POST /orders`

### 需登入 API（`Authorization: Bearer <token>`）

`GET /orders`、`POST /products`、`PATCH /products/:id`、`PATCH /orders/:id`、`PATCH /settings`

---

## 其他還沒做的事（先記著）

- **還沒用真實 iPhone Safari 測過顧客下單流程**（Phase 4 原訂驗收標準之一）
- **還沒部署到 Cloudflare Pages / 掛正式網域**（Phase 7 範圍）
- PWA 的 PIN 目前還是假資料版寫死的 `123456`（Phase 6 要換成真的）
- 沒有登出／強制 token 失效機制，要提早失效只能去 Dashboard 換 `TOKEN_SECRET` 重新部署

---

## 開新對話時的開場白

```
現在可以開始更改顧客介面
```

（這份文件請一併附上）
