
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const googleMapsClient = new Client({});
const userLocations = new Map();
const userPreviousPlaces = new Map();
const userPlaceCache = new Map();

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type === 'postback') {
    return handlePostback(event);
  }

  if (event.type === 'message') {
    if (event.message.type === 'location') {
      return handleLocationRequest(event);
    }

    // 所有非位置訊息一律提示
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '請傳送您的位置資訊，點選輸入框左側的「＋」並選擇「位置資訊」以獲取附近美食推薦 🍱'
    });
  }

  return Promise.resolve(null);
}

async function handleLocationRequest(event) {
  try {
    const { message } = event;
    if (message.type !== 'location' || typeof message.latitude !== 'number' || typeof message.longitude !== 'number') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請傳送有效的位置資訊，以便我們推薦附近的餐廳。'
      });
    }

    const { latitude, longitude } = message;
    const userId = event.source.userId;

    userLocations.set(userId, { latitude, longitude });

    const restaurants = await searchNearbyRestaurants(latitude, longitude);
    const placeIds = restaurants.map(r => r.place_id);

    // 打亂後存進 cache（避免每次都一樣）
    const shuffled = restaurants.sort(() => Math.random() - 0.5);
    userPlaceCache.set(userId, shuffled);
    userPreviousPlaces.set(userId, []);

    const toRecommend = shuffled.slice(0, 3);
    const used = toRecommend.map(r => r.place_id);
    userPreviousPlaces.set(userId, used);

    const flexMessage = createFlexMessage(toRecommend);
    return client.replyMessage(event.replyToken, flexMessage);
  } catch (error) {
    console.error('Error handling location request:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，發生了一些錯誤，請稍後再試。'
    });
  }
}

async function handlePostback(event) {
  try {
    const data = JSON.parse(event.postback.data);
    const userId = event.source.userId;

    if (data.action === 'navigate') {
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `開啟導航到：${data.name}
${mapsUrl}`
      });
    } else if (data.action === 'recommend') {
      const userLocation = userLocations.get(userId);
      const allPlaces = userPlaceCache.get(userId) || [];
      const usedPlaces = userPreviousPlaces.get(userId) || [];

      if (!userLocation || allPlaces.length === 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請先傳送您的位置給我，我會為您推薦附近的美食！'
        });
      }

      // 找出未用過的
      const remaining = allPlaces.filter(r => !usedPlaces.includes(r.place_id));
      if (remaining.length === 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '附近的推薦已經全部送過囉，請稍後再試或換個地點 🍴'
        });
      }

      const toRecommend = remaining.slice(0, 3);
      const updatedUsed = usedPlaces.concat(toRecommend.map(r => r.place_id));
      userPreviousPlaces.set(userId, updatedUsed);

      const flexMessage = createFlexMessage(toRecommend);
      return client.replyMessage(event.replyToken, flexMessage);
    }
  } catch (error) {
    console.error('Error handling postback:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，發生了一些錯誤，請稍後再試。'
    });
  }
}

async function searchNearbyRestaurants(latitude, longitude) {
  try {
    const response = await googleMapsClient.placesNearby({
      params: {
        location: `${latitude},${longitude}`,
        radius: 1000,
        type: 'restaurant',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    return response.data.results
      .filter(r => r.rating && r.rating >= 3.5);
  } catch (error) {
    console.error('Error searching nearby restaurants:', error);
    throw error;
  }
}

function createFlexMessage(restaurants) {
  const bubbles = restaurants.map(r => {
    let imageUrl = 'https://placehold.co/600x400?text=No+Image';
    if (r.photos && r.photos.length > 0) {
      imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    }

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
          {
            type: 'text',
            text: r.name,
            weight: 'bold',
            size: 'lg',
            wrap: true
          },
          {
            type: 'text',
            text: `⭐ 評分：${r.rating || '無'}
📍${r.vicinity}`,
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true
          }
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
        ],
        flex: 0
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
