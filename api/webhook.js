
const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const { Client: MapsClient } = require('@googlemaps/google-maps-services-js');
const getRawBody = require('raw-body');
require('dotenv').config();

const app = express();
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new Client(config);
const mapsClient = new MapsClient({});
const userSessions = new Map();
const userPrevPlaces = new Map();
const userCache = new Map();
const conditionSessions = new Map();

app.use((req, res, next) => {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: 'utf-8'
  }).then((buf) => {
    req.rawBody = buf;
    req.body = JSON.parse(buf);
    next();
  }).catch((err) => {
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
  const message = event.message;

  if (event.type === 'message') {
    const text = message.text?.trim();
    const session = conditionSessions.get(userId);
  
    if (message.type === 'location') {
      const { latitude, longitude } = message;
      return await handleSearch(latitude, longitude, event.replyToken, userId);
    }
  
    // 非文字類型（圖片、貼圖、語音等）
    if (message.type !== 'text') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請點選輸入框左側的「＋」並選擇「位置資訊 📍」\n或輸入一個明顯的地點名稱（例如「台北車站」）以獲得附近美食推薦 🍱'
      });
    }
  
    // 啟動條件推薦
    if (text === '開始條件推薦') {
      conditionSessions.set(userId, { step: 'cuisine' });
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🍜 想吃什麼料理？（中式、日式、西式、韓式、台式、不限）'
      });
    }
  
    if (session) {
      if (session.step === 'cuisine') {
        session.cuisine = ['中式', '日式', '西式', '韓式', '台式'].includes(text) ? text : '不限';
        session.step = 'rating';
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '⭐ 想找幾星以上的餐廳？（輸入 1～5，預設 3）'
        });
      }
      if (session.step === 'rating') {
        const rating = parseFloat(text);
        session.rating = (rating >= 1 && rating <= 5) ? rating : 3;
        session.step = 'radius';
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '📏 想搜尋多遠範圍？請輸入公尺數（300～5000，預設 2000）'
        });
      }
      if (session.step === 'radius') {
        const r = parseInt(text);
        session.radius = (r >= 300 && r <= 5000) ? r : 2000;
        session.step = 'location';
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '📍 請輸入附近明顯地點（如 台北車站）'
        });
      }
      if (session.step === 'location') {
        const geo = await mapsClient.geocode({
          params: { address: text, key: process.env.GOOGLE_MAPS_API_KEY }
        });
        if (!geo.data.results.length) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ 找不到此地點，請再試一次'
          });
        }
  
        const { lat, lng } = geo.data.results[0].geometry.location;
        const cuisineMap = {
          中式: ['chinese'],
          日式: ['japanese'],
          西式: ['western', 'american'],
          韓式: ['korean'],
          台式: ['taiwanese']
        };
        const keywords = cuisineMap[session.cuisine] || [];
  
        const res = await mapsClient.placesNearby({
          params: {
            location: { lat, lng },
            radius: session.radius,
            type: 'restaurant',
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        });
  
        const results = res.data.results.filter(p =>
          p.rating >= session.rating &&
          p.opening_hours?.open_now &&
          (keywords.length === 0 || keywords.some(k => (p.name + p.types.join()).toLowerCase().includes(k)))
        ).sort(() => Math.random() - 0.5).slice(0, 3);
  
        conditionSessions.delete(userId);
  
        if (!results.length) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🥲 找不到符合條件的餐廳，請重新設定條件或換個地點試試'
          });
        }
  
        return client.replyMessage(event.replyToken, createFlex(results));
      }
    }
  
    // 非條件流程，嘗試當地點查詢
    try {
      const geo = await mapsClient.geocode({
        params: {
          address: text,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
      if (!geo.data.results.length) throw new Error();
      const { lat, lng } = geo.data.results[0].geometry.location;
      return await handleSearch(lat, lng, event.replyToken, userId);
    } catch {
      return client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: '請傳送您目前的位置，或輸入有效地點名稱（如「台北車站」）以推薦附近美食 🍱'
        },
        {
          type: 'flex',
          altText: '條件推薦',
          contents: {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '想要更精準推薦？',
                  weight: 'bold',
                  size: 'md',
                  wrap: true
                },
                {
                  type: 'button',
                  style: 'primary',
                  margin: 'lg',
                  action: {
                    type: 'message',
                    label: '🔍 設定條件推薦',
                    text: '開始條件推薦'
                  }
                }
              ]
            }
          }
        }
      ]);
    }
  }

  if (event.type === 'postback') {
    const data = JSON.parse(event.postback.data);
    const userId = event.source.userId;
    if (data.action === 'navigate') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🚶‍♂️ 前往 ${data.name}：https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`
      });
    }
    if (data.action === 'recommend') {
      const all = userCache.get(userId) || [];
      const used = userPrevPlaces.get(userId) || [];
      const remaining = all.filter(p => !used.includes(p.place_id));
      if (!remaining.length) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '附近的餐廳都推薦過囉～請傳送新位置再探索 🍜'
        });
      }
      const selected = remaining.slice(0, 3);
      userPrevPlaces.set(userId, used.concat(selected.map(p => p.place_id)));
      return client.replyMessage(event.replyToken, createFlex(selected));
    }
  }
}

async function handleSearch(lat, lng, replyToken, userId) {
  const res = await mapsClient.placesNearby({
    params: {
      location: { lat, lng },
      radius: 2000,
      type: 'restaurant',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  const results = res.data.results.filter(p =>
    p.rating >= 3.5 && p.opening_hours?.open_now
  );
  const shuffled = results.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  userCache.set(userId, shuffled);
  userPrevPlaces.set(userId, selected.map(p => p.place_id));
  return client.replyMessage(replyToken, createFlex(selected));
}

function createFlex(places) {
  const bubbles = places.map(p => {
    const img = p.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : 'https://placehold.co/400x300?text=No+Image';
    return {
      type: 'bubble',
      hero: {
        type: 'image',
        url: img,
        size: 'full',
        aspectMode: 'cover',
        aspectRatio: '20:13'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: p.name, weight: 'bold', size: 'lg', wrap: true },
          { type: 'text', text: `⭐ ${p.rating} ｜📍 ${p.vicinity}`, size: 'sm', wrap: true, color: '#555555', margin: 'md' }
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
              type: 'postback',
              label: '吃這家',
              data: JSON.stringify({
                action: 'navigate',
                name: p.name,
                latitude: p.geometry.location.lat,
                longitude: p.geometry.location.lng
              })
            }
          }
        ]
      }
    };
  });

  bubbles.push({
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'postback',
            label: '🔁 重新推薦',
            data: JSON.stringify({ action: 'recommend' })
          }
        }
      ]
    }
  });

  return {
    type: 'flex',
    altText: '推薦結果',
    contents: { type: 'carousel', contents: bubbles }
  };
}

module.exports = app;
