'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Play, Pause, Settings, TrendingUp, Clock, DollarSign, Activity } from 'lucide-react';

type SortKey = 'price' | 'symbol' | 'timestamp';

interface Transaction {
  id: string;
  symbol: string;
  price: number;
  timestamp: number;
  displayTime: string;
  sortKey?: number;
}

const TradeWiz = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sortedTransactions, setSortedTransactions] = useState<Transaction[]>([]);
  const [sortMethod, setSortMethod] = useState<'radix' | 'merge'>('radix');
  const [sortBy, setSortBy] = useState<SortKey>('price');
  const [transactionRate, setTransactionRate] = useState(1000);
  const [performanceData, setPerformanceData] = useState<{ time: string; radixTime: number; mergeTime: number; transactions: number; totalTransactions: number }[]>([]);
  const [currentStats, setCurrentStats] = useState({
    totalTransactions: 0,
    avgSortTime: 0,
    radixTime: 0,
    mergeTime: 0
  });
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transactionBuffer = useRef<Transaction[]>([]);

  // Stock symbols for realistic data
  const stockSymbols = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'];

  // Generate random transaction
  const generateTransaction = useCallback(() => {
    const symbol = stockSymbols[Math.floor(Math.random() * stockSymbols.length)];
    const price = Math.random() * 1000 + 50; // $50-$1050
    const timestamp = Date.now() * 1000000 + Math.floor(Math.random() * 1000000); // Nanosecond precision
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      price: Math.round(price * 100) / 100,
      timestamp,
      displayTime: new Date().toLocaleTimeString()
    };
  }, []);

  // Preprocess data for radix sort
  const preprocessForRadix = (data: Transaction[], sortKey: SortKey): Transaction[] => {
    return data.map(item => {
      let key = 0; // Initialize with default value
      if (sortKey === 'price') {
        // Convert price to integer (multiply by 100 for cents)
        key = Math.floor(item.price * 100);
      } else if (sortKey === 'symbol') {
        // Convert symbol to integer representation
        key = item.symbol.split('').reduce((acc: number, char: string) => acc * 256 + char.charCodeAt(0), 0);
      } else if (sortKey === 'timestamp') {
        key = item.timestamp;
      }
      return { ...item, sortKey: key };
    });
  };

  // Parallel Radix Sort implementation
  const parallelRadixSort = (arr: Transaction[], sortKey: 'price' | 'symbol' | 'timestamp' = 'price') => {
    if (arr.length <= 1) return { sorted: arr, time: 0 };
    
    const startTime = performance.now();
    const preprocessed = preprocessForRadix(arr, sortKey);
    
    // Find maximum value to determine number of digits
    const maxVal = Math.max(...preprocessed.map(item => item.sortKey || 0));
    const maxDigits = maxVal.toString().length;
    
    let sortedArray = [...preprocessed];
    
    // Radix sort for each digit position
    for (let digit = 0; digit < maxDigits; digit++) {
      const buckets: Transaction[][] = Array.from({ length: 10 }, () => []);
      const divisor = Math.pow(10, digit);
      
      // Distribute into buckets (simulating parallel processing)
      sortedArray.forEach(item => {
        const digitValue = Math.floor((item.sortKey || 0) / divisor) % 10;
        buckets[digitValue].push(item);
      });
      
      // Collect from buckets
      sortedArray = buckets.flat();
    }
    
    const endTime = performance.now();
    return { sorted: sortedArray, time: endTime - startTime };
  };

  // Traditional Merge Sort for comparison
  const mergeSort = (arr: Transaction[], sortKey: 'price' | 'symbol' | 'timestamp' = 'price') => {
    const startTime = performance.now();
    
    const merge = (left: Transaction[], right: Transaction[]) => {
      const result: Transaction[] = [];
      let i = 0, j = 0;
      
      while (i < left.length && j < right.length) {
        const leftVal = sortKey === 'price' ? left[i].price : 
                       sortKey === 'symbol' ? left[i].symbol : 
                       left[i].timestamp;
        const rightVal = sortKey === 'price' ? right[j].price : 
                        sortKey === 'symbol' ? right[j].symbol : 
                        right[j].timestamp;
        
        if (leftVal <= rightVal) {
          result.push(left[i]);
          i++;
        } else {
          result.push(right[j]);
          j++;
        }
      }
      
      return result.concat(left.slice(i)).concat(right.slice(j));
    };
    
    const sort = (array: Transaction[]): Transaction[] => {
      if (array.length <= 1) return array;
      
      const mid = Math.floor(array.length / 2);
      const left = sort(array.slice(0, mid));
      const right = sort(array.slice(mid));
      
      return merge(left, right);
    };
    
    const sorted = sort([...arr]);
    const endTime = performance.now();
    
    return { sorted, time: endTime - startTime };
  };

  // Sort transactions
  const sortTransactions = useCallback((data: Transaction[]) => {
    let radixResult, mergeResult;
    
    if (sortMethod === 'radix') {
      radixResult = parallelRadixSort(data, sortBy);
      mergeResult = mergeSort(data, sortBy); // For comparison
    } else {
      mergeResult = mergeSort(data, sortBy);
      radixResult = parallelRadixSort(data, sortBy); // For comparison
    }
    
    setCurrentStats(prev => ({
      ...prev,
      radixTime: radixResult.time,
      mergeTime: mergeResult.time
    }));
    
    return sortMethod === 'radix' ? radixResult.sorted : mergeResult.sorted;
  }, [sortMethod, sortBy]);

  // Generate and process transactions
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        // Generate batch of transactions
        const batchSize = Math.floor(transactionRate / 10);
        const newTransactions = Array.from({ length: batchSize }, generateTransaction);
        
        transactionBuffer.current = [...transactionBuffer.current, ...newTransactions];
        
        // Process buffer when it reaches certain size
        if (transactionBuffer.current.length >= 100) {
          const bufferLength = transactionBuffer.current.length;
          const sorted = sortTransactions(transactionBuffer.current);
          
          setTransactions(prev => [...prev.slice(-1000), ...transactionBuffer.current].slice(-2000));
          setSortedTransactions(sorted.slice(-500));
          
          // Update stats
          setCurrentStats(prev => {
            const newStats = {
              ...prev,
              totalTransactions: prev.totalTransactions + bufferLength,
              avgSortTime: (prev.radixTime + prev.mergeTime) / 2
            };
            
            // Update performance data
            setPerformanceData(prevData => [...prevData.slice(-20), {
              time: new Date().toLocaleTimeString(),
              radixTime: prev.radixTime,
              mergeTime: prev.mergeTime,
              transactions: bufferLength,
              totalTransactions: newStats.totalTransactions
            }]);
            
            return newStats;
          });
          
          transactionBuffer.current = [];
        } else {
          // Update total transactions even for small batches
          setCurrentStats(prev => ({
            ...prev,
            totalTransactions: prev.totalTransactions + batchSize
          }));
        }
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, transactionRate, generateTransaction, sortTransactions]);

  const toggleSimulation = () => {
    setIsRunning(!isRunning);
  };

  const resetData = () => {
    setIsRunning(false);
    setTransactions([]);
    setSortedTransactions([]);
    setPerformanceData([]);
    setCurrentStats({
      totalTransactions: 0,
      avgSortTime: 0,
      radixTime: 0,
      mergeTime: 0
    });
    transactionBuffer.current = [];
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            TradeWiz
          </h1>
          <p className="text-gray-300 text-lg">Real-time Stock Trading Data Sorting with Parallel Radix Sort</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sort Algorithm</label>
              <select 
                value={sortMethod}
                onChange={(e) => setSortMethod(e.target.value as 'radix' | 'merge')}
                className="w-full bg-slate-700 rounded-lg p-2 text-white border border-slate-600"
              >
                <option value="radix">Parallel Radix Sort</option>
                <option value="merge">Merge Sort</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full bg-slate-700 rounded-lg p-2 text-white border border-slate-600"
              >
                <option value="price">Price</option>
                <option value="symbol">Symbol</option>
                <option value="timestamp">Timestamp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Transaction Rate (per second)</label>
              <input
                type="number"
                value={transactionRate}
                onChange={(e) => setTransactionRate(Math.max(100, Math.min(5000, parseInt(e.target.value))))}
                className="w-full bg-slate-700 rounded-lg p-2 text-white border border-slate-600"
                min="100"
                max="5000"
                step="100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={toggleSimulation}
                className={`flex items-center justify-center w-full p-2 rounded-lg ${
                  isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                } transition-colors`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center mb-2">
              <Activity className="w-5 h-5 mr-2 text-blue-400" />
              <h3 className="text-lg font-medium">Total Transactions</h3>
            </div>
            <p className="text-2xl font-bold">{currentStats.totalTransactions.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center mb-2">
              <Clock className="w-5 h-5 mr-2 text-green-400" />
              <h3 className="text-lg font-medium">Avg Sort Time</h3>
            </div>
            <p className="text-2xl font-bold">{currentStats.avgSortTime.toFixed(2)} ms</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center mb-2">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-400" />
              <h3 className="text-lg font-medium">Radix Sort Time</h3>
            </div>
            <p className="text-2xl font-bold">{currentStats.radixTime.toFixed(2)} ms</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center mb-2">
              <Settings className="w-5 h-5 mr-2 text-orange-400" />
              <h3 className="text-lg font-medium">Merge Sort Time</h3>
            </div>
            <p className="text-2xl font-bold">{currentStats.mergeTime.toFixed(2)} ms</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Comparison Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium mb-4">Sort Performance Comparison</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="radixTime"
                    name="Radix Sort"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="mergeTime"
                    name="Merge Sort"
                    stroke="#F97316"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Transaction Volume Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium mb-4">Transaction Volume</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="transactions"
                    name="Transactions"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeWiz; 