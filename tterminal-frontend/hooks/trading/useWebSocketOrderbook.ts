/**
 * WebSocket Orderbook Hook - Real-time order book data management
 * Connects to tterminal-backend WebSocket for live depth updates
 * Maintains sorted bid/ask arrays with automatic updates
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { tradingWebSocket, type DepthUpdate, type MessageCallback } from '../../lib/websocket'
import type { OrderbookEntry, OrderbookData } from '../../types/trading'

interface UseWebSocketOrderbookOptions {
  symbol: string
  enabled?: boolean
  maxLevels?: number // Maximum number of price levels to maintain
}

interface WebSocketOrderbookState {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  lastUpdate: number
  isConnected: boolean
  spread: number
  midPrice: number
}

export const useWebSocketOrderbook = (options: UseWebSocketOrderbookOptions) => {
  const { symbol, enabled = true, maxLevels = 100 } = options
  
  const [state, setState] = useState<WebSocketOrderbookState>({
    bids: [],
    asks: [],
    lastUpdate: 0,
    isConnected: false,
    spread: 0,
    midPrice: 0,
  })

  // Refs for maintaining orderbook state
  const bidsMapRef = useRef<Map<number, number>>(new Map()) // price -> size
  const asksMapRef = useRef<Map<number, number>>(new Map()) // price -> size
  const lastUpdateRef = useRef<number>(0)

  // Convert price level arrays to sorted OrderbookEntry arrays
  const convertToOrderbookEntries = useCallback((
    priceMap: Map<number, number>,
    type: 'bids' | 'asks'
  ): OrderbookEntry[] => {
    const entries: OrderbookEntry[] = []
    let runningTotal = 0

    // Convert map to array and sort
    const sortedEntries = Array.from(priceMap.entries())
      .filter(([_, size]) => size > 0) // Remove zero-size entries
      .sort(([priceA], [priceB]) => {
        // Bids: highest price first, Asks: lowest price first
        return type === 'bids' ? priceB - priceA : priceA - priceB
      })
      .slice(0, maxLevels) // Limit to maxLevels

    // Calculate running totals
    for (const [price, size] of sortedEntries) {
      runningTotal += size
      entries.push({
        price,
        size,
        total: runningTotal
      })
    }

    return entries
  }, [maxLevels])

  // Process depth update message
  const processDepthUpdate = useCallback((update: DepthUpdate) => {
    if (update.symbol !== symbol) return

    const now = Date.now()
    
    // Prevent processing old updates
    if (update.timestamp <= lastUpdateRef.current) return
    lastUpdateRef.current = update.timestamp

    // Update bids
    for (const [priceStr, sizeStr] of update.bids) {
      const price = parseFloat(priceStr)
      const size = parseFloat(sizeStr)
      
      if (size === 0) {
        // Remove price level
        bidsMapRef.current.delete(price)
      } else {
        // Update price level
        bidsMapRef.current.set(price, size)
      }
    }

    // Update asks
    for (const [priceStr, sizeStr] of update.asks) {
      const price = parseFloat(priceStr)
      const size = parseFloat(sizeStr)
      
      if (size === 0) {
        // Remove price level
        asksMapRef.current.delete(price)
      } else {
        // Update price level
        asksMapRef.current.set(price, size)
      }
    }

    // Convert to sorted arrays
    const newBids = convertToOrderbookEntries(bidsMapRef.current, 'bids')
    const newAsks = convertToOrderbookEntries(asksMapRef.current, 'asks')

    // Calculate spread and mid price
    const bestBid = newBids.length > 0 ? newBids[0].price : 0
    const bestAsk = newAsks.length > 0 ? newAsks[0].price : 0
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0
    const midPrice = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0

    setState(prev => ({
      ...prev,
      bids: newBids,
      asks: newAsks,
      lastUpdate: now,
      spread,
      midPrice,
    }))
  }, [symbol, convertToOrderbookEntries])

  // WebSocket message handler
  const messageHandler: MessageCallback = useCallback((message) => {
    if (message.type === 'depth_update') {
      processDepthUpdate(message as DepthUpdate)
    }
  }, [processDepthUpdate])

  // WebSocket subscription
  useEffect(() => {
    if (!enabled) return

    // Subscribe to WebSocket messages for this symbol
    const unsubscribe = tradingWebSocket.subscribe(symbol, messageHandler)

    // Listen for connection changes
    const unsubscribeConnection = tradingWebSocket.onConnectionChange((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }))
      
      if (!connected) {
        // Clear orderbook on disconnect
        bidsMapRef.current.clear()
        asksMapRef.current.clear()
        setState(prev => ({
          ...prev,
          bids: [],
          asks: [],
          spread: 0,
          midPrice: 0,
        }))
      }
    })

    return () => {
      unsubscribe()
      unsubscribeConnection()
    }
  }, [enabled, symbol, messageHandler])

  // Initialize with empty orderbook
  useEffect(() => {
    if (enabled) {
      setState(prev => ({
        ...prev,
        isConnected: tradingWebSocket.getConnectionStatus(),
      }))
    }
  }, [enabled])

  // Clear orderbook when symbol changes
  useEffect(() => {
    bidsMapRef.current.clear()
    asksMapRef.current.clear()
    setState({
      bids: [],
      asks: [],
      lastUpdate: 0,
      isConnected: tradingWebSocket.getConnectionStatus(),
      spread: 0,
      midPrice: 0,
    })
  }, [symbol])

  return {
    // Orderbook data
    bids: state.bids,
    asks: state.asks,
    
    // Market data
    spread: state.spread,
    midPrice: state.midPrice,
    
    // State
    lastUpdate: state.lastUpdate,
    isConnected: state.isConnected,
    
    // Utility functions
    getBestBid: () => state.bids.length > 0 ? state.bids[0] : null,
    getBestAsk: () => state.asks.length > 0 ? state.asks[0] : null,
    getTotalBidVolume: () => state.bids.reduce((sum, bid) => sum + bid.size, 0),
    getTotalAskVolume: () => state.asks.reduce((sum, ask) => sum + ask.size, 0),
    
    // Performance metrics
    updateCount: state.bids.length + state.asks.length,
    isStale: state.lastUpdate > 0 && (Date.now() - state.lastUpdate) > 5000, // 5 seconds
  }
} 