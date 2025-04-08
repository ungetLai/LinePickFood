
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
const userLocations = new Map();
const userPrevPlaces = new Map();
const userPlaceCache = new Map();

// 修正：rawBody + 手動 JSON parse
app.use((req, res, next) => {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: req.charset || 'utf-8'
  })
    .then((buf) => {
      req.rawBody = buf;
      req.body = JSON.parse(buf);
      next();
    })
    .catch((err) => {
      console.error('Raw body error:', err);
      res.status(400).send('Invalid body');
    });
});

app.use(middleware(config));

app.post('/api/webhook', async (req, res) => {
  try {
    await Promise.all(req.body.events.map(async (event) => {
      const userId = event.source.userId;
      if (event.type === 'message') {
        if (event.message.type === 'location') {
          const { latitude, longitude } = event.message;
          userLocations.set(userId, { latitude, longitude });
          const places = await getNearbyPlaces(latitude, longitude);
          const shuffled = places.sort(() => Math.random() - 0.5);
          userPlaceCache.set(userId, shuffled);
          const selected = shuffled.slice(0, 3);
          userPrevPlaces.set(userId, selected.map(p => p.place_id));
          return client.replyMessage(event.replyToken, createFlex(selected));
        } else {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '請傳送您的位置資訊，點選輸入框左側的「＋」並選擇「位置資訊」以獲取附近美食推薦 🍱'
          });
        }
      } else if (event.type === 'postback') {
        const data = JSON.parse(event.postback.data);
        if (data.action === 'navigate') {
          const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `開啟導航到：${data.name}
${mapUrl}`
          });
        }
        if (data.action === 'recommend') {
          const cache = userPlaceCache.get(userId) || [];
          const used = userPrevPlaces.get(userId) || [];
          const remaining = cache.filter(p => !used.includes(p.place_id));
          if (remaining.length === 0) {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: '附近的餐廳已推薦完囉，可以傳送新位置再探索更多 🍽️'
            });
          }
          const selected = remaining.slice(0, 3);
          userPrevPlaces.set(userId, used.concat(selected.map(p => p.place_id)));
          return client.replyMessage(event.replyToken, createFlex(selected));
        }
      }
    }));
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

async function getNearbyPlaces(lat, lng) {
  const res = await mapsClient.placesNearby({
    params: {
      location: { lat, lng },
      radius: 2000,
      type: 'restaurant',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  return res.data.results.filter(p => p.rating >= 3);
}

function createFlex(places) {
  const bubbles = places.map(place => {
    const image = place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : 'https://placehold.co/400x300?text=No+Image';
    const category = place.types?.[0] || '餐廳';
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
          { type: 'text', text: `⭐ 評分：${place.rating}｜類型：${category}`, size: 'sm', margin: 'md', color: '#999999', wrap: true }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'postback',
              label: '吃這家',
              data: JSON.stringify({
                action: 'navigate',
                name: place.name,
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng
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
    altText: '附近美食推薦',
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

module.exports = app;
