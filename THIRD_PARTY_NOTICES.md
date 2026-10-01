# Third-party notices / 第三方聲明

## Original project / 原創專案

Taipei Ride / 台北漫遊的原創程式碼與隨附文件以專案根目錄的 [MIT License](LICENSE) 授權。第三方函式庫保留其原有版權與授權；見下節的 Three.js 聲明。

本專案的城市、車輛、地標示意圖與介面採用自行撰寫的幾何造型、CSS，以及 Three.js／瀏覽器繪圖功能；未隨附第三方照片、地圖圖磚、預製 3D 模型、貼圖、音樂或商用遊戲素材。

開場選單中的圖示與角色卡片插圖為原創 SVG／CSS。背景音樂、選單按鍵聲與機車引擎聲由原創 WebAudio 合成器在本機產生，未使用參考網站錄音、第三方音樂檔或取樣素材。

## Runtime / 執行階段

- **Three.js 0.186.1** 是唯一的第三方執行階段相依套件，負責預設的第三人稱 WebGL 2 3D 場景；版本固定於 `package.json` 與 `package-lock.json`。
- Three.js 以 **MIT License** 授權：Copyright © 2010-2026 three.js authors。官方來源：[mrdoob/three.js](https://github.com/mrdoob/three.js)；官方授權原文：[LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。
- 安裝套件中的完整版權聲明與 MIT 授權文字會原樣複製至建置成品的 `dist/vendor/LICENSE.three.txt`。重新散布成品時，請保留這個檔案；應以實際安裝版本隨附的授權文字為準。
- Canvas 2D 等角投影為相容備援顯示模式，並非 3D 主版本。兩種顯示模式共用世界資料、騎乘物理、操作與打卡進度。
- 使用使用者裝置上的系統字型；專案不重新散布字型檔，也不從第三方字型服務載入字型。
- Node.js 與 npm 是本機開發、測試與建置工具，不隨網站的靜態輸出一起散布。它們依各自的授權條款提供。

## Reference and non-affiliation / 參考與無關聯聲明

本次未取得 taipei-gta.vercel.app 公開的原始碼。本專案為自行撰寫的復刻風格獨立實作，不是原作備份、原始碼匯出或原版還原包。未複製原站的程式碼、素材或網站內容，也不與該網站、其作者或任何第三方遊戲品牌具有隸屬、合作、授權或贊助關係。

台北地名與地標名稱僅用於描述城市靈感；幾何外觀、道路與位置均為遊戲化想像，不是官方地圖或精確重建。相關名稱的權利仍屬各自權利人。

## Maintenance / 後續維護

若日後加入或更新第三方套件、素材或字型，請先確認其授權與使用範圍，並將所需的版權聲明、授權文字和來源補充至本文件。更新 Three.js 時，請一併核對鎖定版本與隨成品散布的授權原文。

## English summary

The game uses original procedural geometry, JavaScript modules, CSS, and locally available system fonts. Three.js is its sole third-party runtime dependency, providing the default third-person WebGL 3D renderer; a native Canvas 2D isometric renderer is the compatibility fallback. Three.js is copyright its authors and licensed under MIT. The complete license from the installed package is copied unchanged to `dist/vendor/LICENSE.three.txt` and must remain in redistributed builds. No third-party map tiles, photographs, prebuilt models, textures, music, or font files are bundled.

The reference site's source code was not available to this implementation. This is an independently written, style-inspired recreation, not a backup or export of the original. It does not copy code or assets from, and is not affiliated with, taipei-gta.vercel.app or any third-party game brand. Taipei-inspired names and locations are illustrative, not authoritative geographic data. See [LICENSE](LICENSE) for the original project code's MIT license.

## Development-only tooling

CI screenshot runners install a single Noto Sans CJK TC font from the official [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) source, pinned and integrity-checked by the test setup. It is licensed under the SIL Open Font License 1.1; the upstream license is installed beside the font on the temporary runner. No font files are copied into this repository or the static game build.

Automated DOM-flow tests use jsdom 26.1.0 (MIT) and its npm dependencies. These development packages are pinned in package-lock.json and are not included in the static game bundle. Their package license files remain with the installed development dependencies.

- **@playwright/test 1.63.0**, Playwright and playwright-core are development-only browser-test tools, licensed under **Apache License 2.0**. Official project: [microsoft/playwright](https://github.com/microsoft/playwright). Their complete license files are retained in the installed development packages at `node_modules/@playwright/test/LICENSE`, `node_modules/playwright/LICENSE` and `node_modules/playwright-core/LICENSE`. They and the downloaded Chromium test browser are not included in the static game bundle. Chromium retains its own upstream and bundled-component licenses.
