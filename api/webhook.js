
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

const userLocations = new Map();
const userPreviousPlaces = new Map();
const userPlaceCache = new Map();

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
    await Promise.all(req.body.events.map(async (event) => {
      if (event.type === 'message') {
        if (event.message.type === 'location') {
          const { latitude, longitude } = event.message;
          return await handleSearch(latitude, longitude, event.replyToken, event.source.userId);
        } else if (event.message.type === 'text') {
          // 嘗試將文字當作地點
          try {
            const geo = await mapsClient.geocode({
              params: {
                address: event.message.text,
                key: process.env.GOOGLE_MAPS_API_KEY
              }
            });
            if (!geo.data.results.length) throw new Error('無法解析地點');
            const { lat, lng } = geo.data.results[0].geometry.location;
            return await handleSearch(lat, lng, event.replyToken, event.source.userId);
          } catch {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: '請傳送您目前的位置，或輸入有效地點名稱（如「台北車站」）以推薦附近美食 🍱'
            });
          }
        }
      } else if (event.type === 'postback') {
        const userId = event.source.userId;
        const data = JSON.parse(event.postback.data);
        if (data.action === 'navigate') {
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `開啟導航到 ${data.name}：
${mapsUrl}`
          });
        } else if (data.action === 'recommend') {
          const cache = userPlaceCache.get(userId) || [];
          const used = userPreviousPlaces.get(userId) || [];
          const remaining = cache.filter(p => !used.includes(p.place_id));
          if (remaining.length === 0) {
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: '附近的餐廳都推薦過囉！請再傳送一次位置或換個地點 🍜'
            });
          }
          const selected = remaining.slice(0, 3);
          userPreviousPlaces.set(userId, used.concat(selected.map(p => p.place_id)));
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

async function handleSearch(lat, lng, replyToken, userId) {
  const res = await mapsClient.placesNearby({
    params: {
      location: { lat, lng },
      radius: 2000,
      type: 'restaurant',
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });

  const places = res.data.results.filter(p =>
    p.rating >= 3.5 && p.opening_hours?.open_now
  );

  const shuffled = places.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  userPlaceCache.set(userId, shuffled);
  userPreviousPlaces.set(userId, selected.map(p => p.place_id));

  return client.replyMessage(replyToken, createFlex(selected));
}

function createFlex(restaurants) {
  const bubbles = restaurants.map(r => {
    const imageUrl = r.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : 'https://placehold.co/600x400?text=No+Image';

    return {
      type: 'bubble',
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: r.name, weight: 'bold', size: 'lg', wrap: true },
          { type: 'text', text: `⭐ 評分：${r.rating || '無'}
📍${r.vicinity}`, size: 'sm', color: '#666666', margin: 'md', wrap: true }
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
                name: r.name,
                latitude: r.geometry.location.lat,
                longitude: r.geometry.location.lng
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
