
// webhook.js (完整互動式推薦流程)
const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const { Client: MapsClient } = require('@googlemaps/google-maps-services-js');
const getRawBody = require('raw-body');
require('dotenv').config();

const app = express();
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);
const mapsClient = new MapsClient({});

const userSessions = new Map();
const CUISINE_KEYWORDS = {
  中式: ['chinese'],
  日式: ['japanese'],
  西式: ['western', 'american', 'european'],
  韓式: ['korean'],
  台式: ['taiwanese']
};

app.use((req, res, next) => {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: req.charset || 'utf-8'
  }).then((buf) => {
    req.rawBody = buf;
    req.body = JSON.parse(buf);
    next();
  }).catch((err) => {
    console.error('Raw body error:', err);
    res.status(400).send('Invalid body');
  });
});
app.use(middleware(config));

app.post('/api/webhook', async (req, res) => {
  try {
    await Promise.all(req.body.events.map(event => handleEvent(event)));
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

async function handleEvent(event) {
  const userId = event.source.userId;
  if (event.type === 'message' && event.message.type === 'location') {
    userSessions.set(userId, { location: event.message, step: 'start' });
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '你想吃什麼料理呢？（中式、日式、西式、台式、韓式，不限）'
    });
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const session = userSessions.get(userId);

    if (!session) {
      if (event.message.text.toLowerCase().includes("開始找餐廳")) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請傳送您目前的位置 📍 我們將為您推薦附近美食！'
        });
      }

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '👋 歡迎使用 EatIt 美食推薦機器人！想找餐廳嗎？點下面的按鈕來開始推薦 🍜',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '我要找餐廳 🍽️',
                text: '開始找餐廳'
              }
            }
          ]
        }
      });
    
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '👋 歡迎使用 EatIt 美食推薦機器人！請先傳送您的位置 📍'
      });
    }

    const text = event.message.text.trim();
    if (session.step === 'start') {
      session.cuisine = Object.keys(CUISINE_KEYWORDS).includes(text) ? text : '不限';
      session.step = 'rating';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '想找幾星以上的餐廳呢？（請輸入 1～5，預設 3）'
      });
    }

    if (session.step === 'rating') {
      const stars = parseFloat(text);
      session.rating = (stars >= 1 && stars <= 5) ? stars : 3;
      session.step = 'radius';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '想搜尋多遠範圍的餐廳？（請輸入數字，單位公尺，預設 2000）'
      });
    }

    if (session.step === 'radius') {
      const r = parseInt(text);
      session.radius = (r >= 300 && r <= 5000) ? r : 2000;
      session.step = 'done';

      const { latitude, longitude } = session.location;
      const cuisineFilter = CUISINE_KEYWORDS[session.cuisine] || [];

      const res = await mapsClient.placesNearby({
        params: {
          location: { lat: latitude, lng: longitude },
          radius: session.radius,
          type: 'restaurant',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      const filtered = res.data.results.filter(r =>
        r.rating >= session.rating &&
        r.opening_hours?.open_now &&
        (cuisineFilter.length === 0 || cuisineFilter.some(k => (r.name + r.types.join()).toLowerCase().includes(k)))
      ).sort(() => Math.random() - 0.5).slice(0, 3);

      if (filtered.length === 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '找不到符合條件的餐廳 😢 請再換個條件或位置試試看！'
        });
      }

      const bubbles = filtered.map(place => {
        const image = place.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
          : 'https://placehold.co/400x300?text=No+Image';
        return {
          type: 'bubble',
          hero: {
            type: 'image',
            url: image,
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: place.name, weight: 'bold', size: 'lg', wrap: true },
              { type: 'text', text: `📍 ${place.vicinity}`, size: 'sm', color: '#666666', wrap: true },
              { type: 'text', text: `⭐ ${place.rating} 分`, size: 'sm', color: '#999999', wrap: true }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                style: 'primary',
                action: {
                  type: 'uri',
                  label: '吃這家',
                  uri: `https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat},${place.geometry.location.lng}`
                }
              }
            ]
          }
        };
      });

      return client.replyMessage(event.replyToken, {
        type: 'flex',
        altText: '推薦餐廳',
        contents: { type: 'carousel', contents: bubbles }
      });
    }
  }

  return Promise.resolve(null);
}

module.exports = app;
