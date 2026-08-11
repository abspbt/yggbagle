# 🍞 歪嘴雞烘焙預購系統｜分階段開發任務卡

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
- [ ] 🏠 今日 Dashboard
- [ ] 🥖 商品管理（含新增/編輯）
- [ ] 📦 訂單列表 + 付款確認
- [ ] 📢 公告設定
- [ ] 📅 預購檔期設定（含總量上限、取貨日期/時段）
- [ ] 🏪 店家資料
- [ ] 🔴 預購開關
- [ ] 🔑 PIN 登入畫面

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

**這階段要定案的表**：
- [ ] `Campaigns`（預購檔期）：campaign_id、campaign_name、start_date、end_date、pickup_date_options、total_quantity_cap、status
- [ ] `Products`（商品）：product_id、campaign_id、name、description、price、max_per_order、status
- [ ] `Orders`（訂單）：order_id、campaign_id、created_at、customer_name、customer_phone、pickup_date、pickup_slot、total、payment_status、order_status、note
- [ ] `Order_Items`（訂單明細）：order_id、product_id、product_name_snapshot、unit_price、quantity、subtotal
- [ ] `Settings`（店家資料/公告/預購開關等單一設定值）

**產出**：一份實際建好、有正確欄位標題列的 Google Sheets 檔案（先不用填真實資料，欄位對齊即可）。

**驗收標準**：每張表的欄位跟 Phase 0 定案的頁面需求對得起來（例如今日 Dashboard 要顯示的數字，能從這些表算出來）。

**▶ 交接摘要範本**：
```
延續「歪嘴雞烘焙預購系統」，已完成 Phase 2：Google Sheets 資料表設計。
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
