# Taipei Ride · 台北漫遊

一款以台北街景為靈感、自行撰寫的瀏覽器探索遊戲。騎上機車穿梭街區，也可以停車步行；完成原創送茶委託，或隨心收集六站城市印記。

預設使用 **Three.js 0.186.1 / WebGL 2 / 第三人稱鏡頭**。建築、車輛、角色與地標皆為原創程序化幾何。無法使用 WebGL 時，會清楚標示並啟用 **Canvas 2D 等角相容模式**；兩種畫面共用移動、上下車、任務、遊戲幣與存檔。

> 這是想像中的台北主題世界，不是真實地圖、導航工具或交通安全模擬器。道路、距離、速度與碰撞都經過遊戲化處理。

## 快速開始

使用 Node.js 22 與 npm：

```sh
npm ci
npm run dev
```

開啟終端機顯示的網址，預設為 `http://localhost:4173`。初次安裝相依套件需要網路；遊戲本身不使用付費 API、地圖服務金鑰或外部 CDN。

請透過 HTTP 伺服器開啟，不要直接雙擊 `index.html`。可加上 `?renderer=2d` 明確測試相容模式；移除參數並重新整理即可再次嘗試 3D。

## 操作

| 鍵盤 | 功能 |
| --- | --- |
| W / ↑ | 騎車油門／步行前進 |
| S / ↓ | 騎車倒車／步行後退 |
| A / ←、D / → | 左右轉向；步行時可原地轉身 |
| Space | 煞車／停步 |
| F | 停車後下車；走近停放的機車後上車 |
| E | 當前任務互動，或城市收藏支線打卡 |
| P | 暫停／繼續 |
| R | 人車一起回到起點，保留任務、遊戲幣、印章與里程 |
| M | 開啟地圖；Esc 或關閉鈕返回 |
| N | 切換日夜 |
| 滑鼠拖曳（左鍵或右鍵） | 調整 3D 鏡頭視角 |

手機可搭配按住轉向與前進／油門按鈕，並使用畫面上的互動及上／下車按鈕。放開、取消觸控或切換分頁都會清除持續輸入。

標準配置手把可使用左搖桿移動／轉向、右搖桿控制 3D 視角、RT 油門、LT 煞車、A 互動、Y 上下車、X 安全回起點、Start 暫停、View 地圖、B 返回。連接後先按任意按鈕讓瀏覽器辨識；斷線或暫停後須先放開搖桿／扳機回到中立，才會再次接收油門。操作說明提供鍵鼠、手把、觸控三個圖形分頁，只列出目前真正實作的動作。

下車前必須減速；程式會尋找沒有建物、車流或穿牆風險的落腳處。機車會留在原地，必須回到附近才能上車。步行時小地圖的藍色方塊標示停車位置。若人車卡住，可按 R 安全回到起點。

## 開場與主選單

開場先建立真實城市場景，再播放可跳過的 **2.4 秒原創標誌轉場**，進入持續緩慢運鏡的黃昏城市選單。載入時間取決於裝置；畫面不會以假的百分比宣稱場景已備妥。這段轉場是獨立實作，並不是對參考站載入秒數的還原。

- **跳過／重播**：點「跳過開場」或按 Esc；設定中的「重播開場」可重看。系統偏好減少動態時直接顯示靜止選單，也能在設定更改
- **鍵盤選單**：方向上下鍵切換項目，Home／End 移到首尾，Enter 啟動；Tab 保留一般網頁可及性操作
- **角色**：兩位原創城市旅人，阿澄 Cheng 與小晴 Qing；選擇會立即套用並記憶，使用不同外觀的同等能力角色。步行和騎乘共用選角，騎乘仍佩戴安全帽
- **設定**：右側面板提供主音量（預設 80%）、音樂（60%）、音效（90%）、HUD 大小（100%）、FPS（預設關）、3D 畫質（自動）、視角靈敏度（1.0×）、反轉 Y（關）、新手提示（開／可重顯）、選單語言、減少動態與遊戲日夜；原創音樂／按鍵／機車聲由 WebAudio 在本機合成，首次點擊或鍵盤確認後才啟動，不載入參考站錄音
- **畫質**：auto／high 的繪圖像素比例上限為 min(DPR, 1.6)，medium 為 min(DPR, 1.2)，low 為 min(DPR, 0.75)，ultra 為 min(DPR, 2)；仍會依持續幀率調整，最低 0.55。文字介面維持原本解析度。HUD 縮放不縮小觸控駕駛按鈕；短橫向畫面將 HUD 放大限制在 100%，避免面板重疊。2D 相容模式停用 3D 畫質與視角調整
- **語言**：主選單、角色、設定與操作說明提供繁體中文／英文；劇情、任務與遊戲 HUD 目前仍以繁體中文呈現
- **暫停與返回**：全螢幕暫停頁顯示目前街區、真實小地圖、任務與最近提示；地圖、設定、操作說明、統計均能返回暫停，另有全螢幕與救援／重置操作；「返回主選單」先保留旅程，再次開始會繼續既有位置、任務、印章、金幣與停放機車，不會重置
- **全螢幕**：使用瀏覽器原生全螢幕；不支援或拒絕時會提示，仍可正常遊玩

首次新旅程按「開始遊戲」後，另有 **8.4 秒原創遊戲內導入**：抵達街區、阿沐眼平揮手／字幕、任務章名，再恢復控制。可按 Esc、Enter、手把 B／Start 或「跳過」立即結束；跳過與自然結束都會清除輸入鎖，既有位置、停車位、任務與獎勵不受影響。續玩存檔不會每次被迫重播，減少動態時使用靜止鏡頭。這是原創送茶故事的導入，沒有重用參考站人物或對白。

選單與音訊偏好保存在 `taipei-ride:menu:v1`，不改動既有 `taipei-ride:v2` 旅程存檔。沒有付款或抖內流程，作品資訊內僅提供專案連結。所有場景、角色、文字與音訊均為獨立製作，並未使用參考站的角色、品牌、音樂、貼圖或程式碼。

## 原創主線：雨後的一杯茶

1. 到巷口夜市的 **阿沐茶舖**，靠近並慢下來後按 E 接委託。
2. 前往 **街角取貨點**，按 E 領取熱茶。
3. 騎上機車送往老街，領物後須實際騎乘至少 100 個遊戲距離單位。步行不會增加配送騎乘里程。
4. 到 **老街修傘攤** 附近停車，按 F 下車，再走近按 E 交付。
5. 完成後獲得 **300 遊戲幣**，同一委託只會發放一次獎勵。

未接單、未領物、騎乘距離不足、位置不對或仍在機車上，都無法完成交付。熱茶會顯示在 HUD 與角色／機車上；目的地和提示隨階段更新。這些遊戲幣沒有現金價值，也不涉及任何付款。

## 支線：六站城市收藏

在右側印章列或地圖選擇地標，即切換到城市收藏支線。靠近地標並減速後按 E 打卡；可騎車或步行完成。每站只計一次，集滿六站後仍可自由漫遊。

地圖裡的「追蹤主線」可隨時返回送茶任務，不會清除支線收藏。

## 存檔與重置

- v2 存檔鍵為 `taipei-ride:v2`，包含角色位置、機車停放位置、移動模式、任務階段、配送騎乘里程、獎勵旗標、遊戲幣、印章、總里程、日夜與追蹤目標。
- 載入時角色與機車都會停止。越界、建物內或非法座標會安全修正；數值、任務階段及印章也會驗證。
- 沒有 v2 存檔時，會讀取舊 `taipei-ride:v1` 的印章、里程與日夜，保留既有收藏並建立新主線。舊版備份不會被刪除；新進度寫入 v2。
- 進度保存在目前網站來源的瀏覽器 `localStorage`。不同裝置、瀏覽器、網域或連接埠不會共用。清除網站資料或私密瀏覽政策可能使進度消失。
- 儲存被瀏覽器阻擋時，會持續提示「進度無法儲存」，不會假裝已保留。
- R 是救援移位，不清除進度。暫停選單的「重新開始完整旅程」在確認後清除主線、遊戲幣、印章、里程及人車位置，回到新遊戲狀態。
- 沒有帳號、雲端存檔、多人連線或個人資料上傳功能。

## 建置與測試

```sh
npm test                 # 物理、狀態機、DOM 與真3D場景數學回歸
npm run build            # 輸出完整靜態網站至 dist/
npm run preview          # 預覽 dist/，預設 4173

# 真 Chromium / WebGL 瀏覽器驗收（需可執行瀏覽器的環境）
npx playwright install --with-deps chromium
npm run test:browser
```

`predev`、`pretest` 與 `prebuild` 會準備本機 Three.js 檔案。Three.js 授權原文會隨成品放在 `dist/vendor/LICENSE.three.txt`；部署時須保留。

GitHub Actions 會執行一般測試、建置，以及桌機、手機直向與橫向的 Chromium/WebGL 測試，保存截圖和 trace。另有一條透過真鍵盤行駛的完整送茶路線。**包含測試程式不代表已通過真瀏覽器驗收，應查看對應 commit 的 CI 結果和影像。** 詳細分層證據與限制見 [QA.md](QA.md)。

## 部署

不需要後端、資料庫、環境變數或 API 金鑰。將完整 `dist/` 部署到靜態 HTTP 主機即可，不能只傳 `index.html`。

- Netlify：已附 `netlify.toml`，建置 `npm run build`，輸出 `dist`，Node.js 22
- Vercel：已附 `vercel.json`，無框架靜態建置，輸出 `dist`
- GitHub Actions 會保存靜態成品；工作流程不會自動發布網站

包含部署設定不代表已部署。發布前應確認公開範圍和主機費用。

## 本輪範圍與待補

本輪補齊步行／機車切換、獨立停車、原創多階段委託及 v2 完整存檔。六站打卡保留為支線。

追逐／通緝系統、補給消耗及更完整的城市生活互動列為後續項目，本輪尚未實作。街區、畫風、任務內容和規模也仍與參考網站不同。

## 原創與授權

原創專案採 [MIT License](LICENSE)。相依套件和素材聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本次未取得 `taipei-gta.vercel.app` 的公開原始碼。Taipei Ride 是以城市探索玩法為參考、自行撰寫的獨立版本，**不是原作備份、原始碼匯出或原版還原包**。沒有複製原站程式碼或素材，也不與該網站、作者或任何第三方遊戲品牌有隸屬、合作或贊助關係。地名與地標僅作氛圍靈感，並非官方認證或精確地理重建。

## 慢速圖形環境

3D 會根據持續數秒的真實畫面耗時，自動調整繪圖像素比例；最低為 0.55，畫面恢復穩定後才逐步回升。介面文字與控制按鈕維持原本 CSS 解析度。這只調整 3D 繪圖負荷，不會加快遊戲時間、縮短路線、改變物理或切換成 2D。可用唯讀的 `window.taipeiRide.snapshot()` 檢視實際比例與 drawing-buffer 尺寸。

## 第一輪視覺修正

本輪以自行製作的幾何與紋理，調整較自然的人物頭身比例、分肢與鞋子，補上機車前擋板、踏板、後照鏡與燈具辨識細節；街景新增格磚人行道、路緣、雙黃線、店面柱廊／雨遮／卷簾及原創繁中店招。大量重複細節使用批次繪製，沒有匯入參考網站的程式碼、模型、貼圖或招牌。

新畫面須查看對應提交的真 WebGL CI 截圖，不把離線示意圖當成實機驗收。參考原作的城市密度、材質寫實度、動作種類、追逐與其他系統仍有明顯差異，本次沒有宣稱同等還原。

## 人車尺度與實體碰撞修正

統一採用每公尺 10 個世界單位：人物約 1.72 m、機車長 2 m、汽車長 4.4 m／寬 1.8 m／高 1.5 m、店門高 2.2 m，建築首層 3.2 m、其餘樓層 3 m。人物與車輛新增臉部、頭髮、手指、衣鞋、座椅、踏板、把手、輪框與玻璃細節，坐姿與車體接觸點有幾何測試。

步行、騎車、停放機車與車流使用共用實體輪廓，包含建築、樹幹和路燈底座。正撞會停止，斜撞可沿障礙邊界滑移；車流會讓行，持續油門不會取消碰撞。樹與路燈目前不會被撞斷。車道位置與七公尺道路寬度一致，沒有為避碰縮小車輛輪廓。

本輪本地 154 項測試與建置通過。CI 另外驗證正常控制的建築／靜車／動車接觸、斜滑、兩種角色與NPC近景、三尺寸選單／抵達導入／街景、滑鼠視角，以及原完整送茶路線；每次來源碼更新仍需該 commit 自己的真 WebGL 結果。手機實機與實體手把尚未驗證。

## English

Taipei Ride is an original Taipei-inspired browser exploration game. Ride a scooter, park it and walk, complete a multi-stage tea-delivery quest for a one-time 300 in-game coin reward, or collect six optional landmark stamps. The default renderer uses real Three.js/WebGL 2 geometry and a third-person camera. A clearly labeled Canvas 2D compatibility renderer shares all gameplay and saved progress.

Use Node.js 22, then `npm ci`, `npm run dev`, `npm test`, and `npm run build`. WASD/arrows move and turn, Space brakes, F mounts/dismounts, E interacts, P pauses, R safely returns both actor and scooter to the start without losing progress, M opens the map, and N changes day/night. Touch controls are included.

Version 2 browser-local saves preserve actor and parked-scooter positions, travel mode, quest state, coins, stamps and atmosphere, with safe legacy-v1 migration. Full journey reset requires confirmation. No account, paid API, external CDN, real-money transaction or cloud-save service is needed.

Playwright-based CI checks real Chromium WebGL and captures screenshots. See the exact commit's CI report rather than treating mocked DOM or offline scene tests as proof of browser rendering. Pursuit and replenishment systems remain future work. This is an independently authored game, not the reference site's source-code backup or asset copy.
