// QIE DEX Optimizer Pro Backend Server
// Enhanced with Order Book, Limit Orders, Advanced Analytics
// Dependencies: express, cors, body-parser, web3, axios, ws

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (replace with MongoDB/PostgreSQL in production)
const storage = {
  trades: [],
  routes: [],
  audits: [],
  users: new Map(),
  openOrders: [],
  orderBook: { bids: [], asks: [] },
  recentTrades: [],
  priceHistory: [],
  favorites: new Map()
};

// QIE Blockchain Configuration
const QIE_CONFIG = {
  rpcUrl: 'https://rpc.testnet.qie.digital',
  chainId: 1729,
  explorerUrl: 'https://mainnet.qie.digital',
  dexAddress: '0xQIEDEX000000000000000000000000000000',
  routerAddress: '0xROUTER00000000000000000000000000000'
};

// Liquidity Pool Data (Enhanced with real-time metrics)
const LIQUIDITY_POOLS = [
  {
    name: 'QIEDEX',
    address: '0xQIEDEX_POOL_1',
    pairs: ['QIE/USDT', 'QIE/ETH', 'QIE/BTC'],
    liquidity: 5000000,
    fee: 0.001,
    avgSlippage: 0.2,
    volume24h: 1200000,
    trades24h: 3456,
    apy: 12.5
  },
  {
    name: 'Uniswap',
    address: '0xUNISWAP_V3',
    pairs: ['ETH/USDT', 'ETH/BTC', 'USDT/BTC'],
    liquidity: 50000000,
    fee: 0.003,
    avgSlippage: 0.5,
    volume24h: 45000000,
    trades24h: 12345,
    apy: 8.3
  },
  {
    name: 'SushiSwap',
    address: '0xSUSHI_POOL',
    pairs: ['ETH/USDT', 'SOL/USDT'],
    liquidity: 20000000,
    fee: 0.0025,
    avgSlippage: 0.6,
    volume24h: 8500000,
    trades24h: 5678,
    apy: 10.2
  },
  {
    name: 'PancakeSwap',
    address: '0xCAKE_POOL',
    pairs: ['BTC/USDT', 'ETH/USDT'],
    liquidity: 30000000,
    fee: 0.002,
    avgSlippage: 0.7,
    volume24h: 15000000,
    trades24h: 8901,
    apy: 9.5
  }
];

// Token Price Oracle (Enhanced with market data)
const PRICE_ORACLE = {
  'QIE': { price: 0.1234, change24h: 5.67, volume24h: 1200000, marketCap: 12340000 },
  'USDT': { price: 1.0, change24h: 0.01, volume24h: 500000000, marketCap: 95000000000 },
  'ETH': { price: 3456.78, change24h: 2.34, volume24h: 45000000, marketCap: 415000000000 },
  'BTC': { price: 98765.43, change24h: -1.23, volume24h: 120000000, marketCap: 1950000000000 },
  'SOL': { price: 234.56, change24h: 8.90, volume24h: 8500000, marketCap: 105000000000 },
  'MATIC': { price: 1.23, change24h: -2.45, volume24h: 3200000, marketCap: 11000000000 }
};

// ==================== ORDER BOOK ENGINE ====================

function initializeOrderBook(pair) {
  const midPrice = PRICE_ORACLE[pair.split('/')[0]]?.price || 0.1234;
  const spread = midPrice * 0.001; // 0.1% spread
  
  const bids = [];
  const asks = [];
  
  // Generate 20 levels for bids and asks
  for (let i = 0; i < 20; i++) {
    bids.push({
      price: (midPrice - spread - (i * 0.0001)).toFixed(6),
      amount: (Math.random() * 10000 + 1000).toFixed(2),
      total: 0,
      orders: Math.floor(Math.random() * 10) + 1
    });
    
    asks.push({
      price: (midPrice + spread + (i * 0.0001)).toFixed(6),
      amount: (Math.random() * 10000 + 1000).toFixed(2),
      total: 0,
      orders: Math.floor(Math.random() * 10) + 1
    });
  }
  
  // Calculate cumulative totals
  let bidTotal = 0;
  bids.forEach(bid => {
    bidTotal += parseFloat(bid.amount);
    bid.total = bidTotal;
  });
  
  let askTotal = 0;
  asks.forEach(ask => {
    askTotal += parseFloat(ask.amount);
    ask.total = askTotal;
  });
  
  return { bids, asks, midPrice, spread };
}

function updateOrderBook(pair) {
  const book = initializeOrderBook(pair);
  storage.orderBook[pair] = book;
  return book;
}

// ==================== RECENT TRADES ENGINE ====================

function generateRecentTrade(pair) {
  const baseToken = pair.split('/')[0];
  const midPrice = PRICE_ORACLE[baseToken]?.price || 0.1234;
  
  return {
    id: Date.now() + Math.random(),
    pair: pair,
    price: (midPrice + (Math.random() - 0.5) * midPrice * 0.01).toFixed(6),
    amount: (Math.random() * 1000 + 100).toFixed(4),
    total: 0,
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString()
  };
}

// ==================== ORDER MANAGEMENT ====================

function createOrder(orderData) {
  const order = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    userId: orderData.walletAddress,
    pair: orderData.pair,
    type: orderData.type, // 'market', 'limit', 'stop'
    side: orderData.side, // 'buy', 'sell'
    price: orderData.price || null,
    stopPrice: orderData.stopPrice || null,
    amount: parseFloat(orderData.amount),
    filled: 0,
    remaining: parseFloat(orderData.amount),
    status: orderData.type === 'market' ? 'filled' : 'open',
    slippage: orderData.slippage || 0.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    txHash: null,
    gasFee: 0
  };
  
  if (order.type === 'market') {
    // Execute immediately
    order.filled = 100;
    order.remaining = 0;
    order.status = 'filled';
    order.txHash = '0x' + Math.random().toString(16).substr(2, 64);
    order.gasFee = 0.0001;
  } else {
    // Add to open orders
    storage.openOrders.push(order);
  }
  
  return order;
}

function cancelOrder(orderId, walletAddress) {
  const orderIndex = storage.openOrders.findIndex(
    o => o.id === orderId && o.userId === walletAddress
  );
  
  if (orderIndex === -1) {
    return { success: false, error: 'Order not found' };
  }
  
  const order = storage.openOrders[orderIndex];
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  
  storage.openOrders.splice(orderIndex, 1);
  
  return { success: true, order };
}

// ==================== ROUTE OPTIMIZATION ENGINE (Enhanced) ====================

function calculatePriceImpact(amountIn, liquidity) {
  return (amountIn / liquidity) * 100;
}

function calculateSlippage(pool, amountIn, slippageTolerance = 0.5) {
  const baseSlippage = pool.avgSlippage;
  const liquidityImpact = (amountIn / pool.liquidity) * 10;
  const calculatedSlippage = baseSlippage + liquidityImpact;
  
  return Math.min(calculatedSlippage, slippageTolerance);
}

function calculateGasFee(hops, network = 'QIE') {
  const baseGas = network === 'QIE' ? 0.0001 : 0.001;
  return baseGas * hops * (1 + Math.random() * 0.5);
}

function simulateSwap(fromToken, toToken, amountIn, pool) {
  const fromPrice = PRICE_ORACLE[fromToken]?.price || 1;
  const toPrice = PRICE_ORACLE[toToken]?.price || 1;
  
  const baseOutput = (amountIn * fromPrice) / toPrice;
  const feeDeduction = baseOutput * pool.fee;
  const slippage = calculateSlippage(pool, amountIn);
  const slippageDeduction = baseOutput * (slippage / 100);
  
  return {
    outputAmount: baseOutput - feeDeduction - slippageDeduction,
    fee: feeDeduction,
    slippage: slippage,
    priceImpact: calculatePriceImpact(amountIn, pool.liquidity)
  };
}

function findAllRoutes(fromToken, toToken, amount, maxHops = 3) {
  const routes = [];
  
  // Direct routes (1 hop)
  LIQUIDITY_POOLS.forEach(pool => {
    const pair = `${fromToken}/${toToken}`;
    if (pool.pairs.includes(pair)) {
      const swap = simulateSwap(fromToken, toToken, amount, pool);
      const gasFee = calculateGasFee(1);
      
      routes.push({
        id: routes.length + 1,
        path: [fromToken, toToken],
        pools: [pool.name],
        poolAddresses: [pool.address],
        ...swap,
        gasFee: gasFee,
        netOutput: swap.outputAmount - gasFee,
        hops: 1,
        executionTime: 3,
        gasLimit: 150000
      });
    }
  });
  
  // Two-hop routes
  const intermediateTokens = ['ETH', 'USDT', 'BTC', 'MATIC'];
  intermediateTokens.forEach(midToken => {
    if (midToken === fromToken || midToken === toToken) return;
    
    const hop1Pools = LIQUIDITY_POOLS.filter(p => 
      p.pairs.includes(`${fromToken}/${midToken}`)
    );
    const hop2Pools = LIQUIDITY_POOLS.filter(p => 
      p.pairs.includes(`${midToken}/${toToken}`)
    );
    
    hop1Pools.forEach(pool1 => {
      hop2Pools.forEach(pool2 => {
        const swap1 = simulateSwap(fromToken, midToken, amount, pool1);
        const swap2 = simulateSwap(midToken, toToken, swap1.outputAmount, pool2);
        const gasFee = calculateGasFee(2);
        
        routes.push({
          id: routes.length + 1,
          path: [fromToken, midToken, toToken],
          pools: [pool1.name, pool2.name],
          poolAddresses: [pool1.address, pool2.address],
          outputAmount: swap2.outputAmount,
          fee: swap1.fee + swap2.fee,
          slippage: swap1.slippage + swap2.slippage,
          priceImpact: swap1.priceImpact + swap2.priceImpact,
          gasFee: gasFee,
          netOutput: swap2.outputAmount - gasFee,
          hops: 2,
          executionTime: 8,
          gasLimit: 300000
        });
      });
    });
  });
  
  return routes;
}

// ==================== AUDIT ENGINE (Enhanced) ====================

function auditRoute(route, amountIn, userSlippage = 0.5) {
  let score = 100;
  let issues = [];
  let warnings = [];
  
  // Check slippage
  if (route.slippage > userSlippage) {
    score -= 15;
    issues.push(`Slippage exceeds tolerance (${route.slippage.toFixed(2)}% > ${userSlippage}%)`);
  } else if (route.slippage > userSlippage * 0.8) {
    score -= 5;
    warnings.push('Slippage near tolerance limit');
  }
  
  // Check price impact
  if (route.priceImpact > 2.0) {
    score -= 20;
    issues.push('Very high price impact - consider splitting order');
  } else if (route.priceImpact > 1.0) {
    score -= 10;
    warnings.push('Significant price impact detected');
  }
  
  // Check fee efficiency
  const feePercentage = (route.fee / amountIn) * 100;
  if (feePercentage > 1.0) {
    score -= 15;
    issues.push('High fees relative to trade amount');
  } else if (feePercentage > 0.5) {
    score -= 5;
    warnings.push('Fees are higher than optimal');
  }
  
  // Check gas efficiency
  if (route.gasFee > amountIn * 0.01) {
    score -= 10;
    issues.push('Gas fees are significant relative to trade size');
  }
  
  // Check execution time
  if (route.executionTime > 15) {
    score -= 10;
    issues.push('Slow execution time increases failure risk');
  } else if (route.executionTime > 10) {
    score -= 5;
    warnings.push('Execution time is above average');
  }
  
  // Check multi-hop risk
  if (route.hops > 2) {
    score -= 15;
    issues.push('Multiple hops increase complexity and failure risk');
  } else if (route.hops === 2) {
    score -= 5;
    warnings.push('Two-hop route has moderate complexity');
  }
  
  // Calculate gas savings vs average
  const avgGas = 0.15;
  const gasSaved = avgGas - route.gasFee;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    safe: score >= 75,
    verified: true,
    issues: issues,
    warnings: warnings,
    timestamp: new Date().toISOString(),
    auditHash: generateHash(route),
    recommendation: score >= 90 ? 'highly_recommended' : score >= 75 ? 'recommended' : 'use_caution',
    gasSaved: gasSaved > 0 ? gasSaved : 0
  };
}

function generateHash(data) {
  const crypto = require('crypto');
  return '0x' + crypto.createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

// ==================== API ENDPOINTS ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    network: 'QIE Testnet',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['order_book', 'limit_orders', 'advanced_analytics']
  });
});

// Get Network Stats
app.get('/api/network/stats', (req, res) => {
  const totalVolume24h = Object.values(PRICE_ORACLE).reduce((sum, token) => sum + token.volume24h, 0);
  const avgAuditScore = storage.audits.length > 0 
    ? storage.audits.reduce((a, b) => a + b.score, 0) / storage.audits.length 
    : 92.5;
  
  res.json({
    tps: 25000 + Math.floor(Math.random() * 5000),
    finality: 3,
    avgGas: 0.0001,
    activeValidators: 1234,
    totalTrades: storage.trades.length,
    totalVolume24h: totalVolume24h,
    avgAuditScore: avgAuditScore.toFixed(1),
    totalGasSaved: storage.audits.reduce((sum, a) => sum + (a.gasSaved || 0), 0).toFixed(2),
    openOrders: storage.openOrders.length,
    activePairs: Object.keys(PRICE_ORACLE).length
  });
});

// Get Order Book
app.get('/api/orderbook/:pair', (req, res) => {
  const { pair } = req.params;
  const book = updateOrderBook(pair);
  
  res.json({
    success: true,
    pair: pair,
    bids: book.bids,
    asks: book.asks,
    midPrice: book.midPrice,
    spread: book.spread,
    timestamp: new Date().toISOString()
  });
});

// Get Recent Trades
app.get('/api/trades/recent/:pair', (req, res) => {
  const { pair } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  // Generate recent trades if not enough in storage
  while (storage.recentTrades.filter(t => t.pair === pair).length < limit) {
    storage.recentTrades.unshift(generateRecentTrade(pair));
  }
  
  const trades = storage.recentTrades
    .filter(t => t.pair === pair)
    .slice(0, limit);
  
  res.json({
    success: true,
    trades: trades,
    count: trades.length
  });
});

// Optimize Route (Enhanced)
app.post('/api/route/optimize', async (req, res) => {
  try {
    const { fromToken, toToken, amount, orderType, slippageTolerance } = req.body;
    
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const amountNum = parseFloat(amount);
    const slippage = parseFloat(slippageTolerance) || 0.5;
    
    // Find all possible routes
    const allRoutes = findAllRoutes(fromToken, toToken, amountNum);
    
    // Audit each route
    const auditedRoutes = allRoutes.map((route) => {
      const audit = auditRoute(route, amountNum, slippage);
      return {
        ...route,
        route: route.path.join(' → '),
        poolsDisplay: route.pools.join(' → '),
        audit: audit,
        recommended: audit.recommendation === 'highly_recommended'
      };
    });
    
    // Sort by best net output after fees
    auditedRoutes.sort((a, b) => b.netOutput - a.netOutput);
    
    // Mark the best route
    if (auditedRoutes.length > 0) {
      auditedRoutes[0].recommended = true;
    }
    
    // Store route analysis
    storage.routes.push({
      timestamp: new Date().toISOString(),
      fromToken,
      toToken,
      amount: amountNum,
      orderType,
      routes: auditedRoutes,
      bestRoute: auditedRoutes[0]?.id
    });
    
    res.json({
      success: true,
      routes: auditedRoutes,
      bestRoute: auditedRoutes[0],
      totalRoutesFound: auditedRoutes.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Route optimization failed', details: error.message });
  }
});

// Create Order
app.post('/api/order/create', async (req, res) => {
  try {
    const { walletAddress, pair, type, side, amount, price, stopPrice, slippage } = req.body;
    
    if (!walletAddress || !pair || !type || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const order = createOrder({
      walletAddress,
      pair,
      type,
      side,
      amount,
      price,
      stopPrice,
      slippage
    });
    
    res.json({
      success: true,
      order: order,
      message: type === 'market' ? 'Order executed' : 'Order created'
    });
    
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// Get Open Orders
app.get('/api/orders/open/:address', (req, res) => {
  const { address } = req.params;
  const orders = storage.openOrders.filter(o => o.userId === address);
  
  res.json({
    success: true,
    orders: orders,
    count: orders.length
  });
});

// Cancel Order
app.delete('/api/order/cancel/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { walletAddress } = req.body;
  
  const result = cancelOrder(orderId, walletAddress);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// Execute Trade
app.post('/api/trade/execute', async (req, res) => {
  try {
    const { route, walletAddress, amount, orderType } = req.body;
    
    if (!route || !walletAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Generate transaction hash
    const txHash = generateHash({
      route,
      walletAddress,
      timestamp: Date.now()
    });
    
    // Store trade
    const trade = {
      id: storage.trades.length + 1,
      txHash,
      walletAddress,
      route: route.route,
      fromToken: route.path[0],
      toToken: route.path[route.path.length - 1],
      amountIn: amount,
      amountOut: route.outputAmount,
      gasFee: route.gasFee,
      slippage: route.slippage,
      priceImpact: route.priceImpact,
      orderType: orderType || 'market',
      timestamp: new Date().toISOString(),
      status: 'completed',
      blockNumber: Math.floor(Math.random() * 1000000) + 5000000,
      gasUsed: route.gasLimit,
      effectivePrice: route.outputAmount / amount
    };
    
    storage.trades.push(trade);
    
    // Store audit proof
    const auditProof = {
      tradeId: trade.id,
      txHash: txHash,
      routeHash: route.audit.auditHash,
      auditScore: route.audit.score,
      verified: true,
      gasSaved: route.audit.gasSaved || 0,
      timestamp: new Date().toISOString()
    };
    
    storage.audits.push(auditProof);
    
    // Add to recent trades
    storage.recentTrades.unshift({
      id: Date.now(),
      pair: `${trade.fromToken}/${trade.toToken}`,
      price: trade.effectivePrice.toFixed(6),
      amount: amount,
      side: 'buy',
      timestamp: trade.timestamp,
      time: new Date().toLocaleTimeString()
    });
    
    res.json({
      success: true,
      trade: trade,
      auditProof: auditProof,
      explorerUrl: `${QIE_CONFIG.explorerUrl}/tx/${txHash}`
    });
    
  } catch (error) {
    console.error('Trade execution error:', error);
    res.status(500).json({ error: 'Trade execution failed' });
  }
});

// Get Trade History
app.get('/api/trade/history/:address', (req, res) => {
  const { address } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const trades = storage.trades
    .filter(t => t.walletAddress === address)
    .reverse()
    .slice(0, limit);
  
  res.json({
    success: true,
    trades: trades,
    count: trades.length
  });
});

// Get Market Data (Enhanced)
app.get('/api/market/prices', (req, res) => {
  const prices = Object.entries(PRICE_ORACLE).map(([token, data]) => ({
    token,
    price: data.price,
    change24h: data.change24h,
    volume24h: data.volume24h,
    marketCap: data.marketCap,
    timestamp: new Date().toISOString()
  }));
  
  res.json({
    success: true,
    prices: prices,
    timestamp: new Date().toISOString()
  });
});

// Get Trading Pairs
app.get('/api/market/pairs', (req, res) => {
  const pairs = [];
  
  Object.keys(PRICE_ORACLE).forEach(base => {
    Object.keys(PRICE_ORACLE).forEach(quote => {
      if (base !== quote && quote === 'USDT') {
        const baseData = PRICE_ORACLE[base];
        pairs.push({
          pair: `${base}/${quote}`,
          baseToken: base,
          quoteToken: quote,
          price: baseData.price,
          change24h: baseData.change24h,
          volume24h: baseData.volume24h,
          high24h: (baseData.price * 1.05).toFixed(6),
          low24h: (baseData.price * 0.95).toFixed(6)
        });
      }
    });
  });
  
  res.json({
    success: true,
    pairs: pairs,
    count: pairs.length
  });
});

// Get Pool Analytics (Enhanced)
app.get('/api/pools/analytics', (req, res) => {
  const analytics = LIQUIDITY_POOLS.map(pool => ({
    name: pool.name,
    address: pool.address,
    liquidity: pool.liquidity,
    volume24h: pool.volume24h,
    trades24h: pool.trades24h,
    fee: pool.fee,
    avgSlippage: pool.avgSlippage,
    apy: pool.apy,
    pairs: pool.pairs
  }));
  
  res.json({
    success: true,
    pools: analytics,
    totalLiquidity: LIQUIDITY_POOLS.reduce((sum, p) => sum + p.liquidity, 0),
    totalVolume24h: LIQUIDITY_POOLS.reduce((sum, p) => sum + p.volume24h, 0)
  });
});

// User Favorites
app.post('/api/user/favorites', (req, res) => {
  const { walletAddress, pair, action } = req.body;
  
  if (!storage.favorites.has(walletAddress)) {
    storage.favorites.set(walletAddress, []);
  }
  
  const userFavorites = storage.favorites.get(walletAddress);
  
  if (action === 'add' && !userFavorites.includes(pair)) {
    userFavorites.push(pair);
  } else if (action === 'remove') {
    const index = userFavorites.indexOf(pair);
    if (index > -1) userFavorites.splice(index, 1);
  }
  
  res.json({
    success: true,
    favorites: userFavorites
  });
});

app.get('/api/user/favorites/:address', (req, res) => {
  const { address } = req.params;
  const favorites = storage.favorites.get(address) || [];
  
  res.json({
    success: true,
    favorites: favorites
  });
});

// Analytics Dashboard
app.get('/api/analytics/dashboard', (req, res) => {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const trades24h = storage.trades.filter(t => new Date(t.timestamp) > last24h);
  const volume24h = trades24h.reduce((sum, t) => sum + parseFloat(t.amountIn), 0);
  const avgSlippage = trades24h.length > 0
    ? trades24h.reduce((sum, t) => sum + t.slippage, 0) / trades24h.length
    : 0;
  const totalGasSaved = storage.audits.reduce((sum, a) => sum + (a.gasSaved || 0), 0);
  
  res.json({
    success: true,
    trades24h: trades24h.length,
    volume24h: volume24h.toFixed(2),
    avgSlippage: avgSlippage.toFixed(3),
    totalGasSaved: totalGasSaved.toFixed(4),
    avgAuditScore: storage.audits.length > 0 
      ? (storage.audits.reduce((sum, a) => sum + a.auditScore, 0) / storage.audits.length).toFixed(1)
      : '0',
    openOrders: storage.openOrders.length,
    uniqueTraders: new Set(storage.trades.map(t => t.walletAddress)).size
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`
    ╔═══════════════════════════════════════════╗
    ║   QIE DEX Optimizer Pro Backend Server   ║
    ║   Version: 2.0.0                          ║
    ║   Port: ${PORT}                            ║
    ║   Network: QIE Testnet                    ║
    ║   Features: Order Book, Limit Orders      ║
    ╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
