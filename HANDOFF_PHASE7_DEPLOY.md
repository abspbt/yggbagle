# 交接摘要｜Phase 7：Cloudflare Pages 部署 + 網域設定

我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets
（不需要 D1 / Durable Objects，不做逐件庫存鎖定，付款是人工核對截圖，非串金流 API）。

**Repo**：`abspbt/yjg-order`（原名 `abspbt/yggbagle`，已於 2026-08-17 改名，GitHub 會自動把舊網址轉過來）
**Worker 網址（已上線）**：`https://ygg-hidden-star-9fe8.drum3126.workers.dev`

**⚠️ 重要：我不熟悉終端機下指令，都是用網頁操作。Cloudflare 相關設定請優先用
Cloudflare Dashboard 網頁介面操作，不要預設要我開終端機打指令。**

**⚠️ 一律用中文回應，不要用英文。**

---

## 這次要做什麼（一句話）

專案裡有兩個獨立的前端網站都還沒有正式部署：**顧客預購網站**（`site/` 資料夾）跟
**老闆後台 PWA**（repo 根目錄的 `index.html`、`js/`、`css/` 等）。這次要把兩個都部署到
Cloudflare Pages，掛上正式網域（如果我有的話），並確認 Worker 的 CORS／路由設定沒問題。

---

## 目前狀態

- Phase 0～6 全部完成，Google Sheets 表結構、Worker API、顧客網站前端、老闆後台 PWA
  都已經串好真實資料，功能可以正常運作（見下方「目前進度」完整清單）
- **顧客網站（`site/`）目前完全沒有部署到任何網址**，只在本機瀏覽器測試過
- **老闆後台 PWA 目前是暫時透過 GitHub Pages 在跑**：`https://abspbt.github.io/yjg-order/`
  （這不是原本規劃的路線，是開發過程中為了方便手機測試先臨時掛上去的，Phase 7 要決定
  要不要把它正式搬到 Cloudflare Pages，或是暫時先繼續用 GitHub Pages 也可以，這個我還沒決定，
  麻煩先跟我確認再動手）
- Worker 已經上線且穩定運作：`https://ygg-hidden-star-9fe8.drum3126.workers.dev`，
  CORS 目前是開放所有來源（`Access-Control-Allow-Origin: *`），所以不管顧客網站/PWA
  部署到哪個網域，理論上都不用改 Worker 的 CORS 設定
- 網域：我會先跟業主確認、購買正式網域後再串接，還沒買之前可以先用 Cloudflare Pages
  預設的 `*.pages.dev` 子網域開發測試

---

## 網域與多團購架構規劃（Phase 7 前先討論定案的方向，實作留給 Phase 7）

老闆之後想做「不同類型的團購」（跟現在的貝果團購方向不同、要分開處理），跟 Claude
討論後決定的架構方向如下，**之後開新對話做 Phase 7 時，這段可以直接照著做，不用重新討論**：

- **首頁**：業主買好正式網域後，網域主網址直接連到**放在 GitHub Pages 的首頁**——
  一頁式、適合手機閱讀，內容是簡單店家資料、目前檔期公告、跟連到各團購單的連結。
  這個首頁**目前還沒開始做**，repo 裡也還沒有對應的資料夾，Phase 7（或更早）要先決定
  這個首頁放在哪個 repo／資料夾、跟現有的 `site/`、`js/` 這些會不會放在同一個 repo
- **團購單（顧客訂購頁）**：全部放同一個 **Cloudflare Pages 專案**，用資料夾對應子路徑
  的方式管理，不用每個團購單各開一個 Cloudflare Pages 專案：
  ```
  /team-a/index.html  →  子網域.yourdomain.com/team-a/
  /team-b/index.html  →  子網域.yourdomain.com/team-b/
  ```
  現有的 `site/` 資料夾就是「團購單A」（貝果團購），以後要加團購單B時，是在 repo 裡
  開一個平行的資料夾（結構可能要調整成 `pages/team-a/`、`pages/team-b/` 這種更乾淨的分組，
  實際怎麼命名/整理留給 Phase 7 動手時再決定），然後把 Cloudflare Pages 專案的「根目錄」
  設定指到能同時看到所有團購單資料夾的那一層
  - 取捨：一個 Cloudflare Pages 專案管所有團購單，代表每次 push 到 repo，全部團購單會
    一起重新部署（不會互相影響內容，只是同時觸發部署），對一人商家來說這樣最好維護；
    真的需要團購單之間完全獨立部署時，才需要拆成多個 Cloudflare Pages 專案
- **老闆後台 PWA**：這次討論**沒有涵蓋** PWA 要不要搬到 Cloudflare Pages，維持前面
  「目前狀態」段落寫的：PWA 目前暫時掛在 GitHub Pages，要不要正式搬家還沒決定，
  Phase 7 開始時要記得單獨確認這件事

---

## Repo 裡兩個前端的位置（給接手的人參考）

- **顧客預購網站**：`site/index.html`、`site/js/app.js`、`site/css/`（如果有的話，實際結構請
  直接看 repo）——純前端單頁式網站，串接 Worker 的公開 API（`GET /settings`、`GET /campaigns`、
  `GET /products`、`POST /orders`），不需要登入
- **老闆後台 PWA**：repo 根目錄的 `index.html`、`js/app.js`、`js/api.js`、`css/style.css`、
  `manifest.json`、`sw.js`、`icons/`——PWA（可加到手機主畫面），PIN 登入後才能用，串接 Worker
  需要登入的 API
- 這兩個是**完全獨立**的網站，各自有自己的 `index.html`，需要各自建一個 Cloudflare Pages
  專案（或用同一個 repo 但指定不同的根目錄/建置輸出目錄）來部署，不能只建一個
- `worker/` 資料夾是 Cloudflare Worker（已經上線，不用重新部署，除非之後 Worker 程式碼有改動）

---

## Phase 7 要做的事（照 `CLAUDE.md` 大綱，已依上面的架構規劃調整）

- [ ] 跟業主確認網域購買狀況，決定主網址／子網域怎麼分配（首頁走主網址、團購單走哪個子網域）
- [ ] 建立「首頁」（一頁式、店家資料+公告+連結），部署到 GitHub Pages，決定放在哪個 repo／資料夾
- [ ] 顧客團購單（現有 `site/`）部署到 Cloudflare Pages，用資料夾對應子路徑的方式管理，
      為未來新增團購單B、C…預留空間（見上面「網域與多團購架構規劃」）
- [ ] 老闆 PWA 部署方式待確認（繼續留在 GitHub Pages，或搬到 Cloudflare Pages），這次討論沒有定案
- [ ] 確認 Worker 路由/CORS 設定跟新網域相容（目前是開放所有來源，理論上不用改，但要實際測試過）
- [ ] DNS 設定確認可以從外部（不是本機、不是開發環境）正常連線
- [ ] PWA 部署到新網址後，要確認「加到主畫面」還能正常運作（`manifest.json` 的
      `start_url`／`scope` 是用相對路徑 `./`，理論上不用改，但要實際測試）

**驗收標準**：兩個網址都能從外部正常打開並運作；PWA 從新網址重新加到手機主畫面，
PIN 登入、各頁面功能都正常。

---

## 開發習慣／限制（延續之前 Phase 的共識）

- 我不熟悉終端機，Cloudflare Pages 的部署設定、DNS 設定都請優先教我用網頁 Dashboard 操作
- 一律用中文回應
- 這是一人小商家的專案，不需要過度複雜的 CI/CD，簡單能動、好維護就好
- 每完成一個階段，記得提醒我要不要更新 `CLAUDE.md` 的「目前進度」，不要自己直接改，
  先問過我內容要寫什麼再更新

---

## 開新對話時的開場白

```
我在做「歪嘴雞烘焙預購系統」，技術棧：Cloudflare Pages + Worker + Google Sheets。
Phase 0～6 都已經完成並併回 main，Google Sheets 表結構、Worker API、顧客網站前端、
老闆後台 PWA 都已經串好真實資料，功能可以正常運作。

現在要做 Phase 7：部署 + 網域設定。已經先想好的架構方向（詳見文件裡「網域與多團購架構規劃」）：
業主買好網域後，主網址連到放在 GitHub Pages 的一頁式首頁（店家資料+公告+連結）；顧客團購單
（現有 site/ 資料夾）部署到同一個 Cloudflare Pages 專案，用資料夾對應子路徑的方式管理，
為未來的團購單B、C…預留擴充空間。老闆後台 PWA 要不要從目前暫時的 GitHub Pages
（https://abspbt.github.io/yjg-order/）搬到 Cloudflare Pages，這次還沒定案，要先跟我確認。

詳細背景、目前狀態、Repo 結構都寫在 HANDOFF_PHASE7_DEPLOY.md，請先讀這份文件再開始。

⚠️ 我不熟悉終端機下指令，Cloudflare 相關設定請優先教我用網頁 Dashboard 操作。
⚠️ 一律用中文回應。
```

（這份文件已經放在 repo 根目錄，開新對話貼上面這段開場白、附上這份文件就可以接手）
