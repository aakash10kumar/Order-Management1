#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

class APITester {
  constructor() {
    this.createdOrderId = null;
  }

  async testAPI() {
    console.log('🧪 Testing Real-time Orders API');
    console.log('='.repeat(50));

    try {
      // Test 1: Get all orders
      console.log('\n1️⃣ Testing GET /api/orders');
      const getResponse = await axios.get(`${API_BASE}/orders`);
      console.log(`✅ Retrieved ${getResponse.data.length} orders`);
      
      // Test 2: Create a new order
      console.log('\n2️⃣ Testing POST /api/orders');
      const newOrder = {
        customer_name: 'API Test User',
        product_name: 'Test Product',
        status: 'pending'
      };
      
      const createResponse = await axios.post(`${API_BASE}/orders`, newOrder);
      this.createdOrderId = createResponse.data.id;
      console.log(`✅ Created order #${this.createdOrderId}`);
      console.log(`   Customer: ${createResponse.data.customer_name}`);
      console.log(`   Product: ${createResponse.data.product_name}`);
      console.log(`   Status: ${createResponse.data.status}`);

      // Test 3: Update the order
      console.log('\n3️⃣ Testing PUT /api/orders/:id');
      const updateResponse = await axios.put(`${API_BASE}/orders/${this.createdOrderId}`, {
        status: 'shipped'
      });
      console.log(`✅ Updated order #${this.createdOrderId}`);
      console.log(`   New status: ${updateResponse.data.status}`);

      // Test 4: Update again
      console.log('\n4️⃣ Testing another PUT /api/orders/:id');
      const updateResponse2 = await axios.put(`${API_BASE}/orders/${this.createdOrderId}`, {
        status: 'delivered',
        customer_name: 'Updated Customer Name'
      });
      console.log(`✅ Updated order #${this.createdOrderId} again`);
      console.log(`   Status: ${updateResponse2.data.status}`);
      console.log(`   Customer: ${updateResponse2.data.customer_name}`);

      // Test 5: Get updated order
      console.log('\n5️⃣ Testing GET /api/orders (verify updates)');
      const getResponse2 = await axios.get(`${API_BASE}/orders`);
      const updatedOrder = getResponse2.data.find(order => order.id === this.createdOrderId);
      console.log(`✅ Verified order updates in database`);
      console.log(`   Final status: ${updatedOrder.status}`);
      console.log(`   Final customer: ${updatedOrder.customer_name}`);

      // Test 6: Delete the order
      console.log('\n6️⃣ Testing DELETE /api/orders/:id');
      const deleteResponse = await axios.delete(`${API_BASE}/orders/${this.createdOrderId}`);
      console.log(`✅ Deleted order #${this.createdOrderId}`);
      console.log(`   Deleted order: ${deleteResponse.data.order.customer_name} - ${deleteResponse.data.order.product_name}`);

      console.log('\n🎉 All API tests passed successfully!');
      console.log('\n💡 Open the web client at http://localhost:3000 to see real-time updates');
      console.log('💡 Or run: npm run cli to start the CLI client');

    } catch (error) {
      console.error('\n❌ API test failed:', error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      process.exit(1);
    }
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/orders`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking if server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Server is not running!');
    console.error('   Please start the server first: npm start');
    process.exit(1);
  }

  console.log('✅ Server is running');
  
  const tester = new APITester();
  await tester.testAPI();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Test interrupted. Exiting...');
  process.exit(0);
});

main().catch(console.error);
