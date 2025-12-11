// QIE DEX Optimizer Pro - Enhanced Database & Blockchain Storage
// Updated for: Order Book, Limit Orders, Advanced Analytics, Favorites
// Supports: MongoDB, PostgreSQL, Redis, IPFS, QIE Blockchain

const mongoose = require('mongoose');

// ==================== ENHANCED DATABASE SCHEMAS ====================

// Trade Schema (Enhanced)
const TradeSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true, index: true },
  walletAddress: { type: String, required: true, index: true },
  fromToken: { type: String, required: true, index: true },
  toToken: { type: String, required: true, index: true },
  amountIn: { type: Number, required: true },
  amountOut: { type: Number, required: true },
  route: { type: String, required: true },
  pools: [{ type: String }],
  poolAddresses: [{ type: String }],
  gasFee: { type: Number, required: true },
  slippage: { type: Number, required: true },
  priceImpact: { type: Number, required: true },
  effectivePrice: { type: Number, required: true },
  orderType: { 
    type: String, 
    enum: ['market', 'limit', 'stop'], 
    default: 'market',
    index: true
  },
  blockNumber: { type: Number, required: true },
  gasUsed: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending',
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Order Schema (NEW - for limit/stop orders)
const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true }, // wallet address
  pair: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ['market', 'limit', 'stop', 'stop_limit'], 
    required: true,
    index: true
  },
  side: { 
    type: String, 
    enum: ['buy', 'sell'], 
    required: true,
    index: true
  },
  price: { type: Number }, // limit price
  stopPrice: { type: Number }, // stop trigger price
  amount: { type: Number, required: true },
  filled: { type: Number, default: 0 },
  remaining: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['open', 'partial', 'filled', 'cancelled', 'expired'], 
    default: 'open',
    index: true
  },
  slippageTolerance: { type: Number, default: 0.5 },
  txHash: { type: String, index: true },
  gasFee: { type: Number, default: 0 },
  fills: [{
    fillId: String,
    price: Number,
    amount: Number,
    timestamp: Date,
    txHash: String
  }],
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Route Analysis Schema (Enhanced)
const RouteSchema = new mongoose.Schema({
  routeHash: { type: String, required: true, unique: true, index: true },
  fromToken: { type: String, required: true, index: true },
  toToken: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  orderType: { type: String, enum: ['market', 'limit', 'stop'], default: 'market' },
  paths: [{
    pathId: String,
    route: String,
    pools: [String],
    poolAddresses: [String],
    outputAmount: Number,
    gasFee: Number,
    slippage: Number,
    priceImpact: Number,
    executionTime: Number,
    hops: Number,
    gasLimit: Number,
    recommended: Boolean
  }],
  bestPath: { type: String },
  totalRoutesFound: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Audit Proof Schema (Enhanced)
const AuditSchema = new mongoose.Schema({
  auditHash: { type: String, required: true, unique: true, index: true },
  tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade' },
  txHash: { type: String, required: true, index: true },
  routeHash: { type: String, required: true },
  auditScore: { type: Number, required: true, min: 0, max: 100 },
  issues: [{ type: String }],
  warnings: [{ type: String }],
  recommendation: { 
    type: String, 
    enum: ['highly_recommended', 'recommended', 'use_caution', 'not_recommended'] 
  },
  verified: { type: Boolean, default: false },
  verifiedBy: { type: String },
  gasSaved: { type: Number, default: 0 },
  ipfsHash: { type: String }, // Store full audit data on IPFS
  blockchainProof: { type: String }, // On-chain verification hash
  timestamp: { type: Date, default: Date.now, index: true }
});

// Order Book Schema (NEW)
const OrderBookSchema = new mongoose.Schema({
  pair: { type: String, required: true, unique: true, index: true },
  bids: [{
    price: Number,
    amount: Number,
    total: Number,
    orders: Number
  }],
  asks: [{
    price: Number,
    amount: Number,
    total: Number,
    orders: Number
  }],
  midPrice: { type: Number, required: true },
  spread: { type: Number, required: true },
  spreadPercent: { type: Number },
  depth: {
    bid: Number,
    ask: Number
  },
  lastUpdate: { type: Date, default: Date.now, index: true }
});

// Recent Trades Schema (NEW)
const RecentTradeSchema = new mongoose.Schema({
  tradeId: { type: String, required: true, unique: true, index: true },
  pair: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  amount: { type: Number, required: true },
  total: { type: Number, required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});

// User/Wallet Schema (Enhanced)
const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, index: true },
  network: { type: String, default: 'QIE' },
  totalTrades: { type: Number, default: 0 },
  totalVolume: { type: Number, default: 0 },
  totalFeesSaved: { type: Number, default: 0 },
  totalGasSaved: { type: Number, default: 0 },
  avgAuditScore: { type: Number, default: 0 },
  preferredPools: [{ type: String }],
  favoritePairs: [{ type: String }], // NEW
  settings: {
    maxSlippage: { type: Number, default: 1.0 },
    minAuditScore: { type: Number, default: 75 },
    autoRoute: { type: Boolean, default: true },
    defaultOrderType: { type: String, default: 'market' },
    notifications: {
      orderFilled: { type: Boolean, default: true },
      priceAlerts: { type: Boolean, default: false }
    }
  },
  stats: {
    openOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    avgExecutionTime: { type: Number, default: 0 }
  },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Price History Schema (Enhanced)
const PriceHistorySchema = new mongoose.Schema({
  token: { type: String, required: true, index: true },
  pair: { type: String, index: true },
  price: { type: Number, required: true },
  open: { type: Number },
  high: { type: Number },
  low: { type: Number },
  close: { type: Number },
  volume: { type: Number, default: 0 },
  volume24h: { type: Number, default: 0 },
  marketCap: { type: Number, default: 0 },
  change24h: { type: Number, default: 0 },
  interval: { type: String, enum: ['1m', '5m', '15m', '1h', '4h', '1D'], default: '1h' },
  source: { type: String, default: 'QIE_ORACLE' },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Liquidity Pool Schema (NEW)
const PoolSchema = new mongoose.Schema({
  poolId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  address: { type: String, required: true, unique: true },
  pairs: [{ type: String }],
  liquidity: { type: Number, required: true },
  volume24h: { type: Number, default: 0 },
  trades24h: { type: Number, default: 0 },
  fee: { type: Number, required: true },
  avgSlippage: { type: Number, default: 0 },
  apy: { type: Number, default: 0 },
  tvl: { type: Number, default: 0 },
  lastUpdate: { type: Date, default: Date.now }
});

// ==================== DATABASE CLASS ====================

class Database {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
    this.models = {};
  }

  // Connect to MongoDB
  async connectMongo(uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/qie_dex_pro') {
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      console.log('✅ MongoDB Connected');
      
      // Initialize models
      this.models = {
        Trade: mongoose.model('Trade', TradeSchema),
        Order: mongoose.model('Order', OrderSchema),
        Route: mongoose.model('Route', RouteSchema),
        Audit: mongoose.model('Audit', AuditSchema),
        OrderBook: mongoose.model('OrderBook', OrderBookSchema),
        RecentTrade: mongoose.model('RecentTrade', RecentTradeSchema),
        User: mongoose.model('User', UserSchema),
        PriceHistory: mongoose.model('PriceHistory', PriceHistorySchema),
        Pool: mongoose.model('Pool', PoolSchema)
      };
      
      // Create indexes for performance
      await this.createIndexes();
      
      return true;
    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error);
      return false;
    }
  }

  // Create database indexes
  async createIndexes() {
    try {
      await this.models.Trade.createIndexes();
      await this.models.Order.createIndexes();
      await this.models.OrderBook.createIndexes();
      await this.models.RecentTrade.createIndexes();
      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  // Connect to Redis (for caching)
  async connectRedis(config = { host: 'localhost', port: 6379 }) {
    const redis = require('redis');
    
    try {
      this.redisClient = redis.createClient(config);
      await this.redisClient.connect();
      console.log('✅ Redis Connected');
      return true;
    } catch (error) {
      console.error('❌ Redis Connection Error:', error);
      return false;
    }
  }

  // Save Trade
  async saveTrade(tradeData) {
    try {
      const trade = new this.models.Trade(tradeData);
      await trade.save();
      
      // Update user stats
      await this.updateUserStats(tradeData.walletAddress, tradeData);
      
      // Add to recent trades
      await this.addRecentTrade({
        tradeId: trade.txHash,
        pair: `${tradeData.fromToken}/${tradeData.toToken}`,
        price: tradeData.effectivePrice,
        amount: tradeData.amountIn,
        total: tradeData.amountOut,
        side: 'buy',
        timestamp: trade.timestamp
      });
      
      // Cache recent trade
      if (this.redisClient) {
        await this.redisClient.setEx(
          `trade:${tradeData.txHash}`,
          3600,
          JSON.stringify(tradeData)
        );
      }
      
      return trade;
    } catch (error) {
      console.error('Error saving trade:', error);
      throw error;
    }
  }

  // Create Order
  async createOrder(orderData) {
    try {
      const order = new this.models.Order(orderData);
      await order.save();
      
      // Update user stats
      const user = await this.models.User.findOne({ walletAddress: orderData.userId });
      if (user) {
        user.stats.openOrders += 1;
        await user.save();
      }
      
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // Get Open Orders
  async getOpenOrders(walletAddress, pair = null) {
    try {
      const query = { userId: walletAddress, status: 'open' };
      if (pair) query.pair = pair;
      
      const orders = await this.models.Order.find(query).sort({ createdAt: -1 });
      return orders;
    } catch (error) {
      console.error('Error getting open orders:', error);
      return [];
    }
  }

  // Cancel Order
  async cancelOrder(orderId, walletAddress) {
    try {
      const order = await this.models.Order.findOne({ 
        orderId: orderId, 
        userId: walletAddress,
        status: 'open'
      });
      
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      order.status = 'cancelled';
      order.updatedAt = new Date();
      await order.save();
      
      // Update user stats
      const user = await this.models.User.findOne({ walletAddress });
      if (user) {
        user.stats.openOrders = Math.max(0, user.stats.openOrders - 1);
        user.stats.cancelledOrders += 1;
        await user.save();
      }
      
      return { success: true, order };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }

  // Save/Update Order Book
  async saveOrderBook(pair, orderBookData) {
    try {
      const book = await this.models.OrderBook.findOneAndUpdate(
        { pair: pair },
        {
          ...orderBookData,
          lastUpdate: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Cache in Redis for fast access
      if (this.redisClient) {
        await this.redisClient.setEx(
          `orderbook:${pair}`,
          5, // 5 seconds cache
          JSON.stringify(orderBookData)
        );
      }
      
      return book;
    } catch (error) {
      console.error('Error saving order book:', error);
      throw error;
    }
  }

  // Get Order Book
  async getOrderBook(pair) {
    try {
      // Try cache first
      if (this.redisClient) {
        const cached = await this.redisClient.get(`orderbook:${pair}`);
        if (cached) return JSON.parse(cached);
      }
      
      const book = await this.models.OrderBook.findOne({ pair });
      return book;
    } catch (error) {
      console.error('Error getting order book:', error);
      return null;
    }
  }

  // Add Recent Trade
  async addRecentTrade(tradeData) {
    try {
      const trade = new this.models.RecentTrade(tradeData);
      await trade.save();
      
      // Keep only last 1000 trades per pair
      const count = await this.models.RecentTrade.countDocuments({ pair: tradeData.pair });
      if (count > 1000) {
        const oldTrades = await this.models.RecentTrade
          .find({ pair: tradeData.pair })
          .sort({ timestamp: 1 })
          .limit(count - 1000);
        
        const idsToDelete = oldTrades.map(t => t._id);
        await this.models.RecentTrade.deleteMany({ _id: { $in: idsToDelete } });
      }
      
      return trade;
    } catch (error) {
      console.error('Error adding recent trade:', error);
      throw error;
    }
  }

  // Get Recent Trades
  async getRecentTrades(pair, limit = 50) {
    try {
      const trades = await this.models.RecentTrade
        .find({ pair })
        .sort({ timestamp: -1 })
        .limit(limit);
      
      return trades;
    } catch (error) {
      console.error('Error getting recent trades:', error);
      return [];
    }
  }

  // Save Route Analysis
  async saveRoute(routeData) {
    try {
      const route = new this.models.Route(routeData);
      await route.save();
      return route;
    } catch (error) {
      console.error('Error saving route:', error);
      throw error;
    }
  }

  // Save Audit Proof
  async saveAudit(auditData) {
    try {
      const audit = new this.models.Audit(auditData);
      await audit.save();
      
      // Cache audit proof
      if (this.redisClient) {
        await this.redisClient.setEx(
          `audit:${auditData.txHash}`,
          86400, // 24 hours
          JSON.stringify(auditData)
        );
      }
      
      return audit;
    } catch (error) {
      console.error('Error saving audit:', error);
      throw error;
    }
  }

  // Get User Trade History
  async getUserTrades(walletAddress, limit = 50) {
    try {
      // Try cache first
      if (this.redisClient) {
        const cached = await this.redisClient.get(`user_trades:${walletAddress}`);
        if (cached) return JSON.parse(cached);
      }
      
      const trades = await this.models.Trade
        .find({ walletAddress })
        .sort({ timestamp: -1 })
        .limit(limit);
      
      // Cache results
      if (this.redisClient && trades.length > 0) {
        await this.redisClient.setEx(
          `user_trades:${walletAddress}`,
          300, // 5 minutes
          JSON.stringify(trades)
        );
      }
      
      return trades;
    } catch (error) {
      console.error('Error getting user trades:', error);
      return [];
    }
  }

  // Update User Stats
  async updateUserStats(walletAddress, tradeData) {
    try {
      const user = await this.models.User.findOne({ walletAddress });
      
      if (!user) {
        await this.models.User.create({
          walletAddress,
          totalTrades: 1,
          totalVolume: tradeData.amountIn,
          totalGasSaved: tradeData.gasFee || 0,
          lastActive: new Date()
        });
      } else {
        user.totalTrades += 1;
        user.totalVolume += tradeData.amountIn;
        user.totalGasSaved += tradeData.gasFee || 0;
        user.stats.completedOrders += 1;
        user.lastActive = new Date();
        await user.save();
      }
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  // Manage User Favorites
  async toggleFavorite(walletAddress, pair) {
    try {
      const user = await this.models.User.findOne({ walletAddress });
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      const index = user.favoritePairs.indexOf(pair);
      if (index > -1) {
        user.favoritePairs.splice(index, 1);
      } else {
        user.favoritePairs.push(pair);
      }
      
      await user.save();
      return { success: true, favorites: user.favoritePairs };
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return { success: false, error: error.message };
    }
  }

  // Get Analytics
  async getAnalytics(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const [totalTrades, totalVolume, avgSlippage, totalGasSaved] = await Promise.all([
        this.models.Trade.countDocuments({ timestamp: { $gte: startDate } }),
        this.models.Trade.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$amountIn' } } }
        ]),
        this.models.Trade.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: null, avg: { $avg: '$slippage' } } }
        ]),
        this.models.Audit.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$gasSaved' } } }
        ])
      ]);
      
      const openOrders = await this.models.Order.countDocuments({ status: 'open' });
      const uniqueTraders = await this.models.User.countDocuments({ 
        lastActive: { $gte: startDate } 
      });
      
      return {
        totalTrades,
        totalVolume: totalVolume[0]?.total || 0,
        avgSlippage: avgSlippage[0]?.avg || 0,
        totalGasSaved: totalGasSaved[0]?.total || 0,
        openOrders,
        uniqueTraders,
        period: `${days} days`
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return null;
    }
  }
}

// ==================== QIE BLOCKCHAIN INTEGRATION (Enhanced) ====================

class QIEBlockchain {
  constructor() {
    this.web3 = null;
    this.contracts = {};
    this.config = {
      rpcUrl: process.env.QIE_RPC_URL || 'https://rpc.testnet.qie.digital',
      chainId: 1729,
      explorerUrl: 'https://mainnet.qie.digital'
    };
  }

  // Initialize Web3 connection to QIE
  async initialize() {
    const Web3 = require('web3');
    this.web3 = new Web3(this.config.rpcUrl);
    console.log('✅ QIE Blockchain Connected');
    return true;
  }

  // Write Audit Proof to QIE Blockchain
  async writeAuditProof(auditData) {
    try {
      const crypto = require('crypto');
      const proofHash = '0x' + crypto
        .createHash('sha256')
        .update(JSON.stringify(auditData))
        .digest('hex');
      
      // In production: Write to smart contract on QIE
      // const tx = await this.contracts.AuditRegistry.writeProof(proofHash, auditData);
      
      // Mock transaction for demo
      const tx = {
        hash: proofHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 5000000,
        timestamp: Date.now(),
        status: 'confirmed',
        gasUsed: 45000
      };
      
      console.log('✅ Audit proof written to QIE blockchain:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error writing audit proof:', error);
      throw error;
    }
  }

  // Write Order to Blockchain (for limit/stop orders)
  async writeOrder(orderData) {
    try {
      const crypto = require('crypto');
      const orderHash = '0x' + crypto
        .createHash('sha256')
        .update(JSON.stringify(orderData))
        .digest('hex');
      
      // Mock transaction
      const tx = {
        hash: orderHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 5000000,
        timestamp: Date.now(),
        status: 'pending',
        gasUsed: 65000
      };
      
      console.log('✅ Order written to QIE blockchain:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error writing order:', error);
      throw error;
    }
  }

  // Verify Audit Proof on-chain
  async verifyAuditProof(proofHash) {
    try {
      // In production: Read from smart contract
      // const proof = await this.contracts.AuditRegistry.getProof(proofHash);
      
      // Mock verification
      return {
        verified: true,
        timestamp: Date.now(),
        blockNumber: Math.floor(Math.random() * 1000000) + 5000000
      };
    } catch (error) {
      console.error('Error verifying proof:', error);
      return { verified: false };
    }
  }

  // Get Account Balance
  async getBalance(address) {
    try {
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  }

  // Estimate Gas for Transaction
  async estimateGas(transaction) {
    try {
      const gasEstimate = await this.web3.eth.estimateGas(transaction);
      return gasEstimate;
    } catch (error) {
      console.error('Error estimating gas:', error);
      return 21000;
    }
  }
}

// ==================== IPFS STORAGE ====================

class IPFSStorage {
  constructor() {
    this.ipfsClient = null;
  }

  async initialize() {
    const { create } = require('ipfs-http-client');
    
    try {
      this.ipfsClient = create({
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https'
      });
      console.log('✅ IPFS Connected');
      return true;
    } catch (error) {
      console.error('❌ IPFS Connection Error:', error);
      return false;
    }
  }

  async storeAuditData(auditData) {
    try {
      const result = await this.ipfsClient.add(JSON.stringify(auditData));
      console.log('✅ Audit data stored on IPFS:', result.path);
      return result.path;
    } catch (error) {
      console.error('Error storing on IPFS:', error);
      throw error;
    }
  }

  async retrieveAuditData(ipfsHash) {
    try {
      const chunks = [];
      for await (const chunk of this.ipfsClient.cat(ipfsHash)) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      console.error('Error retrieving from IPFS:', error);
      throw error;
    }
  }
}

// ==================== EXPORT & INITIALIZATION ====================

const db = new Database();
const qieBlockchain = new QIEBlockchain();
const ipfsStorage = new IPFSStorage();

async function initializeStorage() {
  await db.connectMongo();
  await db.connectRedis();
  await qieBlockchain.initialize();
  await ipfsStorage.initialize();
  console.log('🚀 All storage systems initialized');
}

module.exports = {
  db,
  qieBlockchain,
  ipfsStorage,
  initializeStorage,
  Database,
  QIEBlockchain,
  IPFSStorage
};
