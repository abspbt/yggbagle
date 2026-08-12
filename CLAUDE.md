# 🍞 歪嘴雞烘焙預購系統｜分階段開發任務卡

## 目前進度

- ✅ Phase 0：老闆 PWA 資訊架構 + Wireframe（已完成，8 頁全部定案）
- ✅ Phase 1：假資料版 PWA（已完成，已併入 main，PR #2）
- ✅ Phase 2：Google Sheets 資料表設計（已完成，表已建到 Google 雲端空間）
- ✅ Phase 3-1：Worker 專案初始化 + Google Sheets API 授權設定（已完成，見下方備註）
- ✅ Phase 3-2：讀取 API（已完成，見下方備註）
- ✅ Phase 3-3：寫入 API（已完成，見下方備註）
- ✅ Phase 3-4：老闆端寫入 API（已完成，見下方備註）
- ✅ Phase 3-5：PIN 登入 + 短期 Token 驗證機制（已完成，見下方備註，**Phase 3 全部完成**）
- ⏭️ 下一步：Phase 4（顧客預購網站前端，串接 Phase 3 的 API）

**Phase 3-1 備註**：
- 已建立 Google Cloud Service Account，金鑰以「秘密」類型設定在 Cloudflare Dashboard 的 Worker 環境變數（`SPREADSHEET_ID`、`GOOGLE_SERVICE_ACCOUNT_KEY`），沒有寫進程式碼或 repo
- Worker 名稱：`ygg-hidden-star-9fe8`（Cloudflare 自動命名，`worker/wrangler.toml` 已同步）
- 測試 endpoint `/api/test-sheets` 已驗證能透過 Service Account 讀到 Google Sheets 資料
- 踩過的坑：Phase 2 的試算表原本是以 `.xlsx` 檔案上傳到 Google 雲端硬碟，Sheets API 不支援讀寫 Office 檔案格式，後來用「另存為 Google 試算表」轉成原生 Google Sheets 格式，換了新的 `SPREADSHEET_ID` 才能讀取成功
- **老闆不熟悉終端機下指令**，之後的部署都優先用 Cloudflare Dashboard 網頁編輯器操作（`worker/dashboard-single-file.js` 是專門給網頁編輯器貼上用的合併版程式碼），除非必要盡量避免要求在終端機執行指令

**Phase 3-2 備註**：
- 新增三支讀取 API：`GET /campaigns`（目前 active 檔期 + 取貨時段）、`GET /products`（active 檔期上架中商品，已訂購量即時從 `Order_Items` 加總）、`GET /orders`（訂單列表 + 每筆訂單的品項明細）
- 延續 Phase 2 設計原則：已訂購量不存彙總欄位，Worker 讀取時即時從 `Order_Items` 加總算出
- `worker/src/sheets.js` 新增 `getSheetRows()`，把整張表轉成「第一列是欄位名稱」的物件陣列，之後的 API 都靠這個讀資料
- 加了 CORS header，因為之後 Phase 4/6 前端會從別的網域打這個 Worker
- `worker/dashboard-single-file.js` 已同步更新，API 細節與範例回應格式見 `worker/README.md`
- 開發這次時發現 Phase 3-1 分支當時還沒併入 main，已在 `claude/phase-3-2-api-read-0rkozk` 分支裡先合併進來——**併 PR 時要注意，如果 Phase 3-1 有獨立的 PR 還沒關掉，這邊會重複收錄**

**Phase 3-3 備註**：
- 新增 `POST /orders`：顧客下單，同時寫入 `Orders` + `Order_Items` 兩張表
- 商品單價一律以 Sheets 上 `Products` 分頁當下資料為準，不採信前端傳來的價格，避免被竄改
- 會檢查檔期是否 active、取貨時段是否屬於該檔期、單一商品是否超過 `max_per_order`；**檔期/時段總量上限（`total_quantity_cap`）的檢查刻意留給 Phase 5**，這支目前不會擋超賣
- 訂單編號格式 `ORD-YYYYMMDD-XXXX`（台北時區日期 + 當天流水號），用「讀了再寫」算下一個流水號，不做原子鎖——跟 Phase 5 總量控制走一樣的取捨（極端情況下可能撞號，機率很低，先接受這個風險，之後真的常常發生的話再回頭處理）
- `worker/src/sheets.js` 新增 `appendRows()` 寫入輔助函式
- API 細節、請求/回應範例、curl 測試方法見 `worker/README.md`

**Phase 3-4 備註**：
- 新增四支老闆端寫入 API：`POST /products`（新增商品，自動產生 `P001`、`P002`... 編號）、`PATCH /products/:id`（編輯商品，只更新有帶到的欄位）、`PATCH /orders/:id`（確認付款狀態、更新訂單 4 段狀態、改備註）、`PATCH /settings`（改公告/開關預購/店家資料，key-value upsert）
- **⚠️ 這四支目前完全沒有登入驗證，誰都能打**，程式碼跟 README 都有標註，Phase 3-5 要記得補上
- `Settings` 分頁實際欄位是 `setting_key`/`setting_value`（不是原本猜的 `key`/`value`，已經跟老闆核對過 Sheets 實際內容修正），已有的 key 清單（`shop_name`、`shop_intro`、`shop_line`、`shop_phone`、`shop_address`、`bank_name`、`bank_account`、`bank_owner`、`announcement_text`、`announcement_visible`、`preorder_open`、`pause_message`）列在 `worker/README.md`
- `worker/src/sheets.js` 新增 `findRowByKey()`（依欄位值找到某一列）、`updateRow()`（覆寫指定列）兩個輔助函式
- API 細節、請求/回應範例、curl/Postman 測試方法見 `worker/README.md`

**Phase 3-5 備註**：
- 新增 `POST /auth/login`：老闆輸入 PIN 換一支短期 token（有效 12 小時），HMAC-SHA256 簽章，不用 D1/KV 存 session——token 本身帶著到期時間，Worker 只要驗簽章+檢查有沒有過期
- 新增兩個 Cloudflare 秘密環境變數：`ADMIN_PIN`（登入 PIN）、`TOKEN_SECRET`（簽章密鑰），做法比照 `SPREADSHEET_ID`，不寫進 repo
- 上鎖的 endpoint：`GET /orders`（含顧客個資）、`POST /products`、`PATCH /products/:id`、`PATCH /orders/:id`、`PATCH /settings`，都要帶 `Authorization: Bearer <token>`，沒帶/過期回 HTTP 401
- 保持公開（顧客前台之後要用）：`GET /products`、`GET /campaigns`、`POST /orders`
- **目前沒有登出／強制某支 token 失效的機制**，token 一旦發出去 12 小時內都有效；要提早讓所有 token 失效只能去 Cloudflare Dashboard 換掉 `TOKEN_SECRET` 重新部署（這樣連老闆自己手機上還沒過期的 token 也會一起失效，要重新登入）——這個取捨對一人小商家先夠用
- 新增 `worker/src/auth.js` 模組，內部的 base64url 輔助函式改名成 `tokenBase64url`/`tokenBase64urlToBytes`，避免跟 `googleAuth.js` 的同名函式在 `dashboard-single-file.js` 合併時撞名
- API 細節、登入流程、token 運作方式見 `worker/README.md`
- **Phase 3（Cloudflare Worker API）到這裡全部做完**：3-1 授權設定、3-2 讀取 API、3-3 顧客下單寫入、3-4 老闆端寫入、3-5 PIN 登入驗證

Phase 0 各頁 Wireframe 定案內容已整理成交接摘要，見對話紀錄
（今日 Dashboard、商品管理、訂單列表+付款確認、公告設定、
預購檔期設定、店家資料、預購開關、PIN 登入畫面）。

> 📝 **關於下方 Phase 規劃的說明**：以下 Phase 0～8 是專案一開始訂的大綱方向，
> 但實際動手做、老闆真機試用之後，常常會冒出規劃時沒想到的細節，需要跟著調整
> （例如 Phase 1 把訂單狀態從原本規劃的 3 段拆成 4 段、備料總覽的計算邏輯重新設計等）。
> 這是正常且預期中的過程，之後的 Phase 也會持續發生類似的情況——遇到跟大綱不一致的
> 地方，以「實際做出來、測試過的版本」為準，大綱本身不會回頭照實作反推硬改，
> 但重大調整會盡量在對應 Phase 或交接摘要裡註記一筆，方便之後回頭查。

## 使用方式（重要，請先讀）

1. **每個 Phase 盡量在「一個新對話」裡完成**，不要接著前一個 Phase 的舊對話繼續做，對話越長越容易吃光用量。
2. 每個 Phase 結尾都有一段「▶ 交接摘要」，**開新對話時，把上一個 Phase 的交接摘要貼上去當開場白**，不用貼整份歷史紀錄。
3. 如果你是付費方案，建議把這份文件整份存進 Claude 的 **Project 知識庫**，之後每個新對話都能自動讀到背景，交接摘要可以省略更多細節。
4. 每完成一個 Phase，回來這份文件把對應的 checkbox 打勾、把交接摘要裡的內容填實際結果，這份文件就是你的「專案聖經」，隨時可查目前進度到哪。
5. 如果某個 Phase 感覺內容太多、做到一半就快用完額度，**就地再拆成 Phase X-1 / X-2**，不用勉強一次做完。

---

## 總覽：確定的技術棧（已簡化版）

- **前台網站**：Cloudflare Pages
- **API / 後端邏輯**：Cloudflare Worker（或 Pages Functions）
- **資料庫**：Google Sheets（唯一資料來源，不用 D1、不用 Durable Objects）
- **通知/客服**：LINE OA（人工核對付款截圖，非自動串接金流）
- **老闆後台**：手機 PWA，PIN 登入 + 短期 Token

不需要的東西（已排除，不用重新討論）：
- Cloudflare D1
- Cloudflare Durable Objects
- 金流 API 串接
- 會員系統 / 帳密登入
- 逐件庫存鎖定（只做「檔期總量上限」）

---

## 工作流程規則

這個專案分成 Phase 0～8 進行（完整計畫見 docs/project-plan.md）。

- 每次完成一個 Phase 的產出、或段落任務告一段落時，
  **主動提醒我**：「這個階段完成了，要不要更新 CLAUDE.md 的『目前進度』？」
- 不要自己直接改，先問過我內容要寫什麼再更新。
- 如果我確認要改，把「目前進度」欄位更新成完成了什麼、下一步要做什麼。

---

## Phase 0：老闆 PWA 資訊架構 + Wireframe

**目標**：把老闆後台每一頁長什麼樣、有哪些按鈕、怎麼操作，逐頁定案。不寫任何程式碼。

**開始前準備**：
- 這份文件全文（或前面幾輪對話整理出的架構摘要）
- 圖二那張「你的後台」流程圖

**這階段要做的頁面**（一次一頁，覺得吃力可以拆多個對話）：
- [x] 🏠 今日 Dashboard
- [x] 🥖 商品管理（含新增/編輯）
- [x] 📦 訂單列表 + 付款確認
- [x] 📢 公告設定
- [x] 📅 預購檔期設定（含總量上限、取貨日期/時段）
- [x] 🏪 店家資料
- [x] 🔴 預購開關
- [x] 🔑 PIN 登入畫面

**產出**：每頁的文字版 Wireframe（畫面上有哪些區塊、欄位、按鈕、點下去發生什麼事），不用是圖片，文字描述即可。

**驗收標準**：老闆看著這份文字 Wireframe，能想像出「點開手機、看到什麼、要按哪裡」，沒有模糊地帶。

**▶ 交接摘要範本**（做完這階段，複製以下段落，填空後貼到下一個新對話開頭）：
```
我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets。
已完成 Phase 0（PWA 資訊架構與 Wireframe），以下是各頁面定案內容：
[貼上 Phase 0 產出的 Wireframe 文字]

現在要做 Phase 1：用假資料做出這幾頁的 PWA 前端（純前端，不接後端）。
```

---

## Phase 1：假資料版 PWA（純前端，不接後端）

**目標**：把 Phase 0 定案的頁面做成可以在手機上滑動操作的 PWA，資料先寫死（假資料），主要是驗證「操作順不順手」。

**開始前準備**：Phase 0 的交接摘要（貼 Wireframe 內容）

**產出**：
- [ ] 可加到 iPhone 主畫面的 PWA（manifest.json + service worker 基本設定）
- [ ] 4 個 Tab 導覽可切換
- [ ] 各頁面用假資料呈現（例如今日訂單 18 筆、假商品卡片等）
- [ ] 基本互動（點商品進編輯頁、切換上下架開關等）能跑，但不用真的存檔

**驗收標準**：老闆拿實體 iPhone 加到主畫面試用一輪，覺得「操作邏輯沒問題」再進下一步。這是整個專案最重要的把關點，寧可這階段多花時間調整，也不要帶著不順手的設計往後做。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 1：假資料版 PWA，
老闆試用後的回饋是：[貼上老闆的意見/要調整的地方]
PWA 程式碼位置：[貼 GitHub repo 連結]

現在要做 Phase 2：設計 Google Sheets 資料表結構。
```

---

## Phase 2：Google Sheets 資料表設計

**目標**：定出 Google Sheets 裡每張表的欄位，這是後面 API 和前端資料串接的依據。

**開始前準備**：Phase 1 交接摘要

**這階段要定案的表**（實際定案內容，跟原本大綱有些出入，見下方「跟大綱不同的地方」）：
- [x] `Campaigns`（預購檔期）：campaign_id、name、status（upcoming/active/ended）、start_date、end_date、total_quantity_cap
- [x] `PickupSlots`（取貨時段，**新增**）：slot_id、campaign_id、date、time_range
- [x] `Products`（商品）：product_id、campaign_id、name（含「（有餡）/（無餡）」前綴）、category、price、max_per_order、active
- [x] `Orders`（訂單）：order_id、campaign_id、created_at、customer_name、customer_phone、pickup_slot_id、total、payment_status（pending/confirmed）、order_status（**4 段**：new/prepping_done/picked_up/cancelled）、note
- [x] `Order_Items`（訂單明細）：order_id、product_id、product_name_snapshot、unit_price、quantity、subtotal
- [x] `Settings`（店家資料/公告/預購開關等單一設定值，key-value 格式）

**跟原本大綱不同的地方**（老闆真的會用這份表查資料，所以多做了兩個唯讀查詢分頁）：
- 新增 `PickupSlots` 表：因為 Phase 1 的「預購檔期設定」頁面已經做成一個檔期可以有多筆取貨時段，一對多關係塞不進 `Campaigns` 單一欄位
- 新增 `訂單查詢` 分頁：老闆非技術背景，輸入訂單編號或手機號碼，公式自動抓出符合的訂單，不用操作篩選器
- 新增 `月報表` 分頁：輸入年月，公式自動算出當月訂單數/營收、付款狀況、商品銷售排行（前 5 名）
- 兩個查詢分頁都是公式即時讀 `Orders`/`Order_Items`，不是複製一份資料，避免又出現「兩邊對不起來」的問題（Phase 1 已經踩過這個坑）
- 不存任何彙總/計算欄位在原始表裡（例如已訂購量），一律即時算，理由同上
- `status` 類欄位都加了資料驗證下拉選單，避免老闆手動改資料時打錯字

**產出**：一份實際建好、有正確欄位標題列的 Google Sheets 檔案（含示範資料），已匯入老闆的 Google 雲端空間。

**驗收標準**：每張表的欄位跟 Phase 0 定案的頁面需求對得起來；月報表分頁的公式數字已經跟老闆核對過，正確。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 2：Google Sheets 資料表設計，
已建好 8 個分頁（6 張原始資料表 + 訂單查詢 + 月報表），已匯入 Google 雲端空間。
表結構：[貼上最終欄位清單，或附 Sheets 連結]

現在要做 Phase 3：Cloudflare Worker API，讀寫這份 Google Sheets。
```

---

## Phase 3：Cloudflare Worker API

**目標**：寫出 Worker，能讀寫 Phase 2 定的 Google Sheets，提供給前台網站與 PWA 呼叫。

**開始前準備**：Phase 2 交接摘要（表結構）

**建議再拆成幾個小任務，各自可以是獨立對話**：
- [ ] 3-1：Worker 專案初始化 + Google Sheets API 授權設定（Service Account）
- [ ] 3-2：讀取 API（GET 商品列表、GET 檔期資訊、GET 訂單列表）
- [ ] 3-3：寫入 API（POST 建立訂單，含訂單編號產生邏輯 `ORD-YYYYMMDD-XXXX`）
- [ ] 3-4：老闆端寫入 API（改商品、改公告、改付款狀態、開關預購）
- [ ] 3-5：PIN 登入 + 短期 Token 驗證機制

**驗收標準**：用 Postman 或瀏覽器測試每個 API endpoint，能正確讀到/寫入 Google Sheets 的資料。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 3：Cloudflare Worker API。
已完成的 endpoint 清單：[貼 API 清單，例如 GET /products、POST /orders...]
Worker 程式碼位置：[GitHub repo 連結]

現在要做 Phase 4：顧客預購網站前端，串接這些 API。
```

---

## Phase 4：顧客預購網站前端

**目標**：做出顧客看到的單頁式預購網站，串接 Phase 3 的 API。

**開始前準備**：Phase 3 交接摘要（API 清單）

**產出**：
- [ ] 公告 → 選商品 → 選數量/口味 → 選取貨日期/時段 → 填姓名電話 → 送出訂單 → 顯示訂單編號 + 匯款資訊 → 前往 LINE / 複製訂單編號

**驗收標準**：從真實手機瀏覽器（iPhone Safari）走完整個下單流程，訂單真的寫進 Google Sheets。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 4：顧客預購網站，已可正常下單。
網站程式碼位置：[GitHub repo 連結]

現在要做 Phase 5：預購總量上限控制邏輯。
```

---

## Phase 5：預購總量控制邏輯

**目標**：顧客送出訂單時,檢查該檔期/該時段是否已達總量上限,超過則擋下並提示。

**開始前準備**：Phase 4 交接摘要

**產出**：
- [ ] 送出訂單前檢查 `total_quantity_cap` 是否還有餘量
- [ ] 超過上限時前台顯示「本時段/本檔期已額滿」
- [ ] 這裡不用做原子鎖，簡單的 read-then-write 檢查即可（極端情況下多接一兩張訂單，老闆手動調整即可）

**驗收標準**：手動把上限設低（例如設 2），測試第 3 筆訂單會被擋下。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 5：總量控制邏輯已測試通過。

現在要做 Phase 6：把 Phase 1 的假資料 PWA 換成串接真實 API。
```

---

## Phase 6：PWA 串接真實 API

**目標**：把 Phase 1 的假資料版 PWA，改成真的呼叫 Phase 3 的 API，讀寫真實 Google Sheets 資料。

**開始前準備**：Phase 1（PWA 程式碼）+ Phase 3（API 清單）的交接摘要

**產出**：
- [ ] 今日 Dashboard 顯示真實數字
- [ ] 商品管理可真的新增/編輯/上下架
- [ ] 訂單列表顯示真實訂單、可標記付款狀態
- [ ] 公告、店家資料、預購開關、取貨設定都能真的儲存
- [ ] PIN 登入串接 Phase 3-5 的驗證機制

**驗收標標準**：老闆用真機走一輪完整操作流程,所有資料變更都真的反映在 Google Sheets。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 6：PWA 已串接真實 API，功能可正常運作。

現在要做 Phase 7：Cloudflare Pages 部署 + 網域設定。
```

---

## Phase 7：部署 + 網域設定

**目標**：把顧客網站與 PWA 都部署到 Cloudflare Pages，掛上你 Cloudflare 已有的網域。

**產出**：
- [ ] 顧客網站部署上線（例如 order.yourdomain.com）
- [ ] PWA 部署上線（例如 admin.yourdomain.com）
- [ ] Worker 綁定正確的路由
- [ ] DNS 設定確認可正常連線

**驗收標準**：兩個網址都能從外部（非本機）正常打開並運作。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 7：已部署上線。
網址：顧客端 [連結]、老闆端 [連結]

現在要做 Phase 8：視覺/UX 打磨與上線前最終測試。
```

---

## Phase 8：視覺打磨 + 上線前測試

**目標**：最後調整介面美觀度、跑一次完整的端到端測試清單。

**測試清單**：
- [ ] 顧客下單全流程（含 LINE 跳轉/複製訂單編號兩種路徑都測）
- [ ] 老闆確認付款流程
- [ ] 總量額滿擋單測試
- [ ] 暫停預購開關測試（顧客端是否正確顯示暫停訊息）
- [ ] 手機不同瀏覽器測試（Safari、LINE 內建瀏覽器、已加入主畫面的 PWA）

---

## 附錄：每次開新對話的建議開場白模板

```
我在做「歪嘴雞烘焙預購系統」的 [第 X 階段名稱]。
背景：預購型貝果訂購系統，技術棧 Cloudflare Pages + Worker + Google Sheets，
不需要 D1/Durable Objects，總量控制用簡單檢查即可，付款是人工核對截圖。

已完成進度：[貼上一階段的交接摘要]

這次要做：[這階段的目標，複製上面對應 Phase 的「目標」欄位]
```
