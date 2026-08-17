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

專案裡有三個獨立的前端網站都還沒有正式部署：**首頁**（已做好、測試中）、**顧客預購網站**
（`site/` 資料夾）、**老闆後台 PWA**（repo 根目錄的 `index.html`、`js/`、`css/` 等）。這次要把
三個都部署到 Cloudflare Pages，各自綁一個子網域，並確認 Worker 的 CORS／路由設定沒問題。

---

## 目前狀態

- Phase 0～6 全部完成，Google Sheets 表結構、Worker API、顧客網站前端、老闆後台 PWA
  都已經串好真實資料，功能可以正常運作（見下方「目前進度」完整清單）
- **首頁已經做好，目前在測試中**——放在哪個 repo／資料夾待確認，Phase 7 開始動手前
  要先跟業主核對一次（目前這份 `abspbt/yjg-order` repo 裡還沒看到首頁的檔案）
- **顧客網站（`site/`）目前完全沒有部署到任何網址**，只在本機瀏覽器測試過
- **老闆後台 PWA 目前是暫時透過 GitHub Pages 在跑**：`https://abspbt.github.io/yjg-order/`
  （這是開發過程中為了方便手機測試先臨時掛上去的，**Phase 7 已經定案要搬到 Cloudflare
  Pages**，見下方「部署架構」）
- Worker 已經上線且穩定運作：`https://ygg-hidden-star-9fe8.drum3126.workers.dev`，
  CORS 目前是開放所有來源（`Access-Control-Allow-Origin: *`），所以不管三個網站
  部署到哪個網域，理論上都不用改 Worker 的 CORS 設定
- 網域：我會先跟業主確認、購買正式網域後再串接，還沒買之前可以先用 Cloudflare Pages
  預設的 `*.pages.dev` 子網域開發測試

---

## 部署架構（已定案，2026-08-17 討論決定）

三個網站各自獨立，各自在 Cloudflare Pages 建一個專案，各自綁一個**自訂子網域**
（不用 GitHub Pages，也不直接把 Cloudflare 給的 `*.pages.dev` 網址交給老闆或客人用）：

| 網站 | 內容 | Cloudflare Pages 的 Root directory | 網域（示意，實際名稱到時再定） |
|---|---|---|---|
| 首頁 | 店家資料、公告、連到訂購網站的連結 | 待確認（看首頁放在哪個資料夾） | `xxx.com`（買下來的網域主網址） |
| 顧客訂購網站 | 現有 `site/` 資料夾 | `site/` | 例如 `order.xxx.com` |
| 老闆後台 PWA | repo 根目錄的 `index.html`／`js/`／`css/` 等 | `/`（repo 根目錄） | 例如 `boss.xxx.com`（**刻意不公開**，不放在首頁或任何頁面的連結裡，只給老闆自己收藏／加到手機主畫面用） |

**為什麼這樣做**（討論時的理由，之後接手不用重新討論）：

- **一律用自訂子網域，不直接用 `*.pages.dev` 原始網址**：自訂網域是綁定在 Cloudflare Pages
  專案本身，之後就算改 Pages 專案的名稱，綁好的自訂網域也不會跟著壞掉——這正是這次把 repo
  從 `yggbagle` 改名成 `yjg-order` 時，GitHub Pages 網址因為「跟著 repo 名稱走」而需要重新
  設定的同一種坑，用自訂網域從一開始就避開，之後不用再擔心「哪天改了名稱、老闆手機上的
  捷徑突然打不開」
- **老闆後台的子網域刻意不公開**：不放在首頁或任何公開頁面的連結裡，藉此達到「客人打錯字、
  滑到不該進去的頁面」的機率降到最低。但要注意：**這只是方便，不是安全機制本身**，真正
  擋住未授權存取的還是 PIN 登入 + Worker 的 token 驗證（Phase 3-5 已經做好），就算網址被
  猜到，沒有 PIN 一樣進不去任何後台功能
- **三個網站各自獨立部署**（不是拿一個 Cloudflare Pages 專案直接指向 repo 根目錄、把整個
  repo 當靜態網站生出來）：這樣 `worker/` 資料夾（裡面有 `README.md`、部署用的合併版程式碼
  `dashboard-single-file.js`）就不會被任何一個網站當成靜態檔案生出來、被外人用網址直接打開看到
- **設定方式**：同一個 GitHub repo 可以在 Cloudflare Pages 建立多個專案，各自在專案設定裡
  指定不同的「Root directory（根目錄）」，全部都在 Dashboard 網頁介面操作，不用碰終端機

**未來如果要做「不同類型的團購」**（老闆之前提過、跟現在的貝果團購分開處理，這次討論沒有
展開，留給真的要做的時候再處理）：可以在顧客訂購網站這個子網域底下，用資料夾對應子路徑的
方式管理多個團購單，不用每個團購單各自申請一個子網域：
```
/team-a/index.html  →  order.xxx.com/team-a/
/team-b/index.html  →  order.xxx.com/team-b/
```
現有的 `site/` 資料夾就是「團購單A」（貝果團購）。這件事不影響這次「三個部署、各自子網域」
的決定，只是之後如果要加團購單B、C…，是在顧客訂購網站這個專案裡加資料夾，不用整個部署架構
重來。

---

## Repo 裡前端的位置（給接手的人參考）

- **首頁**：位置待確認（目前 `abspbt/yjg-order` 這份 repo 裡還沒有，可能在別的地方做的，
  Phase 7 開始前要先跟業主確認清楚，並決定要不要把它搬進這個 repo）
- **顧客預購網站**：`site/index.html`、`site/js/app.js`、`site/css/`（如果有的話，實際結構請
  直接看 repo）——純前端單頁式網站，串接 Worker 的公開 API（`GET /settings`、`GET /campaigns`、
  `GET /products`、`POST /orders`），不需要登入
- **老闆後台 PWA**：repo 根目錄的 `index.html`、`js/app.js`、`js/api.js`、`css/style.css`、
  `manifest.json`、`sw.js`、`icons/`——PWA（可加到手機主畫面），PIN 登入後才能用，串接 Worker
  需要登入的 API
- 顧客網站跟老闆 PWA 是**完全獨立**的兩個網站，各自有自己的 `index.html`，各自建一個
  Cloudflare Pages 專案（用同一個 repo、指定不同的 Root directory）來部署
- `worker/` 資料夾是 Cloudflare Worker（已經上線，不用重新部署，除非之後 Worker 程式碼有改動），
  **不屬於任何一個 Cloudflare Pages 專案的 Root directory**，不會被部署出去

---

## Phase 7 要做的事（照 `CLAUDE.md` 大綱，已依上面「部署架構」調整）

- [ ] 跟業主確認網域購買狀況
- [ ] 確認首頁目前放在哪個 repo／資料夾，決定要不要搬進 `abspbt/yjg-order` 這個 repo，
      或維持獨立管理
- [ ] 在 Cloudflare Pages 建立 3 個專案，各自指定 Root directory（首頁／`site/`／repo
      根目錄），各自綁定自訂子網域（見上方「部署架構」表格）
- [ ] 確認老闆後台的子網域**沒有**被不小心放進首頁或任何公開頁面的連結裡
- [ ] 確認 Worker 路由/CORS 設定跟三個新網域都相容（目前是開放所有來源，理論上不用改，
      但要實際測試過）
- [ ] DNS 設定確認三個網址都能從外部（不是本機、不是開發環境）正常連線
- [ ] 老闆後台 PWA 部署到新網址後，確認「加到主畫面」還能正常運作（`manifest.json` 的
      `start_url`／`scope` 是相對路徑 `./`，理論上不用改，但要實際測試），並提醒老闆在
      手機上重新加一次主畫面捷徑（舊的 GitHub Pages 捷徑之後會失效）

**驗收標準**：三個網址都能從外部正常打開並運作；老闆後台 PWA 從新網址重新加到手機主畫面，
PIN 登入、各頁面功能都正常；顧客訂購網站可以走完整下單流程。

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

現在要做 Phase 7：部署 + 網域設定。部署架構已經定案（詳見文件裡「部署架構」段落）：
首頁、顧客訂購網站（現有 site/ 資料夾）、老闆後台 PWA 三個各自獨立部署到 Cloudflare
Pages，各自綁一個自訂子網域（不用 GitHub Pages，也不直接用 Cloudflare 給的 *.pages.dev
原始網址）。首頁掛在買下來的網域主網址，顧客訂購網站掛在一個好記的子網域，老闆後台掛在
一個刻意不公開、不放連結的子網域。首頁目前已經做好在測試中，但放在哪個 repo／資料夾
還要先跟我確認。

詳細背景、目前狀態、Repo 結構都寫在 HANDOFF_PHASE7_DEPLOY.md，請先讀這份文件再開始。

⚠️ 我不熟悉終端機下指令，Cloudflare 相關設定請優先教我用網頁 Dashboard 操作。
⚠️ 一律用中文回應。
```

（這份文件已經放在 repo 根目錄，開新對話貼上面這段開場白、附上這份文件就可以接手）
