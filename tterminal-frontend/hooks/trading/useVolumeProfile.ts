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
  ViewportState
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
  const { symbol, timeRange, rowCount, enableRealTime, valueAreaPercentage, candleData, viewportState, chartWidth, chartHeight } = options
  
  const [state, setState] = useState<VolumeProfileState>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdate: 0,
  })

  // CRITICAL PERFORMANCE FIX: Separate data loading from display settings
  const dataKey = `${symbol}-${timeRange}-${candleData.length}-${viewportState.timeOffset}-${viewportState.timeZoom}-${chartWidth}` // Include viewport for dynamic updates
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
    chartHeight: number
  ): VolumeProfileData | null => {
    try {
      if (!candles || candles.length === 0) {
        console.warn('No candle data provided for volume profile')
        return null
      }

      // CRITICAL FIX: Filter to only visible candles in current viewport
      const spacing = 12 * viewportState.timeZoom
      const visibleStartIndex = Math.max(0, Math.floor(viewportState.timeOffset / spacing))
      const visibleEndIndex = Math.min(candles.length - 1, Math.floor((viewportState.timeOffset + chartWidth) / spacing))
      
      const visibleCandles = candles.slice(visibleStartIndex, visibleEndIndex + 1)
      
      if (visibleCandles.length === 0) {
        console.warn('No visible candles in current viewport')
        return null
      }

      console.log(`📊 Processing ${visibleCandles.length} VISIBLE candles (${visibleStartIndex}-${visibleEndIndex}) for dynamic volume profile`)

      // CRITICAL FIX: Find EXACT price range from visible candles with NO padding
      // We only want to show volume profile for prices that were actually traded
      let minPrice = Infinity
      let maxPrice = -Infinity

      visibleCandles.forEach(candle => {
        minPrice = Math.min(minPrice, candle.low)
        maxPrice = Math.max(maxPrice, candle.high)
      })

      if (minPrice === Infinity || maxPrice === -Infinity) {
        console.warn('Invalid price range from visible candle data')
        return null
      }

      // NO PADDING - only show volume where price was actually traded
      const actualPriceRange = maxPrice - minPrice
      
      console.log(`💹 EXACT price range: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} (${visibleCandles.length} visible candles)`)

      // CRITICAL FIX: Create price levels that map exactly to traded prices
      // Calculate optimal number of levels to prevent overlapping
      const minPriceStep = 0.1 // Minimum price step (adjust based on asset)
      const maxLevels = Math.floor(actualPriceRange / minPriceStep)
      const effectiveRowCount = Math.min(rowCount, maxLevels, chartHeight / 2) // Ensure no overlapping
      
      const priceStep = actualPriceRange / effectiveRowCount
      
      // Initialize volume profile levels - only for actual traded range
      const levels: VolumeProfileLevel[] = []
      for (let i = 0; i < effectiveRowCount; i++) {
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

      // Distribute volume from ONLY visible candles across price levels
      let totalVolume = 0
      let totalDelta = 0

      visibleCandles.forEach(candle => {
        const candleRange = candle.high - candle.low
        if (candleRange <= 0) {
          // For doji candles (no range), assign to closest price level
          const levelIndex = Math.floor((candle.close - minPrice) / priceStep)
          const clampedIndex = Math.max(0, Math.min(levels.length - 1, levelIndex))
          
          if (levels[clampedIndex]) {
            levels[clampedIndex].totalVolume += candle.volume
            
            // Simple buy/sell estimation for doji
            const isBullish = candle.close >= candle.open
            const buyVolume = candle.volume * (isBullish ? 0.6 : 0.4)
            const sellVolume = candle.volume - buyVolume
            
            levels[clampedIndex].buyVolume += buyVolume
            levels[clampedIndex].sellVolume += sellVolume
            levels[clampedIndex].delta += (buyVolume - sellVolume)
            
            totalVolume += candle.volume
            totalDelta += (buyVolume - sellVolume)
          }
          return
        }

        // Estimate buy/sell volume based on candle characteristics
        const isBullish = candle.close > candle.open
        const bodySize = Math.abs(candle.close - candle.open)
        const wickSize = candleRange - bodySize
        
        // More sophisticated buy/sell estimation
        const buyRatio = isBullish ? 
          0.6 + (bodySize / candleRange) * 0.3 : // Bullish: 60-90% buy
          0.3 - (bodySize / candleRange) * 0.2   // Bearish: 10-30% buy
        
        const buyVolume = candle.volume * buyRatio
        const sellVolume = candle.volume * (1 - buyRatio)
        const delta = buyVolume - sellVolume

        totalVolume += candle.volume
        totalDelta += delta

        // CRITICAL FIX: Map candle price range to exact price levels
        const startLevel = Math.floor((candle.low - minPrice) / priceStep)
        const endLevel = Math.floor((candle.high - minPrice) / priceStep)
        
        // Clamp to valid range
        const clampedStartLevel = Math.max(0, startLevel)
        const clampedEndLevel = Math.min(levels.length - 1, endLevel)

        const levelsInRange = Math.max(1, clampedEndLevel - clampedStartLevel + 1)
        const volumePerLevel = candle.volume / levelsInRange
        const buyVolumePerLevel = buyVolume / levelsInRange
        const sellVolumePerLevel = sellVolume / levelsInRange
        const deltaPerLevel = delta / levelsInRange

        // Distribute volume across the exact price levels this candle touched
        for (let i = clampedStartLevel; i <= clampedEndLevel; i++) {
          if (levels[i]) {
            levels[i].totalVolume += volumePerLevel
            levels[i].buyVolume += buyVolumePerLevel
            levels[i].sellVolume += sellVolumePerLevel
            levels[i].delta += deltaPerLevel
          }
        }
      })

      // Filter out levels with no volume - only show where trading actually occurred
      const levelsWithVolume = levels.filter(level => level.totalVolume > 0)
      
      if (levelsWithVolume.length === 0) {
        console.warn('No volume levels found in visible candles')
        return null
      }

      // Find POC (Point of Control) - highest volume level
      let pocLevel = levelsWithVolume[0]
      levelsWithVolume.forEach(level => {
        if (level.totalVolume > pocLevel.totalVolume) {
          pocLevel = level
        }
      })
      pocLevel.isPOC = true

      // Calculate Value Area (70% of volume around POC)
      const sortedByVolume = [...levelsWithVolume].sort((a, b) => b.totalVolume - a.totalVolume)
      let valueAreaVolume = 0
      const targetValueAreaVolume = totalVolume * (valueAreaPercentage / 100)
      
      for (const level of sortedByVolume) {
        if (valueAreaVolume < targetValueAreaVolume) {
          level.isValueArea = true
          valueAreaVolume += level.totalVolume
        }
      }

      // Find VAH and VAL from levels with volume
      const valueAreaLevels = levelsWithVolume.filter(l => l.isValueArea)
      const vah = valueAreaLevels.length > 0 ? Math.max(...valueAreaLevels.map(l => l.price)) : maxPrice
      const val = valueAreaLevels.length > 0 ? Math.min(...valueAreaLevels.map(l => l.price)) : minPrice

      console.log(`✅ Dynamic volume profile: ${levelsWithVolume.length} levels with volume, POC: ${pocLevel.price.toFixed(2)}, Total: ${totalVolume.toFixed(0)}`)

      return {
        levels: levelsWithVolume, // Only return levels that have actual volume
        poc: pocLevel.price,
        vah,
        val,
        totalVolume,
        totalDelta,
        priceRange: { min: minPrice, max: maxPrice },
        rawCandles: visibleCandles // Store only visible candles
      }
    } catch (error) {
      console.error('Error processing visible candle data:', error)
      return null
    }
  }, [valueAreaPercentage])

  // PERFORMANCE: Separate calculation function for instant recalculation
  const calculateVolumeProfile = useCallback((
    candles: CandleData[],
    rowCount: number,
    valueAreaPercentage: number
  ): VolumeProfileData | null => {
    return processHistoricalData(candles, rowCount, viewportState, chartWidth, chartHeight)
  }, [processHistoricalData, viewportState, chartWidth, chartHeight])

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
          chartHeight
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
  }, [dataKey, processHistoricalData, symbol, candleData, rowCount, viewportState, chartWidth, chartHeight]) // Include all dynamic dependencies

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