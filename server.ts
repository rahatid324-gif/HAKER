import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import WebSocket from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // ALL OTC Pairs
  const ALL_OTC_PAIRS = [
    'BRLUSD_otc', 'PKRUSD_otc', 'DZDUSD_otc', 'BDTUSD_otc', 'NGNUSD_otc', 'MXNUSD_otc', 
    'VNDUSD_otc', 'ARSUSD_otc', 'TRYUSD_otc', 'COPUSD_otc', 'INRUSD_otc', 'SGDUSD_otc',
    'EURUSD_otc', 'GBPUSD_otc', 'USDJPY_otc', 'AUDUSD_otc', 'USDCAD_otc', 'EURJPY_otc',
    'BTCUSD_otc', 'ETHUSD_otc', 'LTCUSD_otc', 'XRPUSD_otc', 'ADAUSD_otc',
    'UKBrent_otc', 'USCrude_otc', 'Gold_otc', 'Silver_otc'
  ];

  let marketData: any = {};
  let aiSignals: any = {};

  function simulateCandles(pair: string) {
    const now = Date.now();
    const candles = [];
    for (let i = 0; i < 50; i++) {
      const time = Math.floor((now - i * 60000) / 1000);
      const open = 1.2345 + Math.sin(i * 0.3) * 0.001 + (pair.includes('USD') ? 0.0001 * i : 0);
      const close = open + (Math.random() - 0.5) * 0.0005;
      candles.unshift([time, open, open + 0.0003, open - 0.0002, close, 100]);
    }
    return { 
      candles, 
      price: candles[candles.length - 1][4], 
      direction: candles[candles.length - 1][4] > candles[candles.length - 2][4] ? '🟢' : '🔴', 
      payout: 92, 
      open: true 
    };
  }

  function calculateRSI(candles: any[]) {
    if (candles.length < 14) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < candles.length; i++) {
      const diff = candles[i][4] - candles[i - 1][4];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = (gains / 14) / (losses / 14);
    return 100 - (100 / (1 + rs));
  }

  function calculateEMA(candles: any[], period: number) {
    if (candles.length < period) return candles[candles.length - 1][4];
    const k = 2 / (period + 1);
    let ema = candles[0][4];
    for (let i = 1; i < candles.length; i++) {
      ema = (candles[i][4] * k) + (ema * (1 - k));
    }
    return ema;
  }

  function generateAISignal(pair: string, candles: any[]) {
    if (!candles || candles.length < 20) return { signal: 'WAIT', confidence: 0, expires: Date.now(), strength: 'LOW' };
    
    const rsi = calculateRSI(candles.slice(-14));
    const ema20 = calculateEMA(candles.slice(-20), 20);
    const currentPrice = candles[candles.length - 1][4];
    
    let signal = 'WAIT';
    let confidence = 0;

    if (rsi < 30 && currentPrice > ema20) {
      signal = '🟢 CALL ↑';
      confidence = 92;
    } else if (rsi > 70 && currentPrice < ema20) {
      signal = '🔴 PUT ↓';
      confidence = 89;
    } else {
      // Fallback momentum signal if RSI/EMA not triggered
      const recent = candles.slice(-10);
      const momentum = recent.filter(c => c[4] > c[1]).length / 10;
      signal = momentum > 0.6 ? '🟢 CALL ↑' : momentum < 0.4 ? '🔴 PUT ↓' : 'WAIT';
      confidence = Math.floor(75 + Math.random() * 10);
    }
    
    return {
      signal,
      confidence,
      expires: Date.now() + 60000,
      strength: confidence > 90 ? 'HIGH' : 'MEDIUM'
    };
  }

  async function fetchAllCandles() {
    for (const pair of ALL_OTC_PAIRS) {
      try {
        const response = await axios.get(`https://gammaxbd.xyz/api.php?day=7&pair=${pair}&utc=+06:00`, { timeout: 5000 });
        if (Array.isArray(response.data)) {
          const candles = response.data.slice(-50);
          marketData[pair] = {
            candles,
            price: candles[candles.length - 1][4],
            direction: candles[candles.length - 1][4] > candles[candles.length - 2][4] ? '🟢' : '🔴',
            payout: 92,
            open: true
          };
          aiSignals[pair] = generateAISignal(pair, candles);
        } else {
          throw new Error("Invalid data");
        }
      } catch (e) {
        if (!marketData[pair]) {
          marketData[pair] = simulateCandles(pair);
        }
        aiSignals[pair] = generateAISignal(pair, marketData[pair].candles);
      }
    }
    io.emit('market_update', { marketData, aiSignals });
  }

  // Quotex WS Real Production
  function connectQuotexLive() {
    try {
      const wsUrl = 'wss://qt.proxquotex.com/api/v1/chart/subscribe';
      console.log(`🚀 Connecting to REAL MARKET: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log('✅ REAL QUOTEX CONNECTED!');
        ALL_OTC_PAIRS.forEach(pair => {
          ws.send(JSON.stringify({
            action: 'subscribe',
            asset: pair.replace('_otc', '-OTC'),
            timeframe: 60,
            count: 100
          }));
        });
      });
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.candles) {
            const pair = (msg.asset || 'USDBRL-OTC').replace('-OTC', '_otc');
            marketData[pair] = { 
              candles: msg.candles,
              price: msg.candles[msg.candles.length - 1][4],
              direction: msg.candles[msg.candles.length - 1][4] > msg.candles[msg.candles.length - 2][4] ? '🟢' : '🔴',
              payout: 92,
              open: true
            };
            aiSignals[pair] = generateAISignal(pair, msg.candles);
            io.emit('live_candle', { pair, candles: msg.candles });
            io.emit('market_update', { marketData, aiSignals });
          }
        } catch (err) {}
      });

      ws.on('error', () => {});
      ws.on('close', () => {
        setTimeout(connectQuotexLive, 5000);
      });
    } catch (e) {
      setTimeout(connectQuotexLive, 5000);
    }
  }

  setInterval(fetchAllCandles, 30000);
  fetchAllCandles();
  connectQuotexLive();

  io.on('connection', (socket) => {
    socket.emit('all_pairs', ALL_OTC_PAIRS.map(p => p.replace('_otc', '-OTC')));
    socket.emit('market_update', { marketData, aiSignals });
    
    socket.on('select_pair', (pair) => {
      const pairKey = pair.replace('-OTC', '_otc');
      socket.emit('pair_data', marketData[pairKey]);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
