/**
 * React Hook for WebSocket Liquidation Data
 * Provides real-time liquidation updates with automatic subscription management
 * Optimized for ultra-fast trading terminal performance
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingWebSocket } from '@/lib/websocket'
import type { 
  LiquidationUpdate, 
  PriceUpdate, 
  DepthUpdate, 
  TradeUpdate, 
  KlineUpdate, 
  MarkPriceUpdate, 
  WebSocketMessage,
  MessageCallback 
} from '@/lib/websocket'

export interface LiquidationData {
  symbol: string
  side: string // 'BUY' or 'SELL'
  price: number
  quantity: number
  trade_time: number
  timestamp: number
  usdValue: number // USD value of the liquidation (quantity * price)
}

interface UseWebSocketLiquidationsOptions {
  symbol: string
  enabled?: boolean
  maxHistory?: number // Maximum number of liquidations to keep in memory
}

interface WebSocketLiquidationsState {
  liquidations: LiquidationData[]
  currentLiquidation: LiquidationData | null
  isConnected: boolean
  lastUpdate: number
  totalLiquidations: number
  totalUsdValue: number // Total USD value of all liquidations
}

export const useWebSocketLiquidations = (options: UseWebSocketLiquidationsOptions) => {
  const { symbol, enabled = true, maxHistory = 1000 } = options
  
  const [state, setState] = useState<WebSocketLiquidationsState>({
    liquidations: [],
    currentLiquidation: null,
    isConnected: false,
    lastUpdate: 0,
    totalLiquidations: 0,
    totalUsdValue: 0,
  })

  // Calculate liquidation intensity based on quantity and recent activity
  const calculateIntensity = useCallback((liquidation: LiquidationData, recentLiquidations: LiquidationData[]): number => {
    // Base intensity from quantity (normalized to 0-100 scale)
    const baseIntensity = Math.min(liquidation.quantity * 10, 100)
    
    // Boost intensity if there are multiple liquidations in quick succession
    const recentWindow = 5000 // 5 seconds
    const recentCount = recentLiquidations.filter(
      liq => liquidation.timestamp - liq.timestamp < recentWindow
    ).length
    
    const cascadeMultiplier = Math.min(1 + (recentCount * 0.2), 3) // Max 3x multiplier
    
    return Math.min(baseIntensity * cascadeMultiplier, 100)
  }, [])

  // Subscribe to real-time liquidation updates
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return
    
    if (!enabled || !symbol) return

    // Handle liquidation updates from WebSocket
    const handleLiquidationUpdate = (update: PriceUpdate | DepthUpdate | TradeUpdate | KlineUpdate | MarkPriceUpdate | LiquidationUpdate | WebSocketMessage) => {
      // ULTRA-FAST PROCESSING: Only process liquidation updates for our symbol
      if (update.type !== 'liquidation_update') return
      
      const liquidationUpdate = update as LiquidationUpdate
      if (liquidationUpdate.symbol !== symbol) return

      // PERFORMANCE: Create liquidation data object once
      const liquidationData: LiquidationData = {
        symbol: liquidationUpdate.symbol,
        side: liquidationUpdate.side,
        price: liquidationUpdate.price,
        quantity: liquidationUpdate.quantity,
        trade_time: liquidationUpdate.trade_time,
        timestamp: liquidationUpdate.timestamp,
        usdValue: liquidationUpdate.quantity * liquidationUpdate.price,
      }

      // ATOMIC STATE UPDATE: Single setState call for maximum performance
      setState(prev => {
        // SPEED: Add new liquidation to front of array
        const newLiquidations = [liquidationData, ...prev.liquidations].slice(0, maxHistory)
        
        return {
          ...prev,
          liquidations: newLiquidations,
          currentLiquidation: liquidationData,
          lastUpdate: Date.now(),
          totalLiquidations: newLiquidations.length,
          totalUsdValue: newLiquidations.reduce((total, liq) => total + liq.usdValue, 0),
        }
      })
    }

    // Subscribe to liquidation updates - CORRECTED: Use symbol parameter
    const unsubscribe = tradingWebSocket.subscribe(symbol, handleLiquidationUpdate)

    return () => {
      // CORRECTED: Use the returned unsubscribe function
      unsubscribe()
    }
  }, [symbol, enabled, maxHistory])

  // Handle connection status changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    setState(prev => ({
      ...prev,
      isConnected: connected,
    }))
  }, [])

  // Subscribe to connection status changes
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return
    
    if (!enabled || !symbol) return

    // Subscribe to connection status
    const connectionUnsubscribe = tradingWebSocket.onConnectionChange(handleConnectionChange)

    // Initial connection status
    setState(prev => ({
      ...prev,
      isConnected: tradingWebSocket.getConnectionStatus(),
    }))

    return () => {
      // Cleanup connection subscription
      if (connectionUnsubscribe) {
        connectionUnsubscribe()
      }
    }
  }, [symbol, enabled, handleConnectionChange])

  // Fetch initial historical liquidations from REST API
  useEffect(() => {
    if (!enabled || !symbol) return

    const fetchHistoricalLiquidations = async () => {
      try {
        // ULTRA-FAST PARALLEL FETCHING: Multiple endpoints simultaneously
        const endpoints = [
          // WebSocket cache endpoint (recent real-time data) - FASTEST & PRIMARY
          `http://localhost:8080/api/v1/websocket/liquidations/${symbol}?limit=2000`,
          // Aggregation endpoint (more historical data) - FALLBACK (currently returns empty)
          `http://localhost:8080/api/v1/aggregation/liquidations/${symbol}?hours=48`
        ]

        // PERFORMANCE: Parallel fetch with aggressive timeouts
        const fetchPromises = endpoints.map(async (endpoint, index) => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), index === 0 ? 1000 : 2000) // 1s for WS, 2s for aggregation
          
          try {
            const response = await fetch(endpoint, {
              signal: controller.signal
            })
            clearTimeout(timeoutId)
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            
            const data = await response.json()
            return { data, endpoint, success: true, index }
          } catch (error) {
            clearTimeout(timeoutId)
            console.warn(`LIQUIDATION FETCH FAILED: ${endpoint} - ${error}`)
            return { data: null, endpoint, success: false, error, index }
          }
        })

        // SPEED: Wait for ALL requests with Promise.allSettled (don't wait for slowest)
        const results = await Promise.allSettled(fetchPromises)
        let allLiquidations: LiquidationData[] = []
        let successCount = 0

        console.log(`LIQUIDATION FETCH RESULTS for ${symbol}:`, results.map(r => ({
          status: r.status,
          fulfilled: r.status === 'fulfilled' ? r.value : null
        })))

        // PERFORMANCE: Process results in order of speed (WebSocket first)
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            const { data, endpoint, index } = result.value
            successCount++
            
            console.log(`PROCESSING ENDPOINT ${index} (${endpoint}):`, {
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : [],
              liquidationsArray: data?.liquidations,
              liquidationsLength: data?.liquidations?.length || 0
            })
            
            if (data.liquidations && Array.isArray(data.liquidations) && data.liquidations.length > 0) {
              console.log(`RAW LIQUIDATIONS DATA:`, data.liquidations.slice(0, 2)) // Show first 2 items
              
              // CORRECTED: Add proper type annotation for liq parameter
              const liquidations: LiquidationData[] = data.liquidations.map((liq: any, liqIndex: number) => {
                console.log(`PROCESSING LIQUIDATION ${liqIndex}:`, liq)
                
                // ULTRA-FAST PROCESSING: Handle Binance WebSocket format correctly
                if (liq.o && liq.e === 'forceOrder') {
                  // WebSocket format (Binance raw format) - FASTEST PATH
                  const liquidationOrder = liq.o
                  const symbol_field = liquidationOrder.s || symbol
                  const side_field = liquidationOrder.S || 'UNKNOWN'
                  const price_field = parseFloat(liquidationOrder.ap || liquidationOrder.p || '0') // Use average price (ap) first
                  const quantity_field = parseFloat(liquidationOrder.q || '0')
                  
                  // CRITICAL FIX: Use trade time (T) as primary timestamp for accurate candle mapping
                  // Trade time is when the liquidation actually occurred, event time is when it was processed
                  const trade_time_field = liquidationOrder.T || liq.E || Date.now()
                  const timestamp_field = trade_time_field // Use trade time for candle mapping
                  
                  // PERFORMANCE: Pre-calculate USD value
                  const usdValue = quantity_field * price_field
                  
                  const processed = {
                    symbol: symbol_field,
                    side: side_field,
                    price: price_field,
                    quantity: quantity_field,
                    trade_time: trade_time_field,
                    timestamp: timestamp_field, // Now uses trade time for accurate historical placement
                    usdValue: usdValue,
                  }
                  
                  console.log(`PROCESSED WEBSOCKET LIQUIDATION:`, processed)
                  return processed
                } else if (liq.side || liq.price || liq.p) {
                  // Aggregation format (processed format) - FALLBACK PATH
                  const symbol_field = symbol
                  const side_field = liq.side || 'UNKNOWN'
                  const price_field = liq.p || liq.price || 0
                  const quantity_field = liq.v || liq.volume || liq.quantity || 0
                  const timestamp_field = liq.t || liq.timestamp || Date.now()
                  const trade_time_field = liq.trade_time || timestamp_field
                  
                  // PERFORMANCE: Pre-calculate USD value
                  const usdValue = quantity_field * price_field
                  
                  const processed = {
                    symbol: symbol_field,
                    side: side_field,
                    price: price_field,
                    quantity: quantity_field,
                    trade_time: trade_time_field,
                    timestamp: timestamp_field,
                    usdValue: usdValue,
                  }
                  
                  console.log(`PROCESSED AGGREGATION LIQUIDATION:`, processed)
                  return processed
                } else {
                  console.log(`INVALID LIQUIDATION FORMAT:`, liq)
                  // FALLBACK: Return null for invalid data
                  return null
                }
              }).filter((liq: LiquidationData | null): liq is LiquidationData => {
                const isValid = liq !== null && liq.price > 0 && liq.quantity > 0 && liq.usdValue > 0
                if (!isValid && liq) {
                  console.log(`FILTERED OUT INVALID LIQUIDATION:`, liq)
                }
                return isValid
              }) // FAST FILTER: Remove invalid liquidations

              console.log(`FINAL PROCESSED LIQUIDATIONS:`, liquidations)

              // PERFORMANCE: Prioritize WebSocket data (index 0)
              if (index === 0) {
                allLiquidations = [...liquidations, ...allLiquidations] // WebSocket data first
              } else {
                allLiquidations = [...allLiquidations, ...liquidations] // Append other sources
              }
            } else {
              console.log(`NO LIQUIDATIONS IN RESPONSE from ${endpoint}`)
            }
          } else {
            console.log(`FAILED RESULT:`, result)
          }
        }

        // ULTRA-FAST DEDUPLICATION: Use Map for O(n) performance
        const uniqueLiquidationsMap = new Map<string, LiquidationData>()
        
        for (const liq of allLiquidations) {
          // Create unique key based on timestamp, price, and quantity
          const key = `${liq.timestamp}-${liq.price.toFixed(2)}-${liq.quantity.toFixed(4)}`
          
          // Keep the first occurrence (WebSocket data has priority)
          if (!uniqueLiquidationsMap.has(key)) {
            uniqueLiquidationsMap.set(key, liq)
          }
        }

        // PERFORMANCE: Convert back to array and sort in single operation
        const sortedLiquidations = Array.from(uniqueLiquidationsMap.values())
          .sort((a, b) => b.timestamp - a.timestamp) // Newest first
          .slice(0, maxHistory) // Limit to maxHistory

        // ATOMIC STATE UPDATE: Single setState call for maximum performance
        setState(prev => ({
          ...prev,
          liquidations: sortedLiquidations,
          totalLiquidations: sortedLiquidations.length,
          totalUsdValue: sortedLiquidations.reduce((total, liq) => total + liq.usdValue, 0),
        }))

        // ESSENTIAL LOGGING: Only log final result
        if (sortedLiquidations.length > 0) {
          console.log(`LIQUIDATIONS LOADED: ${sortedLiquidations.length} liquidations for ${symbol}`)
        } else {
          console.warn(`NO LIQUIDATIONS: No liquidation data found for ${symbol}`)
        }

      } catch (error) {
        // ROBUST ERROR HANDLING: Don't crash the app
        console.error(`LIQUIDATION ERROR for ${symbol}:`, error)
        
        // Set error state but don't clear existing data
        setState(prev => ({
          ...prev,
          // Keep existing liquidations if any
          totalLiquidations: prev.liquidations.length,
          totalUsdValue: prev.liquidations.reduce((total, liq) => total + liq.usdValue, 0),
        }))
      }
    }

    // IMMEDIATE EXECUTION: No delays for maximum speed
    fetchHistoricalLiquidations()
    
    // PERFORMANCE: Refresh every 30 seconds (not too frequent to avoid spam)
    const refreshInterval = setInterval(fetchHistoricalLiquidations, 30000)
    
    return () => clearInterval(refreshInterval)
  }, [symbol, enabled, maxHistory]) // MINIMAL DEPENDENCIES: Only re-run when necessary

  // Get liquidations for a specific time range (for chart rendering)
  const getLiquidationsForTimeRange = useCallback((startTime: number, endTime: number): LiquidationData[] => {
    return state.liquidations.filter(
      liq => liq.timestamp >= startTime && liq.timestamp <= endTime
    )
  }, [state.liquidations])

  // Get liquidations by USD value threshold
  const getHighValueLiquidations = useCallback((threshold: number = 50000): LiquidationData[] => {
    return state.liquidations.filter(liq => (liq.usdValue || 0) >= threshold)
  }, [state.liquidations])

  return {
    // Current liquidation data
    liquidations: state.liquidations,
    currentLiquidation: state.currentLiquidation,
    
    // Connection status
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    
    // Statistics
    totalLiquidations: state.totalLiquidations,
    totalUsdValue: state.totalUsdValue,
    
    // Computed values
    isStale: state.lastUpdate > 0 && (Date.now() - state.lastUpdate) > 30000, // 30 seconds for liquidations
    hasRecentActivity: state.lastUpdate > 0 && (Date.now() - state.lastUpdate) < 5000, // 5 seconds
    
    // Helper functions
    getLiquidationsForTimeRange,
    getHighValueLiquidations,
    
    // Latest liquidation info
    latestSide: state.currentLiquidation?.side || null,
    latestPrice: state.currentLiquidation?.price || null,
    latestQuantity: state.currentLiquidation?.quantity || null,
    latestUsdValue: state.currentLiquidation?.usdValue || null,
  }
}