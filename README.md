# 🐷 吃這間！EatIt！

一個根據使用者目前位置或指定地點，自動推薦附近高評價餐廳的 LINE Bot。  
讓「不知道吃什麼」的日常困擾，一鍵解決！🍱✨

---

## 🚀 功能特色

- 📍 **支援位置推薦**：傳送目前位置，推薦附近 3 家高評價餐廳
- 🔤 **支援地點名稱搜尋**：輸入關鍵字（如「台北車站」），也能找美食
- 🧠 **只推薦評價 3.5 以上 & 正在營業的店家**
- 📸 **輪播 Bubble 訊息展示**：包含店名、地址、評分、圖片
- 🍜 **吃這家**：一鍵開啟 Google Maps 導航
- 🔁 **重新推薦**：再換 3 家不同的美食給你選
- 💬 **支援 LINE Flex Message + Postback Button 互動**

---

## 🔧 技術架構

- Node.js + Express
- LINE Messaging API (Flex Message, Postback)
- Google Maps API（Places Nearby Search + Geocoding）
- Vercel Serverless Functions（可一鍵部署）

---

## 📦 安裝與部署

### ✅ 環境需求
- Node.js v16+
- Vercel 帳號 + GitHub repo
- LINE Developers 帳號（需建立一組 Channel）

### 🔌 環境變數設定（`.env`）

```env
LINE_CHANNEL_ACCESS_TOKEN=你的LineAccessToken
LINE_CHANNEL_SECRET=你的LineSecret
GOOGLE_MAPS_API_KEY=你的GoogleMaps金鑰
```

### 🛠 安裝套件

```bash
npm install
```

### 🧪 本地啟動（選用）

```bash
node api/webhook.js
```

### 🚀 部署至 Vercel

1. 將專案 push 至 GitHub
2. 登入 [vercel.com](https://vercel.com) → 新建專案 → 選擇此 repo
3. 設定 `.env` 環境變數
4. 取得你的 webhook URL，如：
   ```
   https://your-vercel-project.vercel.app/webhook
   ```

---

## 📲 LINE Bot 設定

1. 登入 [LINE Developers](https://developers.line.biz/)
2. 建立 Messaging API Channel
3. 在「Webhook URL」貼上你的 Vercel Webhook URL
4. 啟用 Webhook
5. 將 Bot 加為好友後，就可以開始使用！

---

## 🧪 使用方式

| 使用者行為         | Bot 回應                            |
|------------------|------------------------------------|
| 傳送位置          | 推薦 3 家高評價附近餐廳            |
| 傳送文字（地名）   | 轉換為地點 → 推薦餐廳              |
| 傳送貼圖/無效文字  | 提示請傳送位置或有效地點            |
| 點「吃這家」       | 開啟 Google Maps 導航               |
| 點「重新推薦」     | 推出不同的 3 間推薦店家              |

---

## 🧠 想法進化中（TODO）

- [ ] 加入料理分類篩選（中式 / 日式 / 西式）
- [ ] 將推薦結果儲存並讓使用者收藏
- [ ] 增加 Rich Menu 固定啟動鍵
- [ ] 支援 Firebase 儲存使用者喜好

---

## 🙌 Credits

由 [@ungetLai](https://github.com/ungetLai) 開發  
Flex Message 設計、互動邏輯與整合：ChatGPT + Maps API

---

## 📸 預覽畫面

> ![EatIt Demo Screenshot](https://placehold.co/600x400?text=LINE+Bot+EatIt+Preview)

---

## 📜 License

MIT License
