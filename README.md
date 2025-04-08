# Line Food Recommender Bot

這是一個 Line Bot 應用程式，可以根據使用者位置推薦附近的餐廳。

## 功能特點

- 根據使用者位置推薦附近餐廳
- 隨機選擇高評分餐廳（評分 3.5 以上）
- 提供餐廳名稱、地址和評分資訊

## 安裝需求

- Node.js (v14 或以上)
- Line Messaging API 帳號
- Google Maps API 金鑰

## 安裝步驟

1. 複製專案到本地：
```bash
git clone [repository-url]
cd line-food-recommender
```

2. 安裝依賴套件：
```bash
npm install
```

3. 設定環境變數：
   - 複製 `.env.example` 為 `.env`
   - 填入你的 Line Bot Channel Access Token
   - 填入你的 Line Bot Channel Secret
   - 填入你的 Google Maps API 金鑰

4. 啟動伺服器：
```bash
npm start
```

## 使用方式

1. 將 Line Bot 加入好友
2. 傳送「推薦」或「附近美食」等關鍵字
3. 傳送你的位置資訊
4. Bot 會隨機推薦一家附近的餐廳

## 注意事項

- 請確保你的 Line Bot 已經設定好 Webhook URL
- Google Maps API 金鑰需要有 Places API 的權限
- 建議使用 ngrok 等工具來測試 Webhook

## 授權

MIT License 