const { MongoClient } = require('mongodb');
require('dotenv').config();
const mongoose = require('mongoose');
async function setupDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime_orders');

  try {
    await client.connect();
    console.log('Connected to MongoDB database');

    const db = client.db();
    const ordersCollection = db.collection('orders');

    // Create indexes for better performance
    await ordersCollection.createIndex({ customer_name: 1 });
    await ordersCollection.createIndex({ status: 1 });
    await ordersCollection.createIndex({ updated_at: -1 });
    console.log('Database indexes created');

    // Insert sample data (only if collection is empty)
    const existingCount = await ordersCollection.countDocuments();
    if (existingCount === 0) {
      const sampleOrders = [
        {
          customer_name: 'John Doe',
          product_name: 'Laptop',
          status: 'pending',
          updated_at: new Date()
        },
        {
          customer_name: 'Jane Smith',
          product_name: 'Phone',
          status: 'shipped',
          updated_at: new Date()
        },
        {
          customer_name: 'Bob Johnson',
          product_name: 'Tablet',
          status: 'delivered',
          updated_at: new Date()
        }
      ];

      await ordersCollection.insertMany(sampleOrders);
      console.log('Sample data inserted');
    } else {
      console.log(`Collection already contains ${existingCount} documents`);
    }

    console.log('MongoDB setup completed successfully!');
    console.log('Database:', db.databaseName);
    console.log('Collection: orders');
    console.log('Total documents:', await ordersCollection.countDocuments());

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await client.close();
  }
}

setupDatabase();
