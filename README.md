# Line Food Recommender Bot

這是一個 Line Bot 應用程式，可以根據使用者位置推薦附近的餐廳，並提供導航功能。

## 功能特點

- 根據使用者位置推薦附近評分最高的 3 家餐廳
- 使用輪播訊息展示餐廳資訊，包含：
  - 餐廳照片
  - 餐廳名稱
  - 評分
  - 地址
- 提供「吃這家」按鈕，可直接導航到選擇的餐廳
- 提供「重新推薦」按鈕，可獲取新的推薦
- 只推薦評分 3.5 以上的優質餐廳

## 安裝需求

- Node.js (v14 或以上)
- Line Messaging API 帳號
- Google Maps API 金鑰（需要 Places API 權限）

## 安裝步驟

1. 複製專案到本地：
```bash
git clone https://github.com/ungetLai/LinePickFoog.git
cd LinePickFoog
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
4. Bot 會顯示 3 家推薦餐廳的輪播訊息
5. 你可以：
   - 點擊「吃這家」按鈕來獲取餐廳位置並導航
   - 點擊「重新推薦」按鈕來獲取新的推薦

## 功能展示

1. 傳送位置後，Bot 會顯示 3 家推薦餐廳的輪播訊息
2. 每家餐廳的資訊包含：
   - 餐廳照片（如果有）
   - 餐廳名稱
   - 評分
   - 地址
   - 「吃這家」按鈕
3. 點擊「吃這家」按鈕後，Bot 會傳送餐廳的位置訊息
4. 點擊「重新推薦」按鈕後，Bot 會重新搜尋並推薦 3 家餐廳

## 注意事項

- 請確保你的 Line Bot 已經設定好 Webhook URL
- Google Maps API 金鑰需要有 Places API 的權限
- 建議使用 ngrok 等工具來測試 Webhook
- 餐廳搜尋範圍設定為 1 公里
- 只顯示評分 3.5 以上的餐廳

## 授權

MIT License 