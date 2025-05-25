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
  CandleData,
  ViewportState,
  SinglePrint
} from '../../types/trading'

interface UseVolumeProfileOptions {
  symbol: string
  timeRange: number // hours
  rowCount: number
  enableRealTime: boolean
  valueAreaPercentage: number // default 70%
  candleData: CandleData[] // PERFORMANCE: Use existing candle data instead of fetching
  viewportState: ViewportState // DYNAMIC: Current viewport for visible candles
  chartWidth: number // DYNAMIC: Chart dimensions
  chartHeight: number // DYNAMIC: Chart dimensions
  rangeMode: 'visible' | 'fixed' // Calculate from visible candles or fixed number
  fixedCandleCount?: number // Number of candles to use when rangeMode is 'fixed'
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
  rangeMode: 'fixed',
  fixedCandleCount: 1000,
}

export const useVolumeProfile = (options: UseVolumeProfileOptions) => {
  const { symbol, timeRange, rowCount, enableRealTime, valueAreaPercentage, candleData, viewportState, chartWidth, chartHeight, rangeMode, fixedCandleCount } = options
  
  const [state, setState] = useState<VolumeProfileState>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdate: 0,
  })

  // CRITICAL PERFORMANCE FIX: Separate data loading from display settings
  const dataKey = `${symbol}-${timeRange}-${candleData.length}-${rangeMode}-${fixedCandleCount || 'auto'}-${viewportState.timeOffset}-${viewportState.timeZoom}-${chartWidth}` // Include viewport and range settings for dynamic updates
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
    rowCount: number,
    viewportState: ViewportState,
    chartWidth: number,
    chartHeight: number,
    rangeMode: 'visible' | 'fixed',
    fixedCandleCount?: number
  ): VolumeProfileData | null => {
    try {
      if (!candles || candles.length === 0) {
        console.warn('No candle data provided for volume profile')
        return null
      }

      let selectedCandles: CandleData[]

      if (rangeMode === 'visible') {
        // VISIBLE MODE: Use EXACT same calculation as MainChart for visible candles
        const spacing = 12 * viewportState.timeZoom
        const candleWidth = 8 * viewportState.timeZoom
        
        // Filter to only candles that are actually visible on screen (same as MainChart)
        selectedCandles = candles.filter((candle, index) => {
          const x = index * spacing + 50 - viewportState.timeOffset
          // Use same visibility check as MainChart: x >= -candleWidth && x <= chartWidth
          return x >= -candleWidth && x <= chartWidth
        })
        
        console.log(`📊 Processing ${selectedCandles.length} VISIBLE candles (matching MainChart logic) for dynamic volume profile`)
      } else {
        // FIXED MODE: Use the most recent N candles
        const candleCount = fixedCandleCount || 1000
        selectedCandles = candles.slice(-candleCount) // Take the last N candles
        
        console.log(`📊 Processing ${selectedCandles.length} FIXED candles (last ${candleCount}) for volume profile`)
      }
      
      if (selectedCandles.length === 0) {
        console.warn(`No ${rangeMode} candles found for volume profile`)
        return null
      }

      // CRITICAL FIX: Find EXACT price range from selected candles with NO padding
      let minPrice = Infinity
      let maxPrice = -Infinity

      selectedCandles.forEach(candle => {
        minPrice = Math.min(minPrice, candle.low)
        maxPrice = Math.max(maxPrice, candle.high)
      })

      if (minPrice === Infinity || maxPrice === -Infinity) {
        console.warn('Invalid price range from selected candle data')
        return null
      }

      const actualPriceRange = maxPrice - minPrice
      console.log(`💹 EXACT price range: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} (${selectedCandles.length} ${rangeMode} candles)`)

      // FIXED: Use proper price levels that cover the full range with specified row count
      // This ensures we have volume bars at every price level without gaps
      const priceStep = actualPriceRange / rowCount // Divide range into exact row count
      const priceLevels = new Map<number, VolumeProfileLevel>()
      
      // Helper function to get the correct price bucket for any price
      const getPriceBucket = (price: number): number => {
        const bucketIndex = Math.floor((price - minPrice) / priceStep)
        const clampedIndex = Math.max(0, Math.min(rowCount - 1, bucketIndex))
        return minPrice + (clampedIndex * priceStep)
      }

      // Initialize all price levels to ensure no gaps
      for (let i = 0; i < rowCount; i++) {
        const levelPrice = minPrice + (i * priceStep)
        priceLevels.set(levelPrice, {
          price: levelPrice,
          totalVolume: 0,
          buyVolume: 0,
          sellVolume: 0,
          delta: 0,
          isPOC: false,
          isValueArea: false,
        })
      }

      // Process each selected candle and distribute volume across price levels
      let totalVolume = 0
      let totalDelta = 0

      selectedCandles.forEach(candle => {
        const candleRange = candle.high - candle.low
        
        // Estimate buy/sell volume based on candle characteristics
        const isBullish = candle.close > candle.open
        const bodySize = Math.abs(candle.close - candle.open)
        
        // More sophisticated buy/sell estimation
        const buyRatio = isBullish ? 
          0.6 + (bodySize / Math.max(candleRange, 0.01)) * 0.3 : // Bullish: 60-90% buy
          0.3 - (bodySize / Math.max(candleRange, 0.01)) * 0.2   // Bearish: 10-30% buy
        
        const buyVolume = candle.volume * buyRatio
        const sellVolume = candle.volume * (1 - buyRatio)
        const delta = buyVolume - sellVolume

        totalVolume += candle.volume
        totalDelta += delta

        if (candleRange <= 0) {
          // For doji candles, assign all volume to the close price level
          const bucketPrice = getPriceBucket(candle.close)
          const level = priceLevels.get(bucketPrice)!
          
          level.totalVolume += candle.volume
          level.buyVolume += buyVolume
          level.sellVolume += sellVolume
          level.delta += delta
        } else {
          // For normal candles, distribute volume across the price range
          // Use more granular distribution to capture all traded levels
          const numSteps = Math.max(10, Math.ceil(candleRange / priceStep)) // At least 10 steps
          const volumePerStep = candle.volume / numSteps
          const buyVolumePerStep = buyVolume / numSteps
          const sellVolumePerStep = sellVolume / numSteps
          const deltaPerStep = delta / numSteps

          for (let i = 0; i < numSteps; i++) {
            const stepPrice = candle.low + (i / numSteps) * candleRange
            const bucketPrice = getPriceBucket(stepPrice)
            const level = priceLevels.get(bucketPrice)!
            
            level.totalVolume += volumePerStep
            level.buyVolume += buyVolumePerStep
            level.sellVolume += sellVolumePerStep
            level.delta += deltaPerStep
          }
        }
      })

      // Convert to array and filter out levels with very small volumes
      const minVolumeThreshold = totalVolume * 0.001 // 0.1% of total volume minimum
      const levels = Array.from(priceLevels.values())
        .filter(level => level.totalVolume >= minVolumeThreshold)
        .sort((a, b) => a.price - b.price)

      if (levels.length === 0) {
        console.warn('No significant volume levels found in selected candles')
        return null
      }

      // Find POC (Point of Control) - highest volume level
      let pocLevel = levels[0]
      levels.forEach(level => {
        if (level.totalVolume > pocLevel.totalVolume) {
          pocLevel = level
        }
      })
      pocLevel.isPOC = true

      // Calculate Value Area (70% of volume around POC)
      const sortedByVolume = [...levels].sort((a, b) => b.totalVolume - a.totalVolume)
      let valueAreaVolume = 0
      const targetValueAreaVolume = totalVolume * (valueAreaPercentage / 100)
      
      for (const level of sortedByVolume) {
        if (valueAreaVolume < targetValueAreaVolume) {
          level.isValueArea = true
          valueAreaVolume += level.totalVolume
        }
      }

      // Find VAH and VAL from levels with volume
      const valueAreaLevels = levels.filter(l => l.isValueArea)
      const vah = valueAreaLevels.length > 0 ? Math.max(...valueAreaLevels.map(l => l.price)) : maxPrice
      const val = valueAreaLevels.length > 0 ? Math.min(...valueAreaLevels.map(l => l.price)) : minPrice

      // SINGLE PRINTS DETECTION: Find price ranges with no trading volume
      const singlePrints: SinglePrint[] = []
      
      // Sort levels by price for gap detection
      const sortedLevels = [...levels].sort((a, b) => a.price - b.price)
      
      // Find gaps between consecutive volume levels
      for (let i = 0; i < sortedLevels.length - 1; i++) {
        const currentLevel = sortedLevels[i]
        const nextLevel = sortedLevels[i + 1]
        
        // Calculate the gap between consecutive levels
        const gapStart = currentLevel.price + priceStep
        const gapEnd = nextLevel.price - priceStep
        
        // Only consider significant gaps (more than 2 price steps)
        if (gapEnd > gapStart && (gapEnd - gapStart) > priceStep * 2) {
          singlePrints.push({
            priceStart: gapStart,
            priceEnd: gapEnd,
            isGap: true
          })
        }
      }
      
      // Also check for gaps at the beginning and end of the price range
      if (sortedLevels.length > 0) {
        // Gap at the bottom (below lowest volume level)
        const lowestLevel = sortedLevels[0]
        if (lowestLevel.price > minPrice + priceStep * 2) {
          singlePrints.push({
            priceStart: minPrice,
            priceEnd: lowestLevel.price - priceStep,
            isGap: true
          })
        }
        
        // Gap at the top (above highest volume level)
        const highestLevel = sortedLevels[sortedLevels.length - 1]
        if (highestLevel.price < maxPrice - priceStep * 2) {
          singlePrints.push({
            priceStart: highestLevel.price + priceStep,
            priceEnd: maxPrice,
            isGap: true
          })
        }
      }

      console.log(`✅ Accurate volume profile: ${levels.length} price levels (${rowCount} buckets), ${singlePrints.length} single prints, POC: ${pocLevel.price.toFixed(2)}, Total: ${totalVolume.toFixed(0)}`)
      
      // DEBUG: Log sample of price levels for troubleshooting
      if (levels.length > 0) {
        const sampleLevels = levels.slice(0, 10).map(l => `${l.price.toFixed(1)}:${l.totalVolume.toFixed(0)}`).join(', ')
        console.log(`📊 Sample price levels: ${sampleLevels}${levels.length > 10 ? '...' : ''}`)
        console.log(`📊 Price range: ${minPrice.toFixed(1)} - ${maxPrice.toFixed(1)} (step: ${priceStep.toFixed(2)}, ${levels.length}/${rowCount} levels)`)
      }

      return {
        levels, // All levels with significant volume
        poc: pocLevel.price,
        vah,
        val,
        totalVolume,
        totalDelta,
        priceRange: { min: minPrice, max: maxPrice },
        rawCandles: selectedCandles,
        singlePrints // Areas with no trading volume
      }
    } catch (error) {
      console.error('Error processing selected candle data:', error)
      return null
    }
  }, [valueAreaPercentage])

  // PERFORMANCE: Separate calculation function for instant recalculation
  const calculateVolumeProfile = useCallback((
    candles: CandleData[],
    rowCount: number,
    valueAreaPercentage: number
  ): VolumeProfileData | null => {
    return processHistoricalData(candles, rowCount, viewportState, chartWidth, chartHeight, rangeMode, fixedCandleCount)
  }, [processHistoricalData, viewportState, chartWidth, chartHeight, rangeMode, fixedCandleCount])

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

      console.log(`🔄 Loading DYNAMIC volume profile for ${symbol} with ${candleData.length} candles (viewport: ${viewportState.timeOffset.toFixed(0)}, zoom: ${viewportState.timeZoom.toFixed(2)})`)
      
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        const volumeProfileData = processHistoricalData(
          candleData,
          rowCount,
          viewportState,
          chartWidth,
          chartHeight,
          rangeMode,
          fixedCandleCount
        )

        if (volumeProfileData) {
          setState({
            data: volumeProfileData,
            isLoading: false,
            error: null,
            lastUpdate: Date.now(),
          })
          console.log('✅ Dynamic volume profile loaded successfully')
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'No volume profile data generated'
          }))
        }
      } catch (error) {
        console.error('Error processing historical data:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }

    loadHistoricalData()
  }, [dataKey, processHistoricalData, symbol, candleData, rowCount, viewportState, chartWidth, chartHeight, rangeMode, fixedCandleCount]) // Include all dynamic dependencies

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
      singlePrints: data?.singlePrints || [], // Single print areas
      
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