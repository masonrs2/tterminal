/**
 * Trading Data Hook - Real-time data management with WebSocket integration
 * Combines HTTP data loading with WebSocket real-time price updates
 * Manages all trading data from backend API with sub-100ms price updates
 * 
 * ARCHITECTURE:
 * ============
 * 1. Initial Load: HTTP endpoints for historical data (candles, volume profile, etc.)
 * 2. Real-time Updates: WebSocket for live price updates and current candle updates
 * 3. Fallback: HTTP polling if WebSocket fails
 * 4. Smart Updates: Only update current candle, preserve historical data
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { TradingAPI } from '../../lib/api'
import { useWebSocketPrice } from './useWebSocketPrice'
import type { CandleData, VolumeProfileEntry, HeatmapData, OrderbookData } from '../../types/trading'

interface TradingDataState {
  candles: CandleData[]
  volumeProfile: VolumeProfileEntry[]
  heatmapData: HeatmapData[]
  orderbook: OrderbookData
  currentPrice: number
  isLoading: boolean
  error: string | null
  lastUpdateTime: number
}

interface UseTradingDataOptions {
  symbol: string
  interval: string
  limit: number
  enableRealTimeUpdates: boolean
  updateInterval: number // milliseconds (for HTTP fallback)
}

// Get appropriate limit based on timeframe to avoid old data
const getTimeframeLimits = (interval: string): number => {
  switch (interval) {
    case '1m':
      return 1500 // Increased from 500 to 1500 minutes = ~25 hours (was only 8 hours)
    case '5m':
      return 500  // Increased from 200 to 500 = ~41 hours (was only 16 hours)
    case '15m':
      return 200  // Increased from 100 to 200 = ~50 hours (was only 25 hours)
    case '30m':
      return 150  // Increased from 100 to 150 = ~75 hours (was only 50 hours)
    case '1h':
      return 120  // Increased from 72 to 120 = 120 hours = 5 days (was only 3 days)
    case '4h':
      return 48   // Increased from 24 to 48 = 192 hours = 8 days (was only 4 days)
    case '1d':
      return 30   // Increased from 14 to 30 = 30 days = 1 month (was only 2 weeks)
    case '1w':
      return 12   // Increased from 8 to 12 = 12 weeks = 3 months (was only 2 months)
    default:
      return 1500 // Default to 1500 for maximum historical data
  }
}

// Helper function to convert interval to milliseconds for accurate candle age calculations
const getIntervalInMs = (interval: string): number => {
  switch (interval) {
    case '1m': return 60 * 1000       // 1 minute
    case '3m': return 3 * 60 * 1000   // 3 minutes  
    case '5m': return 5 * 60 * 1000   // 5 minutes
    case '15m': return 15 * 60 * 1000 // 15 minutes
    case '30m': return 30 * 60 * 1000 // 30 minutes
    case '1h': return 60 * 60 * 1000  // 1 hour
    case '2h': return 2 * 60 * 60 * 1000  // 2 hours
    case '4h': return 4 * 60 * 60 * 1000  // 4 hours
    case '6h': return 6 * 60 * 60 * 1000  // 6 hours
    case '8h': return 8 * 60 * 60 * 1000  // 8 hours
    case '12h': return 12 * 60 * 60 * 1000 // 12 hours
    case '1d': return 24 * 60 * 60 * 1000  // 1 day
    case '3d': return 3 * 24 * 60 * 60 * 1000 // 3 days
    case '1w': return 7 * 24 * 60 * 60 * 1000 // 1 week
    case '1M': return 30 * 24 * 60 * 60 * 1000 // 1 month (approximate)
    default: return 60 * 1000 // Default to 1 minute
  }
}

const defaultOptions: UseTradingDataOptions = {
  symbol: 'BTCUSDT',
  interval: '1m',
  limit: getTimeframeLimits('1m'),
  enableRealTimeUpdates: true,
  // WebSocket for real-time, HTTP polling as fallback only
  updateInterval: process.env.NODE_ENV === 'production' ? 5000 : 2000, // Slower fallback polling
}

// Helper function to save candles to localStorage for persistence across refreshes
const saveCandlesToLocalStorage = (symbol: string, interval: string, candles: CandleData[]) => {
  if (typeof window === 'undefined') return // SSR safety
  
  try {
    const key = `trading_candles_${symbol}_${interval}`
    const dataToSave = {
      candles: candles.slice(-50), // Save only the latest 50 candles to avoid localStorage bloat
      timestamp: Date.now(),
      symbol,
      interval
    }
    localStorage.setItem(key, JSON.stringify(dataToSave))
  } catch (error) {
    console.warn('Failed to save candles to localStorage:', error)
  }
}

// Helper function to load candles from localStorage
const loadCandlesFromLocalStorage = (symbol: string, interval: string): CandleData[] => {
  if (typeof window === 'undefined') return [] // SSR safety
  
  try {
    const key = `trading_candles_${symbol}_${interval}`
    const saved = localStorage.getItem(key)
    if (!saved) return []
    
    const data = JSON.parse(saved)
    
    // Only use cached data if it's less than 10 minutes old
    const age = Date.now() - data.timestamp
    if (age > 10 * 60 * 1000) {
      localStorage.removeItem(key) // Clean up old data
      return []
    }
    
    // Validate the data structure
    if (data.symbol === symbol && data.interval === interval && Array.isArray(data.candles)) {
      console.log(`📂 Restored ${data.candles.length} candles from localStorage for ${symbol}/${interval}`)
      return data.candles
    }
    
    return []
  } catch (error) {
    console.warn('Failed to load candles from localStorage:', error)
    return []
  }
}

// Helper function to analyze data quality across time periods
const analyzeDataQuality = (candles: CandleData[], symbol: string, interval: string) => {
  if (candles.length === 0) {
    console.log(`No candles to analyze for ${symbol}/${interval}`)
    return {
      timeSpan: '0h',
      oldestCandle: 'No data',
      newestCandle: 'No data',
      candleCount: 0,
      avgCandleGap: '0m',
      dataQuality: 'No data'
    }
  }

  const firstCandle = candles[0]
  const lastCandle = candles[candles.length - 1]
  const now = Date.now()
  
  // Calculate time span
  const timeSpanMs = lastCandle.timestamp - firstCandle.timestamp
  const timeSpanHours = timeSpanMs / (1000 * 60 * 60)
  
  // Calculate how old the newest candle is
  const newestCandleAge = (now - lastCandle.timestamp) / (1000 * 60)
  
  // Calculate average gap between candles
  const totalGaps = candles.length - 1
  const avgGapMs = totalGaps > 0 ? timeSpanMs / totalGaps : 0
  const avgGapMinutes = avgGapMs / (1000 * 60)
  
  // Determine data quality
  let dataQuality = 'Good'
  if (newestCandleAge > 10) dataQuality = 'Stale'
  if (timeSpanHours < 1) dataQuality = 'Limited'
  if (candles.length < 10) dataQuality = 'Insufficient'
  
  return {
    timeSpan: `${timeSpanHours > 0 ? '+' : ''}${timeSpanHours.toFixed(1)}h`,
    oldestCandle: `${((now - firstCandle.timestamp) / (1000 * 60 * 60)).toFixed(1)}h ago`,
    newestCandle: `${newestCandleAge.toFixed(1)}m ago`,
    candleCount: candles.length,
    avgCandleGap: `${avgGapMinutes.toFixed(1)}m`,
    dataQuality
  }
}

export const useTradingData = (options: Partial<UseTradingDataOptions> = {}) => {
  const opts = { ...defaultOptions, ...options }
  
  const [state, setState] = useState<TradingDataState>({
    candles: [],
    volumeProfile: [],
    heatmapData: [],
    orderbook: { bids: [], asks: [] },
    currentPrice: 0,
    isLoading: true,
    error: null,
    lastUpdateTime: 0,
  })

  // WebSocket integration for real-time price updates
  const websocketPrice = useWebSocketPrice({ 
    symbol: opts.symbol,
    enabled: opts.enableRealTimeUpdates 
  })

  // Refs for managing intervals and avoiding stale closures
  const updateIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const latestOptionsRef = useRef(opts)
  const isInitializedRef = useRef(false)
  const lastWebSocketUpdateRef = useRef<number>(0)

  // Update options ref when props change
  useEffect(() => {
    latestOptionsRef.current = opts
  }, [opts.symbol, opts.interval, opts.limit, opts.enableRealTimeUpdates, opts.updateInterval])

  // WebSocket real-time price updates with PROPER NEW CANDLE CREATION
  useEffect(() => {
    if (websocketPrice.price !== null && websocketPrice.isConnected) {
      const now = Date.now()
      lastWebSocketUpdateRef.current = now

      // Mark as initialized after first WebSocket update
      if (!isInitializedRef.current) {
        isInitializedRef.current = true
      }

      setState(prev => {
        const threshold = 0.05 // Only update for significant price movements (>$0.05)
        const priceDiff = Math.abs(prev.currentPrice - websocketPrice.price!)

        if (priceDiff > threshold) {
          // CRITICAL: Create completely new objects for React to detect changes
          // This ensures the chart re-renders to show candle movement
          let updatedCandles = [...prev.candles]
          let candleWasUpdated = false
          
          if (updatedCandles.length > 0) {
            const lastCandle = updatedCandles[updatedCandles.length - 1]
            const intervalMs = getIntervalInMs(opts.interval)
            
            // CALCULATE CURRENT CANDLE TIMESTAMP (when current candle period started)
            const currentCandleTimestamp = Math.floor(now / intervalMs) * intervalMs
            const currentPrice = websocketPrice.price!
            
            // CHECK IF WE NEED TO CREATE A NEW CANDLE
            if (currentCandleTimestamp > lastCandle.timestamp) {
              // Create a brand new candle for the new time period
              const newCandle = {
                timestamp: currentCandleTimestamp,
                open: currentPrice,     // Open at current price
                high: currentPrice,     // Initial high is current price
                low: currentPrice,      // Initial low is current price  
                close: currentPrice,    // Close at current price
                volume: 0,              // Start with 0 volume (will be updated by backend)
              }
              
              // Add the new candle to the array (THIS IS THE KEY FIX!)
              updatedCandles = [...updatedCandles, newCandle]
              candleWasUpdated = true
              
              console.log(`🆕 New candle created for ${opts.symbol}/${opts.interval}`)
              
            } else {
              // UPDATE EXISTING LAST CANDLE (current time period)
              
              // Create a COMPLETELY NEW candle object (critical for React re-rendering)
              const newCandle = {
                timestamp: lastCandle.timestamp,
                open: lastCandle.open,  // Keep original open
                high: currentPrice > lastCandle.high ? currentPrice : lastCandle.high,
                low: currentPrice < lastCandle.low ? currentPrice : lastCandle.low,
                close: currentPrice,    // Update close to current price
                volume: lastCandle.volume,
              }
              
              // Replace the last candle with the updated one
              updatedCandles = [...updatedCandles.slice(0, -1), newCandle]
              candleWasUpdated = true
            }
          }

          // SURGICAL STATE UPDATE: Only update what changed to prevent viewport glitching
          const newState = {
            ...prev,
            currentPrice: websocketPrice.price!,
            lastUpdateTime: now,
            // Only update candles if we actually changed them
            ...(candleWasUpdated && { candles: updatedCandles })
          }

          // Save updated candles to localStorage for persistence
          if (candleWasUpdated && updatedCandles.length > 0) {
            saveCandlesToLocalStorage(opts.symbol, opts.interval, updatedCandles)
          }

          return newState
        }
        return prev
      })
    }
  }, [websocketPrice.price, websocketPrice.isConnected, opts.symbol, opts.interval])

  // Load initial data using multi-endpoint for maximum performance
  const loadInitialData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // CRITICAL: If we already have real-time updated candles, don't overwrite them
      if (isInitializedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }))
        return
      }

      // FIRST: Try to restore from localStorage for immediate display
      const localCandles = loadCandlesFromLocalStorage(opts.symbol, opts.interval)
      if (localCandles.length > 0) {
        setState(prev => ({
          ...prev,
          candles: localCandles,
          currentPrice: localCandles[localCandles.length - 1]?.close || 0,
          isLoading: true, // Still loading backend data
          lastUpdateTime: Date.now(),
        }))
      }

      // Get appropriate limit for this timeframe
      const limit = getTimeframeLimits(opts.interval)

      // Use the ultra-fast multi-endpoint to get all data in one request
      const [multiData, latestCandle] = await Promise.all([
        TradingAPI.getMultiData(
          opts.symbol,
          [opts.interval], // Load primary interval
          limit,
          true, // Include volume profile
          true  // Include liquidations
        ),
        TradingAPI.getLatestCandle(opts.symbol, '1m') // Use latest endpoint for current price
      ])

      // Get additional data that's not in multi-endpoint
      const [heatmapData, orderbook] = await Promise.all([
        TradingAPI.getHeatmap(opts.symbol, 6, 100),
        TradingAPI.getOrderbook(opts.symbol),
      ])

      const backendCandles = multiData.candles[opts.interval] || []
      
      // ESSENTIAL HISTORICAL DATA VERIFICATION
      if (backendCandles.length > 0) {
        const now = Date.now()
        const oldestAge = (now - backendCandles[0].timestamp) / (1000 * 60 * 60) // hours
        const newestAge = (now - backendCandles[backendCandles.length - 1].timestamp) / (1000 * 60) // minutes
        const timeSpan = (backendCandles[backendCandles.length - 1].timestamp - backendCandles[0].timestamp) / (1000 * 60 * 60) // hours
        
        // DEBUG: Check actual timestamps and OHLC values
        const firstCandle = backendCandles[0]
        const lastCandle = backendCandles[backendCandles.length - 1]
        
        console.log(`Historical Data Summary ${opts.symbol}/${opts.interval}:`, {
          total: backendCandles.length,
          requested: limit,
          timeSpan: `${timeSpan.toFixed(1)}h`,
          oldest: `${oldestAge.toFixed(1)}h ago`,
          newest: `${newestAge.toFixed(1)}m ago`,
          historical: backendCandles.filter(c => now - c.timestamp >= 6 * 60 * 60 * 1000).length,
          recent: backendCandles.filter(c => now - c.timestamp < 60 * 60 * 1000).length
        })
        
        // DEBUG: Show actual first and last candle details
        console.log(`First candle:`, {
          timestamp: firstCandle.timestamp,
          date: new Date(firstCandle.timestamp).toISOString(),
          ohlc: `O:${firstCandle.open} H:${firstCandle.high} L:${firstCandle.low} C:${firstCandle.close}`
        })
        
        console.log(`Last candle:`, {
          timestamp: lastCandle.timestamp,
          date: new Date(lastCandle.timestamp).toISOString(),
          ohlc: `O:${lastCandle.open} H:${lastCandle.high} L:${lastCandle.low} C:${lastCandle.close}`
        })
        
        // DEBUG: Check if data is in wrong order
        if (firstCandle.timestamp > lastCandle.timestamp) {
          console.error(`DATA ORDER ERROR: First candle is newer than last candle!`)
          console.log(`Sorting candles by timestamp...`)
          
          // Sort candles by timestamp to fix order
          backendCandles.sort((a, b) => a.timestamp - b.timestamp)
        }
      } else {
        console.warn(`No historical data received for ${opts.symbol}/${opts.interval}`)
      }
      
      // MERGE localStorage candles with backend candles
      let finalCandles = [...backendCandles]
      
      if (localCandles.length > 0 && backendCandles.length > 0) {
        const lastBackendCandle = backendCandles[backendCandles.length - 1]
        const newerLocalCandles = localCandles.filter(lc => lc.timestamp > lastBackendCandle.timestamp)
        
        if (newerLocalCandles.length > 0) {
          finalCandles = [...backendCandles, ...newerLocalCandles]
        }
      } else if (localCandles.length > 0 && backendCandles.length === 0) {
        // Use local candles if backend has no data
        finalCandles = localCandles
      }
      
      // CRITICAL FIX: Ensure candles are sorted by timestamp
      // This prevents issues with reverse-ordered data from backend
      const sortedCandles = [...finalCandles].sort((a, b) => a.timestamp - b.timestamp)
      
      // Verify the sort worked
      if (sortedCandles.length > 1) {
        const firstSorted = sortedCandles[0]
        const lastSorted = sortedCandles[sortedCandles.length - 1]
        
        if (firstSorted.timestamp > lastSorted.timestamp) {
          console.error('CRITICAL: Candles still in wrong order after sorting!')
        }
      }

      // Use latest candle for current price
      const currentPrice = latestCandle?.close || (sortedCandles.length > 0 ? sortedCandles[sortedCandles.length - 1].close : 0)

      setState(prev => ({
        ...prev,
        candles: sortedCandles,
        volumeProfile: multiData.volumeProfile || [],
        heatmapData,
        orderbook,
        currentPrice,
        isLoading: false,
        error: null,
        lastUpdateTime: Date.now(),
      }))

      // Mark as initialized after successful data load
      isInitializedRef.current = true

      console.log(`Initial data loaded for ${opts.symbol}/${opts.interval} - ${sortedCandles.length} candles`)
    } catch (error) {
      console.error(`Failed to load initial trading data for ${opts.symbol}/${opts.interval}:`, error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }))
    }
  }, [opts.symbol, opts.interval]) // Only symbol/interval changes should trigger reload

  // Fallback HTTP updates (only when WebSocket is not working)
  const updateFallbackData = useCallback(async () => {
    if (!isInitializedRef.current) return

    // Only use HTTP fallback if WebSocket is not connected or stale
    const wsStale = (Date.now() - lastWebSocketUpdateRef.current) > 10000 // 10 seconds
    if (websocketPrice.isConnected && !wsStale) {
      return // WebSocket is working, skip HTTP polling
    }

    try {
      const currentOpts = latestOptionsRef.current

      // Use the latest endpoint for fallback price updates
      const latestCandle = await TradingAPI.getLatestCandle(currentOpts.symbol, '1m')
      const currentPrice = latestCandle?.close || 0

      setState(prev => {
        const threshold = 0.01 // Higher threshold for HTTP fallback
        if (Math.abs(prev.currentPrice - currentPrice) > threshold) {
          return {
            ...prev,
            currentPrice,
            lastUpdateTime: Date.now(),
          }
        }
        return prev
      })
    } catch (error) {
      console.warn('HTTP fallback update failed:', error)
    }
  }, [websocketPrice.isConnected])

  // Refresh all data (for manual refresh or symbol change)
  const refreshAllData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Load all data fresh
      const [multiData, heatmapData, orderbook, latestCandle] = await Promise.all([
        TradingAPI.getMultiData(
          opts.symbol,
          [opts.interval],
          opts.limit,
          true,
          true
        ),
        TradingAPI.getHeatmap(opts.symbol, 6, 100),
        TradingAPI.getOrderbook(opts.symbol),
        TradingAPI.getLatestCandle(opts.symbol, '1m') // Use latest endpoint for current price
      ])

      const backendCandles = multiData.candles[opts.interval] || []
      // Always use current price from latest 1m candle for accuracy
      const currentPrice = latestCandle?.close || (backendCandles.length > 0 ? backendCandles[backendCandles.length - 1].close : 0)

      // PRESERVE REAL-TIME CANDLES: Merge backend data with existing real-time candles
      setState(prev => {
        let finalCandles = [...backendCandles]
        
        // If we have existing candles, check for newer real-time candles to preserve
        if (prev.candles.length > 0 && backendCandles.length > 0) {
          const lastBackendCandle = backendCandles[backendCandles.length - 1]
          const newerRealTimeCandles = prev.candles.filter(candle => 
            candle.timestamp > lastBackendCandle.timestamp
          )
          
          if (newerRealTimeCandles.length > 0) {
            finalCandles = [...backendCandles, ...newerRealTimeCandles]
          }
        }
        
        return {
          ...prev,
          candles: finalCandles,
          volumeProfile: multiData.volumeProfile || [],
          heatmapData,
          orderbook,
          currentPrice,
          isLoading: false,
          error: null,
          lastUpdateTime: Date.now(),
        }
      })

      console.log(`Data refreshed for ${opts.symbol}`)
    } catch (error) {
      console.error('Failed to refresh trading data:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh data',
      }))
    }
  }, [opts.symbol, opts.interval, opts.limit])

  // Load new interval data (when user changes timeframe)
  const loadInterval = useCallback(async (newInterval: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))

      // Get appropriate limit for this timeframe to avoid old data
      const limit = getTimeframeLimits(newInterval)

      // Get historical data from aggregation endpoint and current price from latest endpoint
      const [candles, latestCandle] = await Promise.all([
        TradingAPI.getCandles(opts.symbol, newInterval, limit),
        TradingAPI.getLatestCandle(opts.symbol, '1m') // Use latest endpoint for current price
      ])
        
      // Use current price from latest 1m candle if available, otherwise use latest candle from timeframe
      const currentPrice = latestCandle?.close || (candles.length > 0 ? candles[candles.length - 1].close : 0)

      setState(prev => ({
        ...prev,
        candles,
        currentPrice, // Always use the most recent price from latest endpoint
        isLoading: false,
        lastUpdateTime: Date.now(),
      }))

      console.log(`Loaded ${newInterval}: ${candles.length} candles`)
    } catch (error) {
      console.error(`Failed to load interval ${newInterval}:`, error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load interval',
      }))
    }
  }, [opts.symbol])

  // Clear API cache
  const clearCache = useCallback(() => {
    TradingAPI.clearCache()
    console.log('🧹 Cache cleared')
  }, [])

  // Clear cache for specific interval (useful for fixing timeframe issues)
  const clearCacheForInterval = useCallback((interval: string) => {
    TradingAPI.clearCacheForSymbol(opts.symbol, interval)
  }, [opts.symbol])

  // Force complete refresh (clears all caches and fetches completely fresh data)
  const forceCompleteRefresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // 1. Clear ALL caches
      TradingAPI.clearCache() // Clear API cache
      
      // 2. Clear localStorage cache  
      if (typeof window !== 'undefined') {
        const key = `trading_candles_${opts.symbol}_${opts.interval}`
        localStorage.removeItem(key)
      }
      
      // 3. Reset initialization flag to force fresh load
      isInitializedRef.current = false
      
      // 4. Get completely fresh data (no cache)
      const limit = getTimeframeLimits(opts.interval)
      
      // 5. Fetch fresh data from all endpoints
      const [freshCandles, latestCandle, multiData, heatmapData, orderbook] = await Promise.all([
        TradingAPI.getFreshCandles(opts.symbol, opts.interval, limit), // Fresh candles
        TradingAPI.getLatestCandle(opts.symbol, '1m'), // Fresh current price
        TradingAPI.getMultiData(opts.symbol, [opts.interval], limit, true, true), // Fresh multi-data
        TradingAPI.getHeatmap(opts.symbol, 6, 100), // Fresh heatmap
        TradingAPI.getOrderbook(opts.symbol), // Fresh orderbook
      ])
      
      // Use the freshest possible data
      const currentPrice = latestCandle?.close || (freshCandles.length > 0 ? freshCandles[freshCandles.length - 1].close : 0)
      
      // Set completely fresh state
      setState({
        candles: freshCandles,
        volumeProfile: multiData.volumeProfile || [],
        heatmapData,
        orderbook,
        currentPrice,
        isLoading: false,
        error: null,
        lastUpdateTime: Date.now(),
      })
      
      // Mark as initialized with fresh data
      isInitializedRef.current = true
      
      console.log(`Force refresh completed - ${freshCandles.length} fresh candles loaded`)
      
    } catch (error) {
      console.error(`Force complete refresh failed:`, error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to force refresh',
      }))
    }
  }, [opts.symbol, opts.interval])

  // Force refresh specific timeframe (for troubleshooting)
  const forceRefreshInterval = useCallback(async (interval: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }))
      
      // Get appropriate limit for this timeframe
      const limit = getTimeframeLimits(interval)
      
      // Clear cache and force fresh data
      TradingAPI.clearCacheForSymbol(opts.symbol, interval)
      
      // Get historical data and current price
      const [candles, latestCandle] = await Promise.all([
        TradingAPI.getFreshCandles(opts.symbol, interval, limit),
        TradingAPI.getLatestCandle(opts.symbol, '1m') // Use latest endpoint for current price
      ])
      
      // Use current price from latest 1m candle if available
      const currentPrice = latestCandle?.close || (candles.length > 0 ? candles[candles.length - 1].close : 0)

      setState(prev => ({
        ...prev,
        candles,
        currentPrice,
        isLoading: false,
        lastUpdateTime: Date.now(),
      }))

      console.log(`Force refreshed ${interval} - ${candles.length} candles loaded`)
    } catch (error) {
      console.error(`Failed to force refresh ${interval}:`, error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : `Failed to refresh ${interval}`,
      }))
    }
  }, [opts.symbol])

  // Initialize data on symbol/interval change
  useEffect(() => {
    isInitializedRef.current = false // Reset initialization flag
    loadInitialData()
  }, [loadInitialData])

  // PERIODIC DATA SYNC: Ensure we stay in sync with backend data collection
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      // Only sync if we have initial data and WebSocket is connected
      if (!isInitializedRef.current || !websocketPrice.isConnected) return
      
      try {
        // Get the latest few candles to check for any missing data
        const freshCandles = await TradingAPI.getCandles(opts.symbol, opts.interval, 10)
        
        setState(prev => {
          if (freshCandles.length === 0) return prev
          
          // Check if we have any new candles that we missed
          const lastLocalCandle = prev.candles[prev.candles.length - 1]
          const lastBackendCandle = freshCandles[freshCandles.length - 1]
          
          if (!lastLocalCandle || lastBackendCandle.timestamp > lastLocalCandle.timestamp) {
            // Check for significant data gap (more than 3 minutes for 1m candles)
            const intervalMs = getIntervalInMs(opts.interval)
            const maxAllowedGap = intervalMs * 3 // Allow up to 3 intervals gap
            
            if (lastLocalCandle) {
              const dataGap = lastBackendCandle.timestamp - lastLocalCandle.timestamp
              
              if (dataGap > maxAllowedGap) {
                console.warn(`Large data gap detected - triggering force refresh`)
                
                // Trigger force refresh in next tick to avoid state conflicts
                setTimeout(() => {
                  forceCompleteRefresh()
                }, 100)
                
                return prev // Don't update state here, let force refresh handle it
              }
            }
            
            // Merge new candles, keeping our real-time updates for current candle
            let mergedCandles = [...prev.candles]
            
            for (const freshCandle of freshCandles) {
              const existingIndex = mergedCandles.findIndex(c => c.timestamp === freshCandle.timestamp)
              
              if (existingIndex === -1) {
                // New candle - add it
                mergedCandles.push(freshCandle)
              } else if (existingIndex < mergedCandles.length - 1) {
                // Historical candle (not the current one) - update it
                mergedCandles[existingIndex] = freshCandle
              }
              // Skip updating the last candle if it's current period (preserve real-time updates)
            }
            
            // Sort by timestamp to ensure correct order
            mergedCandles.sort((a, b) => a.timestamp - b.timestamp)
            
            return {
              ...prev,
              candles: mergedCandles,
              lastUpdateTime: Date.now()
            }
          }
          
          return prev
        })
        
      } catch (error) {
        console.warn(`Periodic sync failed:`, error)
      }
    }, 60000) // Sync every 60 seconds

    return () => clearInterval(syncInterval)
  }, [opts.symbol, opts.interval, websocketPrice.isConnected, forceCompleteRefresh])

  // Auto-scroll viewport to show new candles (optional - can be disabled in manual mode)
  useEffect(() => {
    if (state.candles.length > 0) {
      // This could trigger a viewport update to show latest candles
      // Implementation depends on your chart component's scroll logic
      console.log(`Chart now has ${state.candles.length} candles`)
    }
  }, [state.candles.length])

  // Real-time updates
  useEffect(() => {
    if (!opts.enableRealTimeUpdates || !isInitializedRef.current) return

    // Clear existing interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
    }

    // Set up new interval
    updateIntervalRef.current = setInterval(updateFallbackData, opts.updateInterval)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [opts.enableRealTimeUpdates, opts.updateInterval, updateFallbackData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  return {
    // Data
    candles: state.candles,
    volumeProfile: state.volumeProfile,
    heatmapData: state.heatmapData,
    orderbook: state.orderbook,
    currentPrice: state.currentPrice,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastUpdateTime: state.lastUpdateTime,
    
    // Actions
    refreshAllData,
    loadInterval,
    clearCache,
    clearCacheForInterval,
    forceRefreshInterval,
    forceCompleteRefresh,
    
    // Debugging utilities
    analyzeDataQuality: () => analyzeDataQuality(state.candles, opts.symbol, opts.interval),
    
    // Performance info
    dataCount: state.candles.length,
    isRealTimeActive: opts.enableRealTimeUpdates && isInitializedRef.current,
  }
} 