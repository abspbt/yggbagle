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

### 部署到 Cloudflare（正式環境）

如果你已經在 Cloudflare Dashboard 的「Workers 和 Pages → 你的 Worker → 設定 → 變數與機密」手動新增過 `SPREADSHEET_ID` 和 `GOOGLE_SERVICE_ACCOUNT_KEY`（都設成「秘密」類型），這步就不用再用指令重複設定，`wrangler.toml` 也刻意沒有宣告這兩個變數，避免部署時把 Dashboard 上設定好的值覆蓋掉。

`wrangler.toml` 的 `name` 要跟 Dashboard 上這個 Worker 的名字完全一致（例如 `ygg-hidden-star-9fe8`），部署才會部署到「同一個」已經設好機密的 Worker，而不是另外建一個新的。

```bash
npx wrangler login
npm run deploy
```

部署完，瀏覽器打開 `https://ygg-hidden-star-9fe8.<你的 Cloudflare 帳號 subdomain>.workers.dev/api/test-sheets`（正式網址可以在 Dashboard「概觀」頁看到），確認回傳 `{"ok":true,"values":[...]}`。

> 如果之後想改用指令設定機密（例如要輪替金鑰），可以用：
> ```bash
> npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
> npx wrangler secret put SPREADSHEET_ID
> ```

## 檔案結構

- `wrangler.toml`：Worker 設定（名稱、非機密環境變數）
- `src/index.js`：Worker 進入點，目前只有一個測試 endpoint `/api/test-sheets`
- `src/googleAuth.js`：用 Service Account JSON 金鑰換 Google API access token（RS256 JWT 簽章，純 Web Crypto API，無額外套件）
- `src/sheets.js`：呼叫 Google Sheets API 讀取資料
- `.dev.vars.example`：本機測試環境變數範本（`.dev.vars` 本身已加進 `.gitignore`，不會被 commit）

## 下一步（Phase 3-2 之後）

`/api/test-sheets` 只是驗收用的最小測試，之後會依照 Phase 3-2～3-5 的規劃，換成：
- `GET /products`、`GET /campaigns`、`GET /orders` 等讀取 API
- `POST /orders` 建立訂單（含訂單編號產生邏輯 `ORD-YYYYMMDD-XXXX`）
- 老闆端寫入 API（改商品、改公告、改付款狀態、開關預購）
- PIN 登入 + 短期 Token 驗證機制
