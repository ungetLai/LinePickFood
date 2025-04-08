const express = require('express');
const app = express();

// 健康檢查端點
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'LinePickFood API is running',
    version: '1.0.0'
  });
});

// 導入 webhook 路由
const webhookRouter = require('./api/webhook');
app.use('/api', webhookRouter);

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 