# Taipei Ride · 台北漫遊

一款以台北街景為靈感的獨立瀏覽器騎乘小遊戲。騎車穿梭原創街區，依地圖前往地標，減速停靠並拍照打卡；集滿 6 枚印章後，仍可繼續自由漫遊。

預設使用 **Three.js、WebGL 與第三人稱跟隨鏡頭**，在真正的 3D 場景中騎乘；建築、街景與車輛採用原創、由程式生成的幾何造型。另保留自製等角投影 **Canvas 2D 相容備援模式**，供無法使用 WebGL 的環境使用。兩種模式共用世界資料、騎乘物理、操作與地標集章進度。

Three.js 0.186.1 是唯一的第三方執行階段相依套件，以 MIT 授權使用；遊戲不需要付費 API、地圖服務金鑰或外部 CDN。

> 這是想像中的台北主題遊戲世界，不是真實道路地圖、導航工具或交通安全模擬器。街區、距離、路線、車速與碰撞均經遊戲化處理；請勿用於現實駕駛判斷。

## 快速開始

需要 Node.js 22 與 npm。下載並解壓完整專案後，在專案根目錄執行：

```sh
npm ci
npm run dev
```

`npm ci` 會依 `package-lock.json` 安裝固定版本的 Three.js，初次安裝需要網路。依終端機顯示的網址開啟遊戲；預設為 `http://localhost:4173`。

**請透過 HTTP 伺服器開啟，不要直接雙擊 `index.html`。** 瀏覽器對 `file://` 下的 JavaScript 模組有存取限制。

### 3D 與相容模式

支援 WebGL 2 的瀏覽器會預設使用第三人稱 3D，畫面上標示「3D 漫遊」。無法初始化 WebGL 時會自動改用「2D 相容模式」。如需主動測試備援，可開啟 `http://localhost:4173/?renderer=2d`；移除網址參數並重新整理，即會再次嘗試啟用 3D。切換模式不會清除同一網站來源下的集章進度。

## 操作方式

| 鍵盤 | 功能 |
| --- | --- |
| `W` / `↑` | 油門、向前行駛 |
| `S` / `↓` | 倒車 |
| `A` / `←`、`D` / `→` | 左轉、右轉 |
| `Space` | 煞車 |
| `E` | 在地標附近減速後拍照打卡 |
| `P` | 暫停／繼續 |
| `R` | 重置車輛位置，保留已完成的打卡進度 |
| `M` | 開啟地圖；按 `Esc` 或關閉鈕返回 |
| `N` | 切換日間／夜間氛圍 |

手機與平板可使用畫面上的「左轉／右轉／油門／倒車／煞車」觸控按鈕，並以「拍照打卡」完成地標互動。轉向與油門可搭配操作；放開按鈕即停止該項輸入。

### 如何完成旅程

1. 開始遊戲，查看地圖與目前的地標目標。
2. 沿街道騎到目標附近，先鬆開油門並煞車。
3. 在互動範圍內、車速足夠低時，按 `E` 或「拍照打卡」。車速過快或距離太遠時，請再靠近並減速。
4. 繼續探索其他地標，集滿 6 枚印章；完成後可繼續自由騎乘。

遇到卡住或想重新回到可行駛位置時，按 `R` 重置車輛即可，不必清除整段旅程。

## 進度與隱私

- 地標打卡進度儲存在目前瀏覽器的 `localStorage`，不需要帳號。
- 存檔與網站來源綁定；不同瀏覽器、裝置、網域或連接埠不會自動共用進度。
- 清除網站資料、改用其他瀏覽器，或結束不保留網站資料的私密瀏覽工作階段，可能使進度消失。
- `R` 只重置車輛。若要清除旅程進度，請從暫停選單選擇「重新開始集章旅程」並確認提示。
- 遊戲沒有雲端存檔、多人連線或帳號系統。部署平台本身的連線紀錄與隱私政策由各平台管理。

## 建置、測試與預覽

```sh
# 執行專案測試
npm test

# 產生可部署的靜態網站
npm run build

# 在本機預覽建置成品，預設連接埠 4173
npm run preview
```

`dev` 與 `build` 會先自動準備本機 Three.js 檔案。建置會將來源、公開檔案與 Three.js 整理至 `dist/`，不需要遠端編譯服務或外部 CDN。Three.js 的授權原文隨成品保存在 `dist/vendor/LICENSE.three.txt`。請在修改後重新建置，再檢查 `dist/` 的實際成品。

### 手動驗收建議

- 顯示模式：確認支援 WebGL 時使用第三人稱 3D 主版本；無法使用 WebGL 時可進入清楚標示的 Canvas 2D 相容模式，且兩者共用任務進度。
- 桌面：確認前進、倒車、轉向、煞車、暫停、地圖切換、日夜切換與車輛重置。
- 觸控：確認油門加轉向的組合操作，以及手指抬起後不會持續輸入。
- 打卡：檢查太遠或太快時無法打卡、靠近減速後可完成，以及同一地標不會重複增加印章。
- 存檔：取得印章後重新整理，確認進度保留；確認重置車輛保留印章，重置旅程則會要求確認。
- 旅程：完成全部 6 枚印章後，確認仍能自由漫遊。
- 視窗：檢查桌面與手機尺寸、旋轉螢幕、切換分頁後返回，以及連續開關選單。
- 成品：以 `npm run preview` 開啟，確認瀏覽器主控台沒有錯誤，靜態檔案沒有遺失。

以上是驗收清單，不代表所有瀏覽器、裝置或情境均已完成測試。請使用支援 JavaScript 模組的現代瀏覽器；3D 主版本需要可用的 WebGL 2 與相容圖形環境，2D 備援模式需要 Canvas 2D。實際流暢度取決於裝置、圖形驅動與畫面尺寸。

## 靜態部署

本專案不需要後端、資料庫、環境變數或 API 金鑰。將建置後的 `dist/` 整個資料夾交由靜態 HTTP 網站服務即可。

已附上以下設定檔，**但包含設定檔不代表已發布網站**：

- **Netlify**：`netlify.toml` 指定 `npm run build`、輸出目錄 `dist` 與 Node.js 22。若專案位於大型儲存庫的子目錄，請在平台設定該子目錄為專案根目錄。
- **Vercel**：`vercel.json` 指定無框架的靜態建置、`npm run build` 與輸出目錄 `dist`。匯入時請選擇本專案目錄，並使用 Node.js 22。
- **其他靜態主機**：先執行 `npm run build`，再上傳 `dist/` 內的完整檔案結構；請勿只上傳 `index.html`。

平台設定欄位可能更新，詳見 [Netlify 的檔案設定說明](https://docs.netlify.com/build/configure-builds/file-based-configuration/) 與 [Vercel 專案設定說明](https://vercel.com/docs/project-configuration)。發布前請自行確認網站的公開範圍與平台費用。

## 原創、授權與界線

本專案以 MIT 授權提供；見 [LICENSE](LICENSE)。素材與相依性說明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本次未取得 `taipei-gta.vercel.app` 公開的原始碼。Taipei Ride / 台北漫遊是自行撰寫、以城市騎乘玩法與氛圍為參考的復刻風格作品，**不是原作備份、原始碼匯出或原版還原包**。沒有複製原站的程式碼或素材，也不與該網站、其作者或任何第三方遊戲品牌有隸屬、合作或贊助關係。台北地名只作城市氛圍與地標靈感之用，並非官方認證或精確地理重建。

## English

**Taipei Ride** is an independent, Taipei-inspired browser riding game with six landmark check-ins and free roaming. Its default renderer provides a true 3D WebGL 2 scene and third-person follow camera using Three.js. A clearly labeled custom isometric Canvas 2D fallback shares the same world data, driving physics, controls, and check-in progress. All scene geometry is original and procedural. Append `?renderer=2d` to the URL to test the fallback explicitly.

Use Node.js 22. Run `npm ci` first, then `npm run dev`, `npm test`, `npm run build`, and `npm run preview`; the local server defaults to port 4173 and production output is `dist/`. Three.js 0.186.1 is the sole runtime dependency and is pinned by the lockfile. Its MIT license is included in `dist/vendor/LICENSE.three.txt`. No paid APIs, map-service keys, or external CDN are required. Serve the game over HTTP rather than opening an HTML file directly.

Drive with WASD or arrow keys, brake with Space, check in with E when nearby and moving slowly, pause with P, reset the vehicle with R, open the map with M, and switch day/night with N. Touch controls are included. Check-in progress stays in local browser storage; R preserves it, while the separate journey-reset action asks for confirmation.

The map and driving model are fictionalized and must not be used for navigation or real-world road-safety decisions. The reference site's source code was not available to this implementation: this is an independently written, style-inspired recreation, not a backup or export of the original. It is unaffiliated with `taipei-gta.vercel.app` and does not reuse its code or assets. Original project code is released under the [MIT License](LICENSE); see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for Three.js attribution.

## 驗證狀態

目前 33 項自動測試通過，涵蓋核心物理、立體幾何、DOM 操作流程、備援切換與六站完成。瀏覽器 WebGL 實機與完整手機排版驗收仍待可用裝置檢查；詳見 [QA.md](QA.md)，不將模擬測試視為實機驗證。
