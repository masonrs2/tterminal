/**
 * React Hook for WebSocket Liquidation Data
 * Provides real-time liquidation updates with automatic subscription management
 * Optimized for ultra-fast trading terminal performance
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingWebSocket } from '../../lib/websocket'

export interface LiquidationData {
  symbol: string
  side: string // 'BUY' or 'SELL'
  price: number
  quantity: number
  trade_time: number
  timestamp: number
  usdValue: number // USD value of the liquidation (quantity * price)
}

export interface LiquidationUpdate {
  type: 'liquidation_update'
  symbol: string
  side: string
  price: number
  quantity: number
  trade_time: number
  timestamp: number
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

  // Handle real-time liquidation updates from WebSocket
  useEffect(() => {
    if (!enabled || !symbol) return

    const handleLiquidationUpdate = (update: LiquidationUpdate) => {
      if (update.symbol !== symbol) return

      // Calculate USD value of liquidation
      const usdValue = update.quantity * update.price

      const newLiquidation: LiquidationData = {
        symbol: update.symbol,
        side: update.side,
        price: update.price, // This is now the accurate average price from backend
        quantity: update.quantity,
        trade_time: update.trade_time,
        timestamp: update.timestamp,
        usdValue: usdValue,
      }

      setState(prev => {
        const updatedLiquidations = [...prev.liquidations, newLiquidation]
          .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
          .slice(0, maxHistory) // Keep only recent liquidations

        const highIntensityCount = updatedLiquidations.filter(liq => (liq.usdValue || 0) > 50000).length

        console.log(`🔥 Real-time liquidation: ${newLiquidation.side} ${newLiquidation.quantity} ${symbol} @ $${newLiquidation.price.toFixed(2)} = $${usdValue.toFixed(0)}`)

        return {
          ...prev,
          liquidations: updatedLiquidations,
          totalLiquidations: updatedLiquidations.length,
          totalUsdValue: prev.totalUsdValue + usdValue,
          lastUpdate: Date.now(),
        }
      })
    }

    // Subscribe to liquidation updates
    tradingWebSocket.subscribe(handleLiquidationUpdate)

    return () => {
      tradingWebSocket.unsubscribe(handleLiquidationUpdate)
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
        // Try multiple endpoints to get comprehensive historical data
        const endpoints = [
          // WebSocket cache endpoint (recent real-time data)
          `http://localhost:8080/api/v1/websocket/liquidations/${symbol}?limit=1000`,
          // Aggregation endpoint (more historical data)
          `http://localhost:8080/api/v1/aggregation/liquidations/${symbol}?hours=24`
        ]

        let allLiquidations: LiquidationData[] = []

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint)
            if (response.ok) {
              const data = await response.json()
              
              if (data.liquidations && Array.isArray(data.liquidations)) {
                const liquidations: LiquidationData[] = data.liquidations.map((liq: any) => {
                  // Handle different data structures from different endpoints
                  let symbol_field, side_field, price_field, quantity_field, timestamp_field, trade_time_field
                  
                  if (liq.o) {
                    // WebSocket format (Binance raw format)
                    const liquidationOrder = liq.o
                    symbol_field = liquidationOrder.s || symbol
                    side_field = liquidationOrder.S || 'UNKNOWN'
                    price_field = parseFloat(liquidationOrder.ap || liquidationOrder.p || '0')
                    quantity_field = parseFloat(liquidationOrder.q || '0')
                    timestamp_field = liq.E || Date.now()
                    trade_time_field = liquidationOrder.T || timestamp_field
                  } else {
                    // Aggregation format (processed format)
                    symbol_field = symbol
                    side_field = liq.side || 'UNKNOWN'
                    price_field = liq.p || liq.price || 0
                    quantity_field = liq.v || liq.volume || liq.quantity || 0
                    timestamp_field = liq.t || liq.timestamp || Date.now()
                    trade_time_field = liq.trade_time || timestamp_field
                  }
                  
                  // Calculate USD value
                  const usdValue = quantity_field * price_field
                  
                  return {
                    symbol: symbol_field,
                    side: side_field,
                    price: price_field,
                    quantity: quantity_field,
                    trade_time: trade_time_field,
                    timestamp: timestamp_field,
                    usdValue: usdValue,
                  }
                }).filter(liq => liq.price > 0 && liq.quantity > 0) // Filter out invalid liquidations

                allLiquidations = [...allLiquidations, ...liquidations]
              }
            }
          } catch (endpointError) {
            console.warn(`Failed to fetch from ${endpoint}:`, endpointError)
          }
        }

        // Remove duplicates based on timestamp and price
        const uniqueLiquidations = allLiquidations.filter((liq, index, arr) => 
          arr.findIndex(l => 
            Math.abs(l.timestamp - liq.timestamp) < 1000 && // Within 1 second
            Math.abs(l.price - liq.price) < 0.01 // Within 1 cent
          ) === index
        )

        // Sort by timestamp descending and limit to maxHistory
        const sortedLiquidations = uniqueLiquidations
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, maxHistory)

        setState(prev => ({
          ...prev,
          liquidations: sortedLiquidations,
          totalLiquidations: sortedLiquidations.length,
          totalUsdValue: sortedLiquidations.reduce((total, liq) => total + liq.usdValue, 0),
        }))

        console.log(`✅ Loaded ${sortedLiquidations.length} real liquidations for ${symbol} from ${endpoints.length} sources`)
        
        // Log sample liquidations for verification
        if (sortedLiquidations.length > 0) {
          const sample = sortedLiquidations[0]
          console.log(`📊 Latest liquidation: ${sample.side} ${sample.quantity} ${symbol} @ $${sample.price.toFixed(2)} = $${sample.usdValue.toFixed(0)}`)
          
          // Log side distribution
          const buyCount = sortedLiquidations.filter(l => l.side === 'BUY').length
          const sellCount = sortedLiquidations.filter(l => l.side === 'SELL').length
          console.log(`📊 Liquidation sides: ${buyCount} BUY (longs liquidated), ${sellCount} SELL (shorts liquidated)`)
        }
      } catch (error) {
        console.warn('Failed to fetch historical liquidations:', error)
      }
    }

    fetchHistoricalLiquidations()
  }, [symbol, enabled, maxHistory])

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