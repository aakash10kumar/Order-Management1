const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST","DELETE","PUT"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
let Order; // Store the Order model globally
let changeStream;

// Store connected clients
const connectedClients = new Set();

// Connect to database and setup change detection
// Replace mongoClient.connect() logic
async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime_orders', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB via Mongoose');

    // Define Order schema
    const orderSchema = new mongoose.Schema({
      customer_name: String,
      product_name: String,
      status: String,
      updated_at: { type: Date, default: Date.now }
    }, { collection: 'orders' });

    Order = mongoose.model('Order', orderSchema);

    // Setup change stream with better error handling
    try {
      changeStream = Order.watch([
        {
          $match: {
            $or: [
              { operationType: 'insert' },
              { operationType: 'update' },
              { operationType: 'delete' }
            ]
          }
        }
      ], { fullDocument: 'updateLookup' });

      changeStream.on('change', (change) => {
        console.log('Mongoose Change:', change);

        const data = {
          operation: change.operationType.toUpperCase(),
          id: change.documentKey._id.toString(),
          data: change.fullDocument
        };

        io.emit('orderUpdate', data);
      });

      changeStream.on('error', (err) => {
        console.warn('⚠️ Change stream error:', err.message);
        console.warn('⚠️ Falling back to polling...');
        if (changeStream && typeof changeStream.close === 'function') {
          const maybePromise = changeStream.close();
          if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(console.error);
    }
        }
        startPolling();
      });

      console.log('✅ Mongoose Change Streams initialized');
    } catch (err) {
      console.warn('⚠️ Change stream setup failed:', err.message);
      console.warn('⚠️ Falling back to polling...');
      startPolling();
    }

    return Order;

  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}


// Fallback polling method for standalone MongoDB
let lastCheckTime = new Date();
let pollingInterval;

function startPolling() {
  console.log('Starting polling-based change detection...');
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  pollingInterval = setInterval(async () => {
    try {
      if (!Order) {
        console.warn('Order model not available for polling');
        return;
      }

      // Check for new or updated documents
      const recentChanges = await Order.find({
        updated_at: { $gt: lastCheckTime }
      }).sort({ updated_at: 1 });
      
      if (recentChanges.length > 0) {
        console.log(`Found ${recentChanges.length} recent changes`);
        
        for (const doc of recentChanges) {
          // Determine operation type based on when document was created vs updated
          const docObj = doc.toObject();
          const isNew = docObj.updated_at.getTime() - docObj._id.getTimestamp().getTime() < 1000;
          
          const data = {
            operation: isNew ? 'INSERT' : 'UPDATE',
            id: docObj._id.toString(),
            data: docObj
          };
          
          io.emit('orderUpdate', data);
        }
        
        lastCheckTime = new Date();
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000); // Poll every 2 seconds to reduce load
}

// API Routes
app.get('/api/orders', async (req, res) => {
  try {
    if (!Order) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    const orders = await Order.find({}).sort({ updated_at: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    if (!Order) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { customer_name, product_name, status = 'pending' } = req.body;
    
    if (!customer_name || !product_name) {
      return res.status(400).json({ error: 'Customer name and product name are required' });
    }
    
    const order = new Order({
      customer_name,
      product_name,
      status,
      updated_at: new Date()
    });
    
    const createdOrder = await order.save();
    
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    if (!Order) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    const { customer_name, product_name, status } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    const updateFields = { updated_at: new Date() };
    
    if (customer_name !== undefined) {
      updateFields.customer_name = customer_name;
    }
    if (product_name !== undefined) {
      updateFields.product_name = product_name;
    }
    if (status !== undefined) {
      updateFields.status = status;
    }
    
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    if (!Order) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }
    
    const deletedOrder = await Order.findByIdAndDelete(id);
    
    if (!deletedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ message: 'Order deleted successfully', order: deletedOrder });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  connectedClients.add(socket.id);
  
  // Send current orders to newly connected client
  socket.emit('connected', { message: 'Connected to real-time orders system' });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedClients.delete(socket.id);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (changeStream) {
    await changeStream.close();
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  await mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;

// Start server
async function startServer() {
  try {
    await connectDatabase();

    server.listen(PORT)
      .on('listening', () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
        console.log('✅ Real-time orders system is ready!');
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use. Try another port or kill the existing process.`);
          process.exit(1);
        } else {
          throw err;
        }
      });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}


startServer().catch(console.error);
