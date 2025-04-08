
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

    const userMessage = event.message.text.toLowerCase();
    if (userMessage.includes('推薦') || userMessage.includes('附近') || userMessage.includes('美食')) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請點擊下方選單的「位置」按鈕，或直接傳送您的位置給我，我會為您推薦附近的美食！'
      });
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '請傳送您的位置，或輸入「推薦」來獲取附近美食推薦！'
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
    userLocations.set(event.source.userId, { latitude, longitude });

    const restaurants = await searchNearbyRestaurants(latitude, longitude);
    if (restaurants.length === 0) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '抱歉，在您附近沒有找到合適的餐廳。'
      });
    }

    const restaurantTemplate = createRestaurantTemplate(restaurants);
    return client.replyMessage(event.replyToken, restaurantTemplate);
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
    if (data.action === 'navigate') {
      return client.replyMessage(event.replyToken, {
        type: 'location',
        title: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude
      });
    } else if (data.action === 'recommend') {
      const userLocation = userLocations.get(event.source.userId);
      if (!userLocation) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請先傳送您的位置給我，我會為您推薦附近的美食！'
        });
      }

      const restaurants = await searchNearbyRestaurants(userLocation.latitude, userLocation.longitude);
      if (restaurants.length === 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '抱歉，在您附近沒有找到合適的餐廳。'
        });
      }

      const restaurantTemplate = createRestaurantTemplate(restaurants);
      return client.replyMessage(event.replyToken, restaurantTemplate);
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

    const restaurants = response.data.results
      .filter(restaurant => restaurant.rating && restaurant.rating >= 3.5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    return restaurants;
  } catch (error) {
    console.error('Error searching nearby restaurants:', error);
    throw error;
  }
}

function createRestaurantTemplate(restaurants) {
  const columns = restaurants.map(restaurant => {
    let thumbnailImageUrl = 'https://placehold.co/400x300?text=No+Image';
    if (restaurant.photos && restaurant.photos.length > 0) {
      thumbnailImageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${restaurant.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    }

    return {
      thumbnailImageUrl,
      title: restaurant.name,
      text: `評分：${restaurant.rating || '無評分'}
地址：${restaurant.vicinity}`,
      actions: [
        {
          type: 'postback',
          label: '吃這家',
          data: JSON.stringify({
            action: 'navigate',
            name: restaurant.name,
            address: restaurant.vicinity,
            latitude: restaurant.geometry.location.lat,
            longitude: restaurant.geometry.location.lng
          })
        }
      ]
    };
  });

  return {
    type: 'template',
    altText: '附近美食推薦',
    template: {
      type: 'carousel',
      columns
    }
  };
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
