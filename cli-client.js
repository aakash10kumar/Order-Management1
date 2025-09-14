#!/usr/bin/env node

const io = require('socket.io-client');
const readline = require('readline');

class OrdersCLIClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.orders = new Map();
  }

  async start() {
    console.log('🚀 Starting Real-time Orders CLI Client');
    console.log(`📡 Connecting to ${this.serverUrl}...`);
    
    // Connect to server
    this.socket = io(this.serverUrl);
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      console.log('📋 Listening for real-time order updates...\n');
      this.showHelp();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    this.socket.on('connected', (data) => {
      console.log(`🎉 ${data.message}`);
    });

    this.socket.on('orderUpdate', (data) => {
      this.handleOrderUpdate(data);
    });

    // Setup CLI interface
    this.setupCLI();
  }

  handleOrderUpdate(data) {
    const { operation, id, data: orderData } = data;
    const timestamp = new Date().toLocaleTimeString();
    
    switch (operation) {
      case 'INSERT':
        this.orders.set(id, orderData);
        console.log(`\n🆕 [${timestamp}] NEW ORDER CREATED:`);
        this.displayOrder(orderData);
        break;
        
      case 'UPDATE':
        const oldOrder = this.orders.get(id);
        this.orders.set(id, orderData);
        console.log(`\n✏️  [${timestamp}] ORDER UPDATED:`);
        if (oldOrder && oldOrder.status !== orderData.status) {
          console.log(`   Status changed: ${oldOrder.status} → ${orderData.status}`);
        }
        this.displayOrder(orderData);
        break;
        
      case 'DELETE':
        const deletedOrder = this.orders.get(id);
        this.orders.delete(id);
        console.log(`\n🗑️  [${timestamp}] ORDER DELETED:`);
        if (deletedOrder) {
          this.displayOrder(deletedOrder);
        }
        break;
    }
    
    this.showPrompt();
  }

  displayOrder(order) {
    console.log(`   📦 Order #${order.id}`);
    console.log(`   👤 Customer: ${order.customer_name}`);
    console.log(`   🛍️  Product: ${order.product_name}`);
    console.log(`   📊 Status: ${this.getStatusEmoji(order.status)} ${order.status.toUpperCase()}`);
    console.log(`   ⏰ Updated: ${new Date(order.updated_at).toLocaleString()}`);
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'shipped': return '🚚';
      case 'delivered': return '✅';
      default: return '❓';
    }
  }

  setupCLI() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.rl = rl;
    this.showPrompt();

    rl.on('line', (input) => {
      const command = input.trim().toLowerCase();
      
      switch (command) {
        case 'help':
        case 'h':
          this.showHelp();
          break;
        case 'list':
        case 'ls':
          this.listOrders();
          break;
        case 'count':
          this.showOrderCount();
          break;
        case 'clear':
          console.clear();
          this.showPrompt();
          break;
        case 'quit':
        case 'exit':
        case 'q':
          this.quit();
          break;
        default:
          if (command) {
            console.log('❓ Unknown command. Type "help" for available commands.');
            this.showPrompt();
          }
      }
    });

    rl.on('close', () => {
      this.quit();
    });
  }

  showHelp() {
    console.log('\n📖 Available Commands:');
    console.log('   help, h     - Show this help message');
    console.log('   list, ls    - List all current orders');
    console.log('   count       - Show total order count');
    console.log('   clear       - Clear the screen');
    console.log('   quit, exit, q - Exit the client');
    console.log('\n💡 Real-time updates will appear automatically when database changes occur.');
    this.showPrompt();
  }

  listOrders() {
    if (this.orders.size === 0) {
      console.log('\n📭 No orders currently tracked.');
    } else {
      console.log(`\n📋 Current Orders (${this.orders.size} total):`);
      console.log('─'.repeat(80));
      
      for (const [id, order] of this.orders) {
        this.displayOrder(order);
        console.log('─'.repeat(80));
      }
    }
    this.showPrompt();
  }

  showOrderCount() {
    console.log(`\n📊 Total orders tracked: ${this.orders.size}`);
    this.showPrompt();
  }

  showPrompt() {
    if (this.rl) {
      this.rl.prompt();
    }
  }

  quit() {
    console.log('\n👋 Disconnecting from server...');
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.rl) {
      this.rl.close();
    }
    console.log('✅ CLI Client stopped.');
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const serverUrl = args[0] || 'http://localhost:3000';

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Received SIGINT. Exiting gracefully...');
  process.exit(0);
});

// Start the CLI client
const client = new OrdersCLIClient(serverUrl);
client.start().catch(console.error);
