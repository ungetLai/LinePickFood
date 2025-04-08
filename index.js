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
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.toLowerCase();
  
  if (userMessage.includes('推薦') || userMessage.includes('附近') || userMessage.includes('美食')) {
    return handleLocationRequest(event);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '請傳送您的位置，或輸入「推薦」來獲取附近美食推薦！'
  });
}

// 處理位置請求
async function handleLocationRequest(event) {
  try {
    // 檢查是否收到位置訊息
    if (event.message.type === 'location') {
      const { latitude, longitude } = event.message;
      const restaurants = await searchNearbyRestaurants(latitude, longitude);
      const randomRestaurant = getRandomRestaurant(restaurants);
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `推薦您去：${randomRestaurant.name}\n地址：${randomRestaurant.vicinity}\n評分：${randomRestaurant.rating || '無評分'}`
      });
    } else {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請點擊下方選單的「位置」按鈕，或直接傳送您的位置給我，我會為您推薦附近的美食！'
      });
    }
  } catch (error) {
    console.error('Error handling location request:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，發生了一些錯誤，請稍後再試。'
    });
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

    return response.data.results;
  } catch (error) {
    console.error('Error searching nearby restaurants:', error);
    throw error;
  }
}

// 隨機選擇餐廳
function getRandomRestaurant(restaurants) {
  const validRestaurants = restaurants.filter(restaurant => 
    restaurant.rating && restaurant.rating >= 3.5
  );
  
  if (validRestaurants.length === 0) {
    return restaurants[Math.floor(Math.random() * restaurants.length)];
  }
  
  return validRestaurants[Math.floor(Math.random() * validRestaurants.length)];
}

// 啟動伺服器
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 