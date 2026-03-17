import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { Search, TrendingUp, TrendingDown, Zap, Activity, BarChart3, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MarketData {
  candles: number[][];
  price: number;
  direction: string;
  payout: number;
  open: boolean;
}

interface AISignal {
  signal: string;
  confidence: number;
  expires: number;
  strength: string;
}

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [aiSignals, setAiSignals] = useState<Record<string, AISignal>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('market_update', ({ marketData, aiSignals }) => {
      setMarketData(marketData);
      setAiSignals(aiSignals);
    });

    newSocket.on('live_candle', ({ pair, candles }) => {
      setMarketData(prev => ({
        ...prev,
        [pair]: {
          ...prev[pair],
          candles,
          price: candles[candles.length - 1][4],
          direction: candles[candles.length - 1][4] > candles[candles.length - 2][4] ? '🟢' : '🔴',
        }
      }));
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedPair || !chartContainerRef.current) return;

    // Clean up any existing chart before creating a new one
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    // Use the modern addSeries API
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [selectedPair]);

  useEffect(() => {
    if (selectedPair && seriesRef.current && marketData[selectedPair]) {
      const formattedData = marketData[selectedPair].candles.map(c => ({
        time: c[0] as any,
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
      }));
      seriesRef.current.setData(formattedData);
    }
  }, [selectedPair, marketData]);

  const filteredPairs = useMemo(() => {
    return Object.keys(marketData).filter(pair => 
      pair.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [marketData, searchTerm]);

  const handleTrade = (pair: string, signal: string) => {
    const confidence = aiSignals[pair]?.confidence;
    alert(`🎯 Executed ${signal} on ${pair.replace('_otc', '-OTC')}!\nAI Confidence: ${confidence}%\nOrder placed on Finorix/Quotex simulation.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="text-white fill-white" size={24} />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Finorix AI REAL OTC
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-400">REAL-TIME PRODUCTION FEED</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Stats */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search real pairs (e.g. BRL, PKR, BDT...)"
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
             <div className="px-4 py-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2 whitespace-nowrap">
               <BarChart3 size={16} className="text-indigo-400" />
               <span className="text-sm">REAL OTC Data</span>
             </div>
             <div className="px-4 py-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2 whitespace-nowrap">
               <Zap size={16} className="text-amber-400" />
               <span className="text-sm">RSI + EMA AI Active</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Market List */}
          <div className="lg:col-span-1 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredPairs.map((pairKey) => {
                const market = marketData[pairKey];
                const signal = aiSignals[pairKey];
                const isSelected = selectedPair === pairKey;

                return (
                  <motion.div
                    key={pairKey}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedPair(pairKey)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                      isSelected 
                        ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-indigo-400 transition-colors">
                          {pairKey.replace('_otc', '-OTC')}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            market.direction === '🟢' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {market.direction === '🟢' ? 'BULLISH' : 'BEARISH'}
                          </span>
                          <span className="text-xs text-slate-500">{market.payout}% Payout</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-mono font-bold text-white">
                          {market.price.toFixed(5)}
                        </div>
                      </div>
                    </div>

                    {signal && (
                      <div className={`mt-3 p-3 rounded-xl flex items-center justify-between ${
                        signal.signal.includes('CALL') ? 'bg-emerald-500/10 text-emerald-400' : 
                        signal.signal.includes('PUT') ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'
                      }`}>
                        <div className="flex items-center gap-2">
                          {signal.signal.includes('CALL') ? <TrendingUp size={16} /> : 
                           signal.signal.includes('PUT') ? <TrendingDown size={16} /> : <Activity size={16} />}
                          <span className="text-sm font-bold">{signal.signal}</span>
                        </div>
                        <span className="text-xs font-mono">{signal.confidence}% ACC</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Chart and Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPair ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold">{selectedPair.replace('_otc', '-OTC')}</h2>
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Clock size={14} />
                      <span>1M Timeframe</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrade(selectedPair, aiSignals[selectedPair]?.signal || 'CALL')}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                  >
                    EXECUTE TRADE
                  </button>
                </div>

                <div ref={chartContainerRef} className="w-full rounded-2xl overflow-hidden border border-slate-800" />

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">AI Confidence</div>
                    <div className="text-xl font-bold text-indigo-400">{aiSignals[selectedPair]?.confidence}%</div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Signal Strength</div>
                    <div className="text-xl font-bold text-amber-400">{aiSignals[selectedPair]?.strength}</div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Market Status</div>
                    <div className="text-xl font-bold text-emerald-400">OPEN</div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl text-slate-500">
                <BarChart3 size={48} className="mb-4 opacity-20" />
                <p className="text-lg">Select a pair to view real-time analysis</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;
