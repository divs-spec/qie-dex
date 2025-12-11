// ==================== BACKEND API TESTS ====================
// backend/test/api.test.js
const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const { db } = require('../database');

describe('QIE DEX API Tests', () => {
  before(async () => {
    await db.connectMongo('mongodb://localhost:27017/qie_dex_test');
  });

  after(async () => {
    await db.mongoConnection.close();
  });

  describe('Health Check', () => {
    it('should return server status', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(res.body).to.have.property('status', 'online');
      expect(res.body).to.have.property('network');
    });
  });

  describe('Route Optimization', () => {
    it('should optimize routes for valid input', async () => {
      const res = await request(app)
        .post('/api/route/optimize')
        .send({
          fromToken: 'QIE',
          toToken: 'USDT',
          amount: '100',
          orderType: 'market',
          slippageTolerance: 0.5
        })
        .expect(200);
      
      expect(res.body).to.have.property('success', true);
      expect(res.body).to.have.property('routes');
      expect(res.body.routes).to.be.an('array');
      expect(res.body.routes.length).to.be.greaterThan(0);
    });

    it('should return error for invalid amount', async () => {
      const res = await request(app)
        .post('/api/route/optimize')
        .send({
          fromToken: 'QIE',
          toToken: 'USDT',
          amount: '-100'
        })
        .expect(400);
      
      expect(res.body).to.have.property('error');
    });

    it('should return error for missing parameters', async () => {
      const res = await request(app)
        .post('/api/route/optimize')
        .send({
          fromToken: 'QIE'
        })
        .expect(400);
    });
  });

  describe('Order Management', () => {
    let testWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    let orderId;

    it('should create a limit order', async () => {
      const res = await request(app)
        .post('/api/order/create')
        .send({
          walletAddress: testWallet,
          pair: 'QIE/USDT',
          type: 'limit',
          side: 'buy',
          amount: '100',
          price: '0.1200'
        })
        .expect(200);
      
      expect(res.body).to.have.property('success', true);
      expect(res.body.order).to.have.property('orderId');
      orderId = res.body.order.orderId;
    });

    it('should get open orders for wallet', async () => {
      const res = await request(app)
        .get(`/api/orders/open/${testWallet}`)
        .expect(200);
      
      expect(res.body).to.have.property('orders');
      expect(res.body.orders).to.be.an('array');
    });

    it('should cancel an order', async () => {
      const res = await request(app)
        .delete(`/api/order/cancel/${orderId}`)
        .send({ walletAddress: testWallet })
        .expect(200);
      
      expect(res.body).to.have.property('success', true);
    });
  });

  describe('Trade Execution', () => {
    it('should execute a trade', async () => {
      const mockRoute = {
        path: ['QIE', 'USDT'],
        pools: ['QIEDEX'],
        outputAmount: '12.34',
        gasFee: 0.0001,
        slippage: 0.2,
        audit: { score: 95, verified: true }
      };

      const res = await request(app)
        .post('/api/trade/execute')
        .send({
          route: mockRoute,
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          amount: '100',
          orderType: 'market',
          txHash: '0x1234567890abcdef'
        })
        .expect(200);
      
      expect(res.body).to.have.property('success', true);
      expect(res.body.trade).to.have.property('txHash');
    });
  });

  describe('Market Data', () => {
    it('should return current prices', async () => {
      const res = await request(app)
        .get('/api/market/prices')
        .expect(200);
      
      expect(res.body).to.have.property('prices');
      expect(res.body.prices).to.be.an('array');
    });

    it('should return trading pairs', async () => {
      const res = await request(app)
        .get('/api/market/pairs')
        .expect(200);
      
      expect(res.body).to.have.property('pairs');
      expect(res.body.pairs).to.be.an('array');
    });

    it('should return pool analytics', async () => {
      const res = await request(app)
        .get('/api/pools/analytics')
        .expect(200);
      
      expect(res.body).to.have.property('pools');
      expect(res.body).to.have.property('totalLiquidity');
    });
  });
});

// ==================== SMART CONTRACT TESTS ====================
// contracts/test/Router.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QIE Router Tests", function () {
  let router, wqie, factory, token0, token1;
  let owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy WQIE
    const WQIE = await ethers.getContractFactory("WQIE");
    wqie = await WQIE.deploy();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("QIEFactory");
    factory = await Factory.deploy(owner.address);

    // Deploy Audit Registry
    const AuditRegistry = await ethers.getContractFactory("QIEAuditRegistry");
    const auditRegistry = await AuditRegistry.deploy();

    // Deploy Router
    const Router = await ethers.getContractFactory("QIERouter");
    router = await Router.deploy(factory.address, wqie.address, auditRegistry.address);

    // Deploy test tokens
    const Token = await ethers.getContractFactory("TestERC20");
    token0 = await Token.deploy("Token0", "TK0");
    token1 = await Token.deploy("Token1", "TK1");
  });

  describe("Deployment", function () {
    it("Should set the correct factory address", async function () {
      expect(await router.factory()).to.equal(factory.address);
    });

    it("Should set the correct WQIE address", async function () {
      expect(await router.WQIE()).to.equal(wqie.address);
    });
  });

  describe("Swaps", function () {
    beforeEach(async function () {
      // Create pair and add liquidity
      await factory.createPair(token0.address, token1.address);
      
      const amount0 = ethers.utils.parseEther("1000");
      const amount1 = ethers.utils.parseEther("1000");
      
      await token0.approve(router.address, amount0);
      await token1.approve(router.address, amount1);
      
      await router.addLiquidity(
        token0.address,
        token1.address,
        amount0,
        amount1,
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );
    });

    it("Should swap tokens successfully", async function () {
      const amountIn = ethers.utils.parseEther("10");
      const path = [token0.address, token1.address];
      
      await token0.approve(router.address, amountIn);
      
      const amounts = await router.getAmountsOut(amountIn, path);
      
      await expect(
        router.swapExactTokensForTokens(
          amountIn,
          amounts[1],
          path,
          addr1.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.emit(router, "SwapExecuted");
    });

    it("Should revert if deadline expired", async function () {
      const amountIn = ethers.utils.parseEther("10");
      const path = [token0.address, token1.address];
      
      await expect(
        router.swapExactTokensForTokens(
          amountIn,
          0,
          path,
          addr1.address,
          Math.floor(Date.now() / 1000) - 3600 // Expired
        )
      ).to.be.revertedWith("QIERouter: EXPIRED");
    });

    it("Should revert if insufficient output", async function () {
      const amountIn = ethers.utils.parseEther("10");
      const path = [token0.address, token1.address];
      
      await expect(
        router.swapExactTokensForTokens(
          amountIn,
          ethers.utils.parseEther("100"), // Too high
          path,
          addr1.address,
          Math.floor(Date.now() / 1000) + 3600
        )
      ).to.be.revertedWith("QIERouter: INSUFFICIENT_OUTPUT_AMOUNT");
    });
  });

  describe("Get Amounts", function () {
    it("Should calculate amounts out correctly", async function () {
      const amountIn = ethers.utils.parseEther("1");
      const path = [token0.address, token1.address];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      expect(amounts.length).to.equal(2);
      expect(amounts[0]).to.equal(amountIn);
    });

    it("Should revert for invalid path", async function () {
      const amountIn = ethers.utils.parseEther("1");
      const path = [token0.address];
      
      await expect(
        router.getAmountsOut(amountIn, path)
      ).to.be.revertedWith("QIERouter: INVALID_PATH");
    });
  });
});

// ==================== FRONTEND COMPONENT TESTS ====================
// frontend/src/components/__tests__/Trading.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TradingPanel from '../TradingPanel';

describe('Trading Panel', () => {
  test('renders trading panel', () => {
    render(<TradingPanel />);
    expect(screen.getByText(/From/i)).toBeInTheDocument();
    expect(screen.getByText(/To/i)).toBeInTheDocument();
  });

  test('allows amount input', () => {
    render(<TradingPanel />);
    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '100' } });
    expect(input.value).toBe('100');
  });

  test('shows error for invalid amount', async () => {
    render(<TradingPanel />);
    const input = screen.getByPlaceholderText('0.00');
    const analyzeButton = screen.getByText(/Find Best Route/i);
    
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.click(analyzeButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Amount must be greater than 0/i)).toBeInTheDocument();
    });
  });

  test('displays routes after analysis', async () => {
    render(<TradingPanel />);
    const input = screen.getByPlaceholderText('0.00');
    const analyzeButton = screen.getByText(/Find Best Route/i);
    
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(analyzeButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Optimized Routes/i)).toBeInTheDocument();
    });
  });
});

// ==================== E2E TESTS (CYPRESS) ====================
// cypress/e2e/trading.cy.js
describe('Trading Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  it('completes full trading flow', () => {
    // Connect wallet
    cy.contains('Connect Wallet').click();
    cy.contains('MetaMask').click();
    
    // Wait for wallet connection
    cy.contains('Connected', { timeout: 10000 }).should('be.visible');
    
    // Select tokens
    cy.get('select').first().select('QIE');
    cy.get('select').last().select('USDT');
    
    // Enter amount
    cy.get('input[placeholder="0.00"]').first().type('100');
    
    // Analyze routes
    cy.contains('Find Best Route').click();
    
    // Wait for routes
    cy.contains('Optimized Routes', { timeout: 5000 }).should('be.visible');
    
    // Select route
    cy.get('[data-testid="route-card"]').first().click();
    
    // Execute trade
    cy.contains('Execute').click();
    
    // Confirm transaction in MetaMask
    // (This would require MetaMask automation)
    
    // Verify success
    cy.contains('Trade executed successfully', { timeout: 30000 }).should('be.visible');
  });

  it('creates limit order', () => {
    cy.contains('Connect Wallet').click();
    cy.contains('MetaMask').click();
    
    // Switch to limit order
    cy.contains('Limit').click();
    
    // Enter details
    cy.get('input[placeholder="0.00"]').first().type('100');
    cy.get('input[placeholder="0.00"]').eq(1).type('0.125');
    
    // Create order
    cy.contains('Create Order').click();
    
    // Verify order created
    cy.contains('Order created successfully').should('be.visible');
    cy.get('[data-testid="open-orders"]').should('contain', 'QIE/USDT');
  });
});

// ==================== WEBSOCKET TESTS ====================
// websocket/test/websocket.test.js
const WebSocket = require('ws');
const { expect } = require('chai');

describe('WebSocket Server Tests', function() {
  this.timeout(10000);
  
  let ws;
  const WS_URL = 'ws://localhost:8080';

  afterEach((done) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    done();
  });

  it('should connect to WebSocket server', (done) => {
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      expect(ws.readyState).to.equal(WebSocket.OPEN);
      done();
    });
  });

  it('should receive welcome message', (done) => {
    ws = new WebSocket(WS_URL);
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      expect(message).to.have.property('type', 'connected');
      expect(message).to.have.property('userId');
      done();
    });
  });

  it('should subscribe to channels', (done) => {
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['orderbook', 'trades'],
        pair: 'QIE/USDT'
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'subscribed') {
        expect(message.channels).to.include('orderbook');
        expect(message.channels).to.include('trades');
        done();
      }
    });
  });

  it('should receive order book updates', (done) => {
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['orderbook'],
        pair: 'QIE/USDT'
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'orderbook') {
        expect(message.data).to.have.property('bids');
        expect(message.data).to.have.property('asks');
        expect(message.data).to.have.property('midPrice');
        done();
      }
    });
  });

  it('should handle ping/pong', (done) => {
    ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'pong') {
        expect(message).to.have.property('timestamp');
        done();
      }
    });
  });
});

// ==================== MOBILE RESPONSIVENESS CSS ====================
/* 
Add this to frontend/src/styles/mobile.css 
or include in your main CSS file
*/

/* Base responsive breakpoints */
@media (max-width: 1536px) {
  .max-w-7xl {
    max-width: 1280px;
  }
}

@media (max-width: 1280px) {
  .grid-cols-12 {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
  
  .col-span-7 {
    grid-column: span 6 / span 6;
  }
}

@media (max-width: 1024px) {
  /* Tablet layout */
  .grid-cols-12 {
    grid-template-columns: 1fr;
  }
  
  .col-span-2,
  .col-span-3,
  .col-span-7 {
    grid-column: span 1;
  }
  
  /* Hide order book on tablet */
  .desktop-only {
    display: none;
  }
  
  /* Stats bar - 3 columns */
  .grid-cols-6 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  /* Mobile layout */
  
  /* Header adjustments */
  .header-title {
    font-size: 1.25rem;
  }
  
  /* Stats bar - 2 columns */
  .grid-cols-6 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  /* Trading panel */
  .trading-panel {
    padding: 1rem;
  }
  
  /* Route cards */
  .route-card {
    padding: 0.75rem;
  }
  
  .route-metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  
  /* Order book - bottom sheet on mobile */
  .mobile-order-book {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 50vh;
    background: white;
    border-top: 2px solid #16a34a;
    border-radius: 1rem 1rem 0 0;
    transform: translateY(calc(100% - 3rem));
    transition: transform 0.3s ease;
  }
  
  .mobile-order-book.expanded {
    transform: translateY(0);
  }
  
  .mobile-order-book-handle {
    width: 3rem;
    height: 0.25rem;
    background: #d1d5db;
    border-radius: 1rem;
    margin: 0.5rem auto;
    cursor: pointer;
  }
  
  /* Chart container */
  .chart-container {
    height: 300px;
  }
  
  /* Wallet modal */
  .wallet-modal {
    max-width: 90vw;
  }
  
  /* Buttons */
  button {
    padding: 0.75rem 1.5rem;
  }
  
  /* Font sizes */
  .text-2xl {
    font-size: 1.5rem;
  }
  
  .text-xl {
    font-size: 1.25rem;
  }
}

@media (max-width: 640px) {
  /* Small mobile */
  
  /* Single column stats */
  .grid-cols-6 {
    grid-template-columns: 1fr;
  }
  
  /* Smaller padding */
  .p-6 {
    padding: 1rem;
  }
  
  .p-4 {
    padding: 0.75rem;
  }
  
  /* Table adjustments */
  table {
    font-size: 0.75rem;
  }
  
  /* Pair selector */
  .pair-selector-modal {
    max-width: 95vw;
    margin: 1rem;
  }
  
  /* Toast notifications */
  .notification-toast {
    left: 1rem;
    right: 1rem;
    top: 1rem;
  }
}

/* Touch interactions */
@media (hover: none) and (pointer: coarse) {
  /* Larger touch targets */
  button,
  a,
  input,
  select {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Remove hover effects */
  *:hover {
    background-color: inherit;
  }
  
  /* Add active states */
  button:active {
    transform: scale(0.98);
    opacity: 0.8;
  }
}

/* Landscape mobile */
@media (max-width: 768px) and (orientation: landscape) {
  .chart-container {
    height: 250px;
  }
  
  .mobile-order-book {
    max-height: 40vh;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mobile-order-book {
    background: #1f2937;
    border-top-color: #059669;
  }
  
  .mobile-order-book-handle {
    background: #4b5563;
  }
}

// ==================== PERFORMANCE MONITORING ====================
// frontend/src/utils/performance.js
export class PerformanceMonitor {
  constructor() {
    this.metrics = [];
  }

  startMeasure(name) {
    performance.mark(`${name}-start`);
  }

  endMeasure(name) {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    this.metrics.push({
      name,
      duration: measure.duration,
      timestamp: Date.now()
    });
    
    // Send to analytics
    if (window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: name,
        value: Math.round(measure.duration),
        event_category: 'Performance'
      });
    }
    
    performance.clearMarks();
    performance.clearMeasures();
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageTime(name) {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, m) => sum + m.duration, 0) / filtered.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();
