require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();
const port = process.env.PORT || 3000;

// Line Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const googleMapsClient = new Client({});

// 處理 Line Webhook
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 處理事件
async function handleEvent(event) {
  if (event.type !== 'message') {
    return Promise.resolve(null);
  }

  // 處理位置訊息
  if (event.message.type === 'location') {
    return handleLocationRequest(event);
  }

  // 處理按鈕點擊事件
  if (event.type === 'postback') {
    return handlePostback(event);
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

// 處理位置請求
async function handleLocationRequest(event) {
  try {
    const { latitude, longitude } = event.message;
    const restaurants = await searchNearbyRestaurants(latitude, longitude);
    
    if (restaurants.length === 0) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '抱歉，在您附近沒有找到合適的餐廳。'
      });
    }

    // 建立餐廳資訊模板
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

// 處理按鈕點擊事件
async function handlePostback(event) {
  const data = JSON.parse(event.postback.data);
  
  if (data.action === 'navigate') {
    // 傳送位置訊息
    return client.replyMessage(event.replyToken, {
      type: 'location',
      title: data.name,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude
    });
  } else if (data.action === 'recommend') {
    // 重新推薦
    return handleLocationRequest(event);
  }
}

// 搜尋附近餐廳
async function searchNearbyRestaurants(latitude, longitude) {
  try {
    const response = await googleMapsClient.placesNearby({
      params: {
        location: `${latitude},${longitude}`,
        radius: 1000, // 搜尋半徑 1 公里
        type: 'restaurant',
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    // 過濾並排序餐廳（評分高的優先）
    const restaurants = response.data.results
      .filter(restaurant => restaurant.rating && restaurant.rating >= 3.5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3); // 只取前三家

    return restaurants;
  } catch (error) {
    console.error('Error searching nearby restaurants:', error);
    throw error;
  }
}

// 建立餐廳資訊模板
function createRestaurantTemplate(restaurants) {
  const columns = restaurants.map(restaurant => ({
    thumbnailImageUrl: restaurant.photos ? 
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${restaurant.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}` : 
      'https://placehold.co/400x300?text=No+Image',
    title: restaurant.name,
    text: `評分：${restaurant.rating || '無評分'}\n地址：${restaurant.vicinity}`,
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
  }));

  return {
    type: 'template',
    altText: '附近美食推薦',
    template: {
      type: 'carousel',
      columns: columns,
      actions: [
        {
          type: 'postback',
          label: '重新推薦',
          data: JSON.stringify({
            action: 'recommend'
          })
        }
      ]
    }
  };
}

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 