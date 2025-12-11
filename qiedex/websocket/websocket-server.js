// QIE DEX WebSocket Server with Order Matching Engine
// Real-time price feeds, order book updates, and automated order execution
// Dependencies: ws, express, ethers, axios, node-cron

const WebSocket = require('ws');
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = 8080;
const HTTP_PORT = 3002;

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

// Connect to QIE blockchain
const provider = new ethers.JsonRpcProvider('https://rpc.testnet.qie.digital');
const ROUTER_ADDRESS = '0x1234567890123456789012345678901234567890';
const ORDER_BOOK_ADDRESS = '0x2345678901234567890123456789012345678901';

// ABIs (simplified for key functions)
const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const ORDER_BOOK_ABI = [
    "function fillOrder(uint256 orderId, uint256 fillAmount) external returns (bool)",
    "function getOrder(uint256 orderId) external view returns (tuple(uint256 orderId, address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp, uint256 expiresAt, uint8 orderType, uint8 status, uint256 filled))",
    "function getPairOrders(address tokenIn, address tokenOut) external view returns (uint256[] memory)"
];

const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
const orderBookContract = new ethers.Contract(ORDER_BOOK_ADDRESS, ORDER_BOOK_ABI, provider);

// In-memory data stores
const connections = new Map(); // userId => WebSocket connection
const subscriptions = new Map(); // userId => {channels: [], pairs: []}
const priceCache = new Map(); // pair => {price, timestamp}
const orderBookCache = new Map(); // pair => {bids: [], asks: []}
const pendingOrders = new Map(); // orderId => Order details

// ==================== WEBSOCKET CONNECTION HANDLER ====================

wss.on('connection', (ws, req) => {
    const userId = generateUserId();
    connections.set(userId, ws);
    
    console.log(`Client connected: ${userId}`);
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            await handleMessage(ws, userId, data);
        } catch (error) {
            console.error('Message handling error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });
    
    ws.on('close', () => {
        connections.delete(userId);
        subscriptions.delete(userId);
        console.log(`Client disconnected: ${userId}`);
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for ${userId}:`, error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        userId: userId,
        timestamp: Date.now()
    }));
});

// ==================== MESSAGE HANDLERS ====================

async function handleMessage(ws, userId, data) {
    switch (data.type) {
        case 'subscribe':
            await handleSubscribe(ws, userId, data);
            break;
        case 'unsubscribe':
            handleUnsubscribe(userId, data);
            break;
        case 'get_orderbook':
            await sendOrderBook(ws, data.pair);
            break;
        case 'get_price':
            await sendPrice(ws, data.pair);
            break;
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
}

async function handleSubscribe(ws, userId, data) {
    const { channels, pair, address } = data;
    
    subscriptions.set(userId, {
        channels: channels || [],
        pairs: pair ? [pair] : [],
        address: address || null
    });
    
    // Send initial data
    if (channels.includes('orderbook') && pair) {
        await sendOrderBook(ws, pair);
    }
    
    if (channels.includes('trades') && pair) {
        await sendRecentTrades(ws, pair);
    }
    
    if (channels.includes('prices')) {
        await sendAllPrices(ws);
    }
    
    ws.send(JSON.stringify({
        type: 'subscribed',
        channels: channels,
        pair: pair
    }));
}

function handleUnsubscribe(userId, data) {
    const sub = subscriptions.get(userId);
    if (sub) {
        if (data.channel) {
            sub.channels = sub.channels.filter(c => c !== data.channel);
        }
        if (data.pair) {
            sub.pairs = sub.pairs.filter(p => p !== data.pair);
        }
    }
}

// ==================== DATA BROADCAST FUNCTIONS ====================

function broadcast(type, data, filter = null) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    connections.forEach((ws, userId) => {
        if (ws.readyState === WebSocket.OPEN) {
            const sub = subscriptions.get(userId);
            
            // Apply filter if provided
            if (filter && !filter(sub)) return;
            
            ws.send(message);
        }
    });
}

function broadcastToUser(userId, type, data) {
    const ws = connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
}

async function sendOrderBook(ws, pair) {
    const orderBook = await generateOrderBook(pair);
    orderBookCache.set(pair, orderBook);
    
    ws.send(JSON.stringify({
        type: 'orderbook',
        data: orderBook,
        pair: pair,
        timestamp: Date.now()
    }));
}

async function sendPrice(ws, pair) {
    const price = await fetchPrice(pair);
    
    ws.send(JSON.stringify({
        type: 'price',
        data: price,
        pair: pair,
        timestamp: Date.now()
    }));
}

async function sendRecentTrades(ws, pair) {
    // Fetch from database or generate mock data
    const trades = Array.from({ length: 20 }, (_, i) => ({
        price: (0.1234 + (Math.random() - 0.5) * 0.001).toFixed(6),
        amount: (Math.random() * 1000 + 100).toFixed(2),
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: Date.now() - (i * 10000)
    }));
    
    ws.send(JSON.stringify({
        type: 'trades',
        data: trades,
        pair: pair,
        timestamp: Date.now()
    }));
}

async function sendAllPrices(ws) {
    const pairs = ['QIE/USDT', 'ETH/USDT', 'BTC/USDT', 'SOL/USDT'];
    const prices = {};
    
    for (const pair of pairs) {
        prices[pair] = await fetchPrice(pair);
    }
    
    ws.send(JSON.stringify({
        type: 'prices',
        data: prices,
        timestamp: Date.now()
    }));
}

// ==================== ORDER BOOK GENERATION ====================

async function generateOrderBook(pair) {
    // In production, aggregate from multiple DEXs and limit orders
    const [baseToken, quoteToken] = pair.split('/');
    const midPrice = await fetchPrice(pair);
    
    const bids = [];
    const asks = [];
    
    // Generate bid levels
    for (let i = 0; i < 20; i++) {
        const price = (midPrice.price * (1 - (i * 0.001))).toFixed(6);
        const amount = (Math.random() * 10000 + 1000).toFixed(2);
        bids.push({
            price: price,
            amount: amount,
            total: 0, // Will be calculated
            orders: Math.floor(Math.random() * 10) + 1
        });
    }
    
    // Generate ask levels
    for (let i = 0; i < 20; i++) {
        const price = (midPrice.price * (1 + (i * 0.001))).toFixed(6);
        const amount = (Math.random() * 10000 + 1000).toFixed(2);
        asks.push({
            price: price,
            amount: amount,
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
    
    return {
        pair: pair,
        bids: bids,
        asks: asks,
        midPrice: midPrice.price,
        spread: (asks[0].price - bids[0].price).toFixed(6),
        timestamp: Date.now()
    };
}

// ==================== PRICE FETCHING ====================

async function fetchPrice(pair) {
    // Check cache first
    const cached = priceCache.get(pair);
    if (cached && Date.now() - cached.timestamp < 5000) {
        return cached;
    }
    
    // In production, fetch from price oracles (Chainlink, Band Protocol, etc.)
    // For now, return mock data
    const mockPrices = {
        'QIE/USDT': 0.1234,
        'ETH/USDT': 3456.78,
        'BTC/USDT': 98765.43,
        'SOL/USDT': 234.56,
        'MATIC/USDT': 1.23
    };
    
    const price = {
        price: mockPrices[pair] || 1.0,
        change24h: (Math.random() * 10 - 5).toFixed(2),
        volume24h: (Math.random() * 1000000).toFixed(0),
        high24h: (mockPrices[pair] * 1.05).toFixed(6),
        low24h: (mockPrices[pair] * 0.95).toFixed(6),
        timestamp: Date.now()
    };
    
    priceCache.set(pair, price);
    return price;
}

// ==================== ORDER MATCHING ENGINE ====================

class OrderMatchingEngine {
    constructor() {
        this.processing = false;
        this.lastCheck = Date.now();
    }
    
    async start() {
        console.log('Order Matching Engine started');
        
        // Check orders every second
        setInterval(async () => {
            if (!this.processing) {
                await this.processOrders();
            }
        }, 1000);
        
        // Expire orders every minute
        cron.schedule('* * * * *', async () => {
            await this.expireOrders();
        });
    }
    
    async processOrders() {
        this.processing = true;
        
        try {
            // Get all pending orders from database
            const orders = await this.fetchPendingOrders();
            
            for (const order of orders) {
                await this.checkAndExecuteOrder(order);
            }
        } catch (error) {
            console.error('Order processing error:', error);
        } finally {
            this.processing = false;
        }
    }
    
    async fetchPendingOrders() {
        // In production, fetch from database
        // For now, return mock orders
        return Array.from(pendingOrders.values());
    }
    
    async checkAndExecuteOrder(order) {
        try {
            const currentPrice = await fetchPrice(`${order.fromToken}/${order.toToken}`);
            
            let shouldExecute = false;
            
            switch (order.type) {
                case 'limit':
                    // Limit buy: execute when market price <= limit price
                    // Limit sell: execute when market price >= limit price
                    if (order.side === 'buy' && currentPrice.price <= order.limitPrice) {
                        shouldExecute = true;
                    } else if (order.side === 'sell' && currentPrice.price >= order.limitPrice) {
                        shouldExecute = true;
                    }
                    break;
                    
                case 'stop':
                    // Stop buy: execute when market price >= stop price
                    // Stop sell: execute when market price <= stop price
                    if (order.side === 'buy' && currentPrice.price >= order.stopPrice) {
                        shouldExecute = true;
                    } else if (order.side === 'sell' && currentPrice.price <= order.stopPrice) {
                        shouldExecute = true;
                    }
                    break;
                    
                case 'stop_limit':
                    // Trigger stop, then become limit order
                    if (!order.triggered) {
                        if ((order.side === 'buy' && currentPrice.price >= order.stopPrice) ||
                            (order.side === 'sell' && currentPrice.price <= order.stopPrice)) {
                            order.triggered = true;
                            order.type = 'limit';
                        }
                    }
                    break;
            }
            
            if (shouldExecute) {
                await this.executeOrder(order, currentPrice);
            }
        } catch (error) {
            console.error(`Error checking order ${order.id}:`, error);
        }
    }
    
    async executeOrder(order, currentPrice) {
        console.log(`Executing order ${order.id} at price ${currentPrice.price}`);
        
        try {
            // Create wallet from private key (in production, use secure key management)
            const wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY, provider);
            const routerWithSigner = routerContract.connect(wallet);
            
            // Calculate amounts
            const path = [order.tokenInAddress, order.tokenOutAddress];
            const amountIn = ethers.utils.parseUnits(order.amount.toString(), 18);
            const amounts = await routerContract.getAmountsOut(amountIn, path);
            const amountOutMin = amounts[1].mul(995).div(1000); // 0.5% slippage
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
            
            // Execute swap
            const tx = await routerWithSigner.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                order.userAddress,
                deadline,
                {
                    gasLimit: 300000,
                    gasPrice: await provider.getGasPrice()
                }
            );
            
            console.log(`Order ${order.id} transaction: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            // Update order status in database
            await this.updateOrderStatus(order.id, 'filled', {
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                executedPrice: currentPrice.price
            });
            
            // Remove from pending orders
            pendingOrders.delete(order.id);
            
            // Notify user via WebSocket
            const userId = this.findUserByAddress(order.userAddress);
            if (userId) {
                broadcastToUser(userId, 'order_filled', {
                    orderId: order.id,
                    txHash: receipt.transactionHash,
                    executedPrice: currentPrice.price,
                    amount: order.amount,
                    timestamp: Date.now()
                });
            }
            
            // Broadcast trade to all subscribers
            broadcast('trade', {
                pair: `${order.fromToken}/${order.toToken}`,
                price: currentPrice.price,
                amount: order.amount,
                side: order.side,
                timestamp: Date.now()
            }, (sub) => sub.pairs.includes(`${order.fromToken}/${order.toToken}`));
            
        } catch (error) {
            console.error(`Order execution failed for ${order.id}:`, error);
            
            // Notify user of failure
            const userId = this.findUserByAddress(order.userAddress);
            if (userId) {
                broadcastToUser(userId, 'order_failed', {
                    orderId: order.id,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }
    }
    
    async updateOrderStatus(orderId, status, details) {
        // Update in database
        try {
            await axios.put(`http://localhost:3001/api/order/status/${orderId}`, {
                status: status,
                ...details
            });
        } catch (error) {
            console.error('Failed to update order status:', error);
        }
    }
    
    async expireOrders() {
        console.log('Checking for expired orders...');
        
        const now = Date.now();
        const expiredOrders = Array.from(pendingOrders.values()).filter(
            order => order.expiresAt && order.expiresAt < now
        );
        
        for (const order of expiredOrders) {
            console.log(`Expiring order ${order.id}`);
            
            await this.updateOrderStatus(order.id, 'expired', {
                expiredAt: now
            });
            
            pendingOrders.delete(order.id);
            
            // Notify user
            const userId = this.findUserByAddress(order.userAddress);
            if (userId) {
                broadcastToUser(userId, 'order_expired', {
                    orderId: order.id,
                    timestamp: now
                });
            }
        }
    }
    
    findUserByAddress(address) {
        for (const [userId, sub] of subscriptions.entries()) {
            if (sub.address && sub.address.toLowerCase() === address.toLowerCase()) {
                return userId;
            }
        }
        return null;
    }
}

// ==================== REAL-TIME PRICE UPDATES ====================

async function startPriceFeeds() {
    console.log('Starting price feeds...');
    
    const pairs = ['QIE/USDT', 'ETH/USDT', 'BTC/USDT', 'SOL/USDT', 'MATIC/USDT'];
    
    // Update prices every 5 seconds
    setInterval(async () => {
        for (const pair of pairs) {
            const price = await fetchPrice(pair);
            
            // Broadcast to subscribers
            broadcast('price', {
                pair: pair,
                ...price
            }, (sub) => sub.channels.includes('prices'));
        }
    }, 5000);
}

// ==================== ORDER BOOK UPDATES ====================

async function startOrderBookUpdates() {
    console.log('Starting order book updates...');
    
    // Update order books every 3 seconds
    setInterval(async () => {
        const activePairs = new Set();
        
        // Collect all subscribed pairs
        subscriptions.forEach(sub => {
            if (sub.channels.includes('orderbook')) {
                sub.pairs.forEach(pair => activePairs.add(pair));
            }
        });
        
        // Update and broadcast each pair
        for (const pair of activePairs) {
            const orderBook = await generateOrderBook(pair);
            
            broadcast('orderbook', orderBook, (sub) => 
                sub.channels.includes('orderbook') && sub.pairs.includes(pair)
            );
        }
    }, 3000);
}

// ==================== UTILITY FUNCTIONS ====================

function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// ==================== HTTP API (for debugging/management) ====================

app.use(express.json());

app.get('/stats', (req, res) => {
    res.json({
        connections: connections.size,
        subscriptions: subscriptions.size,
        pendingOrders: pendingOrders.size,
        cachedPrices: priceCache.size,
        uptime: process.uptime()
    });
});

app.post('/simulate-order', (req, res) => {
    const { userAddress, fromToken, toToken, amount, type, price } = req.body;
    
    const orderId = 'order_' + Date.now();
    const order = {
        id: orderId,
        userAddress,
        fromToken,
        toToken,
        amount: parseFloat(amount),
        type,
        limitPrice: parseFloat(price),
        stopPrice: parseFloat(price),
        side: 'buy',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        tokenInAddress: '0x...',
        tokenOutAddress: '0x...'
    };
    
    pendingOrders.set(orderId, order);
    
    res.json({ success: true, orderId, order });
});

app.listen(HTTP_PORT, () => {
    console.log(`HTTP API running on port ${HTTP_PORT}`);
});

// ==================== STARTUP ====================

console.log(`
╔═══════════════════════════════════════════╗
║   QIE DEX WebSocket Server + Matching    ║
║   WebSocket Port: ${PORT}                    ║
║   HTTP API Port: ${HTTP_PORT}                    ║
║   Network: QIE Testnet                   ║
╚═══════════════════════════════════════════╝
`);

// Start services
const orderMatcher = new OrderMatchingEngine();
orderMatcher.start();
startPriceFeeds();
startOrderBookUpdates();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});

module.exports = { wss, orderMatcher };
