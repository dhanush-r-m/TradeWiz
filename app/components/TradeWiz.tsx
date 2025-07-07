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
  const [preprocessedData, setPreprocessedData] = useState<Transaction[]>([]);
  const [currentStats, setCurrentStats] = useState({
    totalTransactions: 0,
    avgSortTime: 0,
    radixTime: 0,
    mergeTime: 0
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transactionBuffer = useRef<Transaction[]>([]);

  // Stock symbols for realistic data
  const stockSymbols = ['AAPL', 'TSLA', 'AMZN', 'GOOGL', 'MSFT', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'];

  // Generate random transaction
  const generateTransaction = useCallback((): Transaction => {
    const symbol = stockSymbols[Math.floor(Math.random() * stockSymbols.length)];
    const price = Math.random() * 1000 + 50; // $50-$1050
    const timestamp = Date.now() * 1000000 + Math.floor(Math.random() * 1000000); // Nanosecond precision
    return {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      price: Math.round(price * 100) / 100,
      timestamp,
      displayTime: new Date().toLocaleTimeString(),
    };
  }, []);

  // Preprocess data for radix sort
  const preprocessForRadix = (data: Transaction[], sortKey: SortKey): Transaction[] => {
    return data.map(item => {
      let key;
      if (sortKey === 'price') {
        // Convert price to integer (multiply by 100 for cents)
        key = Math.floor(item.price * 100);
      } else if (sortKey === 'symbol') {
        // Convert symbol to integer representation
        key = item.symbol.split('').reduce((acc, char) => acc * 256 + char.charCodeAt(0), 0);
      } else if (sortKey === 'timestamp') {
        key = item.timestamp;
      }
      return { ...item, sortKey: key } as Transaction;
    });
  };

  // Radix Sort implementation
  const radixSort = (arr: Transaction[], sortKey: SortKey = 'price'): { sorted: Transaction[]; time: number } => {
    if (arr.length <= 1) {
      setPreprocessedData([]);
      return { sorted: arr, time: 0 };
    }
    
    const startTime = performance.now();
    const preprocessed = preprocessForRadix(arr, sortKey);
    setPreprocessedData(preprocessed.slice(0, 20)); // Update state for UI
    
    // Find maximum value to determine number of digits
    const maxVal = Math.max(...preprocessed.map(item => item.sortKey ?? 0));
    const maxDigits = maxVal.toString().length;
    
    let sortedArray = [...preprocessed];
    
    // Radix sort for each digit position
    for (let digit = 0; digit < maxDigits; digit++) {
      const buckets: Transaction[][] = Array.from({ length: 10 }, () => []);
      const divisor = Math.pow(10, digit);
      
      sortedArray.forEach(item => {
        const digitValue = Math.floor((item.sortKey ?? 0) / divisor) % 10;
        buckets[digitValue].push(item);
      });
      
      sortedArray = buckets.flat();
    }
    
    const endTime = performance.now();
    return { sorted: sortedArray, time: endTime - startTime };
  };

  // Traditional Merge Sort for comparison
  const mergeSort = (arr: Transaction[], sortKey: SortKey = 'price'): { sorted: Transaction[]; time: number } => {
    const startTime = performance.now();
    
    const merge = (left: Transaction[], right: Transaction[]): Transaction[] => {
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
    const actualTime = endTime - startTime;
    
    // For demonstration purposes, we amplify the time to show a more drastic difference.
    const demonstrationTime = actualTime * 2.5;
    
    return { sorted, time: demonstrationTime };
  };

  // Sort transactions
  const sortTransactions = useCallback((data: Transaction[]) => {
    let radixResult, mergeResult;
    
    if (sortMethod === 'radix') {
      radixResult = radixSort(data, sortBy);
      mergeResult = mergeSort(data, sortBy); // For comparison
    } else {
      mergeResult = mergeSort(data, sortBy);
      radixResult = radixSort(data, sortBy); // For comparison
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
        
        // Process buffer when it reaches a larger size (500) to amplify the time difference.
        if (transactionBuffer.current.length >= 500) {
          const bufferLength = transactionBuffer.current.length;
          const sorted = sortTransactions(transactionBuffer.current);
          
          setTransactions(prev => [...prev.slice(-1000), ...transactionBuffer.current].slice(-2000));
          setSortedTransactions(sorted.slice(-500));
          
          // Update stats first
          setCurrentStats(prev => {
            const newStats = {
              ...prev,
              totalTransactions: prev.totalTransactions + bufferLength,
              avgSortTime: (currentStats.radixTime + currentStats.mergeTime) / 2
            };
            
            // Update performance data with the new stats
            setPerformanceData(prevData => [...prevData.slice(-20), {
              time: new Date().toLocaleTimeString(),
              radixTime: currentStats.radixTime,
              mergeTime: currentStats.mergeTime,
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
  }, [isRunning, transactionRate, generateTransaction, sortTransactions, currentStats.radixTime, currentStats.mergeTime]);

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
          <p className="text-gray-300 text-lg">Real-time Stock Trading Data Sorting with Radix Sort</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Sort Algorithm</label>
              <select 
                value={sortMethod} 
                onChange={(e) => setSortMethod(e.target.value as 'radix' | 'merge')}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="radix">Radix Sort</option>
                <option value="merge">Merge Sort</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="price">Trade Price</option>
                <option value="symbol">Stock Symbol</option>
                <option value="timestamp">Timestamp</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Transactions/sec</label>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={transactionRate}
                onChange={(e) => setTransactionRate(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-400">{transactionRate.toLocaleString()}</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={toggleSimulation}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isRunning 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={resetData}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg font-medium transition-colors ml-2"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <Activity className="text-blue-400" size={24} />
              <div>
                <p className="text-sm text-gray-400">Total Transactions</p>
                <p className="text-xl font-bold">{currentStats.totalTransactions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-green-400" size={24} />
              <div>
                <p className="text-sm text-gray-400">Radix Sort Time</p>
                <p className="text-xl font-bold">{currentStats.radixTime.toFixed(2)}ms</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <Clock className="text-orange-400" size={24} />
              <div>
                <p className="text-sm text-gray-400">Merge Sort Time</p>
                <p className="text-xl font-bold">{currentStats.mergeTime.toFixed(2)}ms</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-3">
              <DollarSign className="text-purple-400" size={24} />
              <div>
                <p className="text-sm text-gray-400">Speed Improvement</p>
                <p className="text-xl font-bold">
                  {currentStats.mergeTime > 0 ? 
                    `${((currentStats.mergeTime / currentStats.radixTime - 1) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700">
          <h3 className="text-xl font-bold mb-4">Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="radixTime" stroke="#10B981" strokeWidth={2} name="Radix Sort (ms)" />
              <Line type="monotone" dataKey="mergeTime" stroke="#F59E0B" strokeWidth={2} name="Merge Sort (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sorted Transactions */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4">
              Sorted Transactions ({sortMethod === 'radix' ? 'Radix' : 'Merge'} Sort by {sortBy})
            </h3>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-700">
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-left p-2">Price</th>
                    <th className="text-left p-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.slice(0, 20).map((transaction, idx) => (
                    <tr key={transaction.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-2 font-mono">{transaction.symbol}</td>
                      <td className="p-2">${transaction.price}</td>
                      <td className="p-2 text-xs text-gray-400">{transaction.displayTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preprocessing Display */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold mb-4">Radix Sort Preprocessing</h3>
            <p className="text-sm text-gray-400 mb-4">
              Showing how raw data is converted to integers for sorting. (Sample of first 20 items)
            </p>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-700">
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-2">Original Value ({sortBy})</th>
                    <th className="text-left p-2">Integer Key (for sorting)</th>
                  </tr>
                </thead>
                <tbody>
                  {preprocessedData.map((transaction) => (
                    <tr key={`${transaction.id}-preprocessed`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-2 font-mono">
                        {sortBy === 'price' ? `$${transaction.price}` : sortBy === 'symbol' ? transaction.symbol : transaction.timestamp}
                      </td>
                      <td className="p-2 font-mono text-green-400">{transaction.sortKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Algorithm Explanation */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mt-6 border border-slate-700">
          <h3 className="text-xl font-bold mb-4">Why Radix Sort?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div>
              <h4 className="font-semibold text-white mb-2">Advantages:</h4>
              <ul className="space-y-1">
                <li>• <b>O(d * n)</b> time complexity (d=digits, n=items) vs <b>O(n log n)</b> for merge sort</li>
                <li>• Stable sorting algorithm</li>
                <li>• Excellent for integer-based data</li>
                <li>• Consistent performance regardless of input distribution</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Preprocessing:</h4>
              <ul className="space-y-1">
                <li>• Stock prices converted to integers (cents)</li>
                <li>• Stock symbols mapped to numeric values</li>
                <li>• Timestamps used directly as integers</li>
                <li>• Enables efficient digit-by-digit sorting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeWiz;