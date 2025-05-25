/**
 * Volume Profile Hook - Real-time volume profile with price level aggregation
 * Volume Profile = Total volume traded at each price level (per row)
 * Simple, fast, and accurate implementation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { tradingWebSocket } from '../../lib/websocket'
import type { 
  VolumeProfileData, 
  VolumeProfileLevel, 
  TradeData, 
  CandleData 
} from '../../types/trading'

interface UseVolumeProfileOptions {
  symbol: string
  timeRange: number // hours
  rowCount: number
  enableRealTime: boolean
  valueAreaPercentage: number // default 70%
  candleData: CandleData[] // PERFORMANCE: Use existing candle data instead of fetching
}

interface VolumeProfileState {
  data: VolumeProfileData | null
  isLoading: boolean
  error: string | null
  lastUpdate: number
}

const defaultOptions: Partial<UseVolumeProfileOptions> = {
  timeRange: 24,
  rowCount: 100,
  enableRealTime: true,
  valueAreaPercentage: 70,
}

export const useVolumeProfile = (options: UseVolumeProfileOptions) => {
  const { symbol, timeRange, rowCount, enableRealTime, valueAreaPercentage, candleData } = options
  
  const [state, setState] = useState<VolumeProfileState>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdate: 0,
  })

  // CRITICAL PERFORMANCE FIX: Separate data loading from display settings
  const dataKey = `${symbol}-${timeRange}-${candleData.length}` // Include candle data length
  const displayKey = `${rowCount}-${valueAreaPercentage}` // Only recalculate display when these change

  // Refs for stable references
  const tradeUnsubscribeRef = useRef<(() => void) | null>(null)
  const priceRangeRef = useRef<{ min: number; max: number } | null>(null)

  // Calculate price levels for volume distribution
  const calculatePriceLevels = useCallback((
    priceRange: { min: number; max: number },
    rowCount: number
  ): number[] => {
    const { min, max } = priceRange
    const step = (max - min) / rowCount
    const levels: number[] = []
    
    for (let i = 0; i < rowCount; i++) {
      levels.push(min + (i * step))
    }
    
    return levels
  }, [])

  // Process candle data into volume profile
  const processHistoricalData = useCallback((
    candles: CandleData[],
    rowCount: number
  ): VolumeProfileData | null => {
    try {
      if (!candles || candles.length === 0) {
        console.warn('No candle data provided for volume profile')
        return null
      }

      console.log(`📊 Processing ${candles.length} candles for volume profile`)

      // Find price range from candle data
      let minPrice = Infinity
      let maxPrice = -Infinity

      candles.forEach(candle => {
        minPrice = Math.min(minPrice, candle.low)
        maxPrice = Math.max(maxPrice, candle.high)
      })

      if (minPrice === Infinity || maxPrice === -Infinity) {
        console.warn('Invalid price range from candle data')
        return null
      }

      // Create price levels
      const priceStep = (maxPrice - minPrice) / rowCount
      const levels: VolumeProfileLevel[] = []

      // Initialize levels
      for (let i = 0; i < rowCount; i++) {
        const price = minPrice + (i * priceStep)
        levels.push({
          price,
          totalVolume: 0,
          buyVolume: 0,
          sellVolume: 0,
          delta: 0,
          isPOC: false,
          isValueArea: false,
        })
      }

      // Distribute volume from candles to price levels
      candles.forEach(candle => {
        // Distribute candle volume across its price range
        const candleLow = candle.low
        const candleHigh = candle.high
        const candleVolume = candle.volume

        // Find which levels this candle affects
        const startLevel = Math.max(0, Math.floor((candleLow - minPrice) / priceStep))
        const endLevel = Math.min(rowCount - 1, Math.floor((candleHigh - minPrice) / priceStep))

        // Distribute volume evenly across affected levels
        const affectedLevels = endLevel - startLevel + 1
        const volumePerLevel = candleVolume / affectedLevels

        for (let i = startLevel; i <= endLevel; i++) {
          levels[i].totalVolume += volumePerLevel
          
          // Simple buy/sell estimation based on candle direction
          const isBullish = candle.close > candle.open
          if (isBullish) {
            levels[i].buyVolume += volumePerLevel * 0.6
            levels[i].sellVolume += volumePerLevel * 0.4
          } else {
            levels[i].buyVolume += volumePerLevel * 0.4
            levels[i].sellVolume += volumePerLevel * 0.6
          }
          
          levels[i].delta = levels[i].buyVolume - levels[i].sellVolume
        }
      })

      // Find POC (Point of Control) - highest volume level
      let pocLevel = levels[0]
      levels.forEach(level => {
        if (level.totalVolume > pocLevel.totalVolume) {
          pocLevel = level
        }
      })
      pocLevel.isPOC = true

      // Calculate Value Area (70% of volume around POC)
      const totalVolume = levels.reduce((sum, level) => sum + level.totalVolume, 0)
      const valueAreaVolume = totalVolume * (valueAreaPercentage / 100)
      
      // Sort levels by volume to find value area
      const sortedLevels = [...levels].sort((a, b) => b.totalVolume - a.totalVolume)
      let accumulatedVolume = 0
      let valueAreaLevels: VolumeProfileLevel[] = []

      for (const level of sortedLevels) {
        if (accumulatedVolume < valueAreaVolume) {
          level.isValueArea = true
          valueAreaLevels.push(level)
          accumulatedVolume += level.totalVolume
        }
      }

      // Find VAH and VAL
      const valueAreaPrices = valueAreaLevels.map(l => l.price).sort((a, b) => a - b)
      const vah = valueAreaPrices[valueAreaPrices.length - 1] || pocLevel.price
      const val = valueAreaPrices[0] || pocLevel.price

      const totalDelta = levels.reduce((sum, level) => sum + level.delta, 0)

      console.log(`✅ Volume profile processed: ${levels.length} levels, POC: $${pocLevel.price.toFixed(2)}, Total Volume: ${totalVolume.toFixed(0)}`)

      return {
        levels,
        poc: pocLevel.price,
        vah,
        val,
        totalVolume,
        totalDelta,
        priceRange: { min: minPrice, max: maxPrice },
        rawCandles: candles, // Store for recalculation
      }
    } catch (error) {
      console.error('Error processing candle data:', error)
      return null
    }
  }, [valueAreaPercentage])

  // PERFORMANCE: Separate calculation function for instant recalculation
  const calculateVolumeProfile = useCallback((
    candles: CandleData[],
    rowCount: number,
    valueAreaPercentage: number
  ): VolumeProfileData | null => {
    return processHistoricalData(candles, rowCount)
  }, [processHistoricalData])

  // Memoize processed data to avoid recalculation
  const processedData = useMemo(() => {
    if (!state.data) return null
    
    // PERFORMANCE: Only recalculate when display settings change, not data
    return calculateVolumeProfile(state.data.rawCandles, rowCount, valueAreaPercentage)
  }, [state.data, displayKey, calculateVolumeProfile]) // Use displayKey instead of individual values

  // Process real-time trade data
  const processTradeUpdate = useCallback((trade: TradeData) => {
    setState(prev => {
      if (!prev.data || !priceRangeRef.current) return prev

      const updatedLevels = [...prev.data.levels]
      const priceRange = priceRangeRef.current!
      const step = (priceRange.max - priceRange.min) / rowCount

      // Find the appropriate price level for this trade
      const levelIndex = Math.floor((trade.price - priceRange.min) / step)
      
      if (levelIndex >= 0 && levelIndex < updatedLevels.length) {
        const level = updatedLevels[levelIndex]
        
        // Add volume to this price level
        level.totalVolume += trade.quantity
        level.trades += 1
        
        // Update buy/sell volumes based on trade direction
        if (trade.isBuyerMaker) {
          level.sellVolume += trade.quantity // Seller initiated
        } else {
          level.buyVolume += trade.quantity // Buyer initiated
        }
        level.delta = level.buyVolume - level.sellVolume

        // Recalculate percentages
        const totalVolume = updatedLevels.reduce((sum, l) => sum + l.totalVolume, 0)
        updatedLevels.forEach(l => {
          l.percentage = totalVolume > 0 ? (l.totalVolume / totalVolume) * 100 : 0
        })

        // Update POC if necessary
        const newPOC = updatedLevels.reduce((max, current) => 
          current.totalVolume > max.totalVolume ? current : max
        )
        
        updatedLevels.forEach(l => {
          l.isPOC = l.price === newPOC.price
        })
      }

      return {
        ...prev,
        data: {
          ...prev.data,
          levels: updatedLevels,
          totalVolume: updatedLevels.reduce((sum, l) => sum + l.totalVolume, 0),
          totalDelta: updatedLevels.reduce((sum, l) => sum + l.delta, 0),
          poc: updatedLevels.find(l => l.isPOC)?.price || prev.data.poc,
        },
        lastUpdate: Date.now(),
      }
    })
  }, [rowCount])

  // Handle real-time trade updates from WebSocket
  const handleTradeUpdate = useCallback((message: any) => {
    if (message.type !== 'trade_update' || message.symbol !== symbol) return

    const trade: TradeData = {
      timestamp: message.trade_time || message.timestamp,
      price: message.price,
      quantity: message.quantity,
      isBuyerMaker: message.is_buyer_maker,
      symbol: message.symbol,
    }

    processTradeUpdate(trade)
  }, [symbol, processTradeUpdate])

  // Load historical data when dependencies change
  useEffect(() => {
    const loadHistoricalData = () => {
      if (!candleData || candleData.length === 0) {
        console.log('⏳ Waiting for candle data...')
        return
      }

      console.log(`🔄 Loading volume profile for ${symbol} with ${candleData.length} candles`)
      
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        const volumeProfileData = processHistoricalData(
          candleData,
          rowCount
        )

        if (volumeProfileData) {
          setState({
            data: volumeProfileData,
            isLoading: false,
            error: null,
            lastUpdate: Date.now(),
          })
          console.log('✅ Volume profile loaded successfully')
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to process candle data',
          }))
          console.log('❌ Volume profile loading failed: No data processed')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }))
        console.error('❌ Volume profile loading failed:', error)
      }
    }

    loadHistoricalData()
  }, [symbol, timeRange, rowCount, candleData, processHistoricalData])

  // Subscribe to real-time trade updates
  useEffect(() => {
    if (typeof window === 'undefined' || !enableRealTime) return

    // Subscribe to trade updates
    tradeUnsubscribeRef.current = tradingWebSocket.subscribe(symbol, handleTradeUpdate)

    return () => {
      if (tradeUnsubscribeRef.current) {
        tradeUnsubscribeRef.current()
        tradeUnsubscribeRef.current = null
      }
    }
  }, [symbol, enableRealTime, handleTradeUpdate])

  // Memoized computed values
  return useMemo(() => {
    // PERFORMANCE: Use memoized processed data instead of state.data
    const data = processedData || state.data
    
    return {
      // Volume profile data
      levels: data?.levels || [],
      poc: data?.poc || null,
      vah: data?.vah || null,
      val: data?.val || null,
      totalVolume: data?.totalVolume || 0,
      totalDelta: data?.totalDelta || 0,
      maxVolumeLevel: data?.levels?.reduce((max, level) => 
        level.totalVolume > (max?.totalVolume || 0) ? level : max, null) || null,
      
      // State
      isLoading: state.isLoading,
      error: state.error,
      lastUpdate: state.lastUpdate,
      
      // Real-time status
      isRealTimeActive: enableRealTime && tradingWebSocket.getConnectionStatus(),
      
      // Utility functions
      refreshData: () => {
        setState(prev => ({ ...prev, lastUpdate: Date.now() }))
      }
    }
  }, [processedData, state, enableRealTime]) // PERFORMANCE: Only recalculate when processedData changes
} 