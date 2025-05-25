/**
 * React Hook for WebSocket Price Subscriptions
 * Provides real-time price updates with automatic subscription management
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingWebSocket, type PriceUpdate } from '../../lib/websocket'

interface UseWebSocketPriceOptions {
  symbol: string
  enabled?: boolean
}

interface WebSocketPriceState {
  price: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
  timestamp: number | null
  isConnected: boolean
  lastUpdate: number
}

export const useWebSocketPrice = (options: UseWebSocketPriceOptions) => {
  const { symbol, enabled = true } = options
  
  const [state, setState] = useState<WebSocketPriceState>({
    price: null,
    change: null,
    changePercent: null,
    volume: null,
    timestamp: null,
    isConnected: false,
    lastUpdate: 0,
  })

  // Track subscription cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const connectionUnsubscribeRef = useRef<(() => void) | null>(null)

  // Handle price updates
  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setState(prev => ({
      ...prev,
      price: update.price,
      change: update.change,
      changePercent: update.changePercent,
      volume: update.volume,
      timestamp: update.timestamp,
      lastUpdate: Date.now(),
    }))
  }, [])

  // Handle connection status changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    setState(prev => ({
      ...prev,
      isConnected: connected,
    }))
  }, [])

  // Subscribe to symbol and connection status
  useEffect(() => {
    // Skip during SSR
    if (typeof window === 'undefined') return
    
    if (!enabled || !symbol) return

    // Subscribe to connection status
    connectionUnsubscribeRef.current = tradingWebSocket.onConnectionChange(handleConnectionChange)

    // Subscribe to price updates
    unsubscribeRef.current = tradingWebSocket.subscribe(symbol, handlePriceUpdate)

    // Initial connection status
    setState(prev => ({
      ...prev,
      isConnected: tradingWebSocket.getConnectionStatus(),
    }))

    return () => {
      // Cleanup subscriptions
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (connectionUnsubscribeRef.current) {
        connectionUnsubscribeRef.current()
        connectionUnsubscribeRef.current = null
      }
    }
  }, [symbol, enabled, handlePriceUpdate, handleConnectionChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (connectionUnsubscribeRef.current) {
        connectionUnsubscribeRef.current()
      }
    }
  }, [])

  return {
    // Current price data
    price: state.price,
    change: state.change,
    changePercent: state.changePercent,
    volume: state.volume,
    timestamp: state.timestamp,
    
    // Connection status
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    
    // Computed values
    isStale: state.lastUpdate > 0 && (Date.now() - state.lastUpdate) > 10000, // 10 seconds
    isPriceUp: state.change !== null && state.change > 0,
    isPriceDown: state.change !== null && state.change < 0,
    
    // Formatted values
    formattedPrice: state.price !== null ? state.price.toFixed(2) : null,
    formattedChange: state.change !== null ? state.change.toFixed(2) : null,
    formattedChangePercent: state.changePercent !== null ? `${state.changePercent > 0 ? '+' : ''}${state.changePercent.toFixed(2)}%` : null,
  }
} 