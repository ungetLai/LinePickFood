
const { middleware, Client } = require('@line/bot-sdk');
const express = require('express');
const { Client: MapsClient } = require('@googlemaps/google-maps-services-js');
const getRawBody = require('raw-body');
require('dotenv').config();

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);
const googleMapsClient = new MapsClient({});
const userLocations = new Map();

// 自定義 middleware 支援 rawBody
app.use((req, res, next) => {
  getRawBody(req)
    .then((buf) => {
      req.rawBody = buf;
      next();
    })
    .catch((err) => {
      console.error('Raw body error:', err);
      res.status(400).send('Invalid body');
    });
});

app.use(middleware(config));

app.post('/api/webhook', (req, res) => {
  Promise.all(req.body.events.map(async (event) => {
    if (event.type === 'message' && event.message.type === 'location') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📍 收到位置（這裡可加入推薦邏輯）'
      });
    } else {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請傳送您的位置資訊，點選輸入框左側的「＋」並選擇「位置資訊」以獲取附近美食推薦 🍱'
      });
    }
  }))
    .then(() => res.status(200).send('OK'))
    .catch((err) => {
      console.error('LINE Webhook Error:', err);
      res.status(500).end();
    });
});

module.exports = app;
