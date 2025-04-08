
const express = require('express');
const line = require('@line/bot-sdk');
const { Client } = require('@googlemaps/google-maps-services-js');

require('dotenv').config();

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const googleMapsClient = new Client({});

app.post('/api/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(async (event) => {
    if (event.type === 'message' && event.message.type === 'text') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請傳送您的位置資訊，點選輸入框左側的「＋」並選擇「位置資訊」以獲取附近美食推薦 🍱'
      });
    }
    if (event.type === 'message' && event.message.type === 'location') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📍 收到位置，這裡應該會觸發推薦功能（略）'
      });
    }
  }))
    .then(() => res.status(200).send('OK'))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

module.exports = app;
