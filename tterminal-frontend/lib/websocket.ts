/**
 * WebSocket Service for Real-time Trading Data
 * Connects to tterminal-backend WebSocket for sub-100ms price updates
 * Supports automatic reconnection, subscription management, and fallback
 */

export interface PriceUpdate {
  type: 'price_update'
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
}

export interface DepthUpdate {
  type: 'depth_update'
  symbol: string
  bids: string[][] // [price, quantity]
  asks: string[][] // [price, quantity]
  timestamp: number
}

export interface TradeUpdate {
  type: 'trade_update'
  symbol: string
  price: number
  quantity: number
  is_buyer_maker: boolean
  trade_time: number
  timestamp: number
}

export interface KlineUpdate {
  type: 'kline_update'
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
  interval: string
  is_closed: boolean
}

export interface MarkPriceUpdate {
  type: 'mark_price_update'
  symbol: string
  mark_price: number
  index_price: number
  funding_rate: number
  next_funding_time: number
  timestamp: number
}

export interface WebSocketMessage {
  type: string
  symbol?: string
  message?: string
  clientId?: string
  timestamp?: number
  data?: any
}

export interface MessageCallback {
  (update: PriceUpdate | DepthUpdate | TradeUpdate | KlineUpdate | MarkPriceUpdate | WebSocketMessage): void
}

export interface ConnectionCallback {
  (connected: boolean): void
}

class TradingWebSocketService {
  private ws: WebSocket | null = null
  private isConnected = false
  private isConnecting = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000 // Start with 1 second
  private maxReconnectDelay = 30000 // Max 30 seconds
  private pingInterval: NodeJS.Timeout | null = null
  private reconnectTimeout: NodeJS.Timeout | null = null
  private lastPingTime = 0

  // Subscription management
  private subscriptions = new Map<string, Set<MessageCallback>>()
  private connectionCallbacks = new Set<ConnectionCallback>()
  private subscribedSymbols = new Set<string>()

  // WebSocket URL
  private readonly wsUrl: string

  constructor() {
    // Fix SSR issue - only access window on client side
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8080'
      this.wsUrl = `${protocol}//${host}/api/v1/websocket/connect`
    } else {
      // Server-side: use default ws protocol for localhost
      const host = process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8080'
      this.wsUrl = `ws://${host}/api/v1/websocket/connect`
    }
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Prevent connection during SSR
      if (typeof window === 'undefined') {
        console.log('WebSocket connection skipped during SSR')
        reject(new Error('WebSocket not available during SSR'))
        return
      }

      if (this.isConnected || this.isConnecting) {
        resolve()
        return
      }

      this.isConnecting = true
      console.log(`WebSocket connecting to: ${this.wsUrl}`)

      try {
        this.ws = new WebSocket(this.wsUrl)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.lastPingTime = Date.now()
          
          // Send ping immediately after connection
          this.sendPing()
          
          // Start ping interval
          this.startPingInterval()
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected')
          this.handleDisconnection()
          if (this.isConnecting) {
            reject(new Error(`WebSocket connection failed: ${event.reason}`))
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          reject(error)
        }

      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }

    this.isConnected = false
    this.isConnecting = false
    this.connectionCallbacks.forEach(callback => callback(false))
  }

  /**
   * Subscribe to price updates for a symbol
   */
  public subscribe(symbol: string, callback: MessageCallback): () => void {
    // Add callback to subscriptions
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, new Set())
    }
    this.subscriptions.get(symbol)!.add(callback)

    // Send subscription message if connected
    if (this.isConnected && !this.subscribedSymbols.has(symbol)) {
      this.sendSubscription(symbol)
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(symbol)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(symbol)
          this.unsubscribeFromSymbol(symbol)
        }
      }
    }
  }

  /**
   * Add connection status callback
   */
  public onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback)
    // Call immediately with current status
    callback(this.isConnected)

    return () => {
      this.connectionCallbacks.delete(callback)
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      // ENHANCED JSON PARSING: Handle multiple messages and malformed data
      // Clean and validate the incoming data
      const cleanData = data.trim()
      
      if (!cleanData) {
        console.warn('Received empty WebSocket message')
        return
      }

      // Log raw data in development for debugging
      if (process.env.NODE_ENV === 'development') {
        // console.log('📨 Raw WebSocket data:', cleanData.substring(0, 200) + (cleanData.length > 200 ? '...' : ''))
      }

      // Check if data contains multiple JSON objects (newline separated)
      if (cleanData.includes('\n')) {
        const messages = cleanData.split('\n').filter(msg => msg.trim())
        messages.forEach(msg => this.parseAndHandleSingleMessage(msg.trim()))
        return
      }

      // Handle single message
      this.parseAndHandleSingleMessage(cleanData)

    } catch (error) {
      console.error('Failed to process WebSocket message:', error)
      console.error('📄 Raw data that caused error:', data)
    }
  }

  /**
   * Parse and handle a single JSON message
   */
  private parseAndHandleSingleMessage(data: string): void {
    try {
      // Validate JSON format before parsing
      if (!data.startsWith('{') || !data.endsWith('}')) {
        console.warn('Invalid JSON format, skipping:', data.substring(0, 100))
        return
      }

      const message: WebSocketMessage = JSON.parse(data)

      // Validate message structure
      if (!message.type) {
        console.warn('Message missing type field:', message)
        return
      }

      switch (message.type) {
        case 'connected':
          // Silent connection confirmation
          break

        case 'price_update':
          this.handlePriceUpdate(message as PriceUpdate)
          break

        case 'depth_update':
          this.handleDepthUpdate(message as DepthUpdate)
          break

        case 'trade_update':
          this.handleTradeUpdate(message as TradeUpdate)
          break

        case 'kline_update':
          this.handleKlineUpdate(message as KlineUpdate)
          break

        case 'mark_price_update':
          this.handleMarkPriceUpdate(message as MarkPriceUpdate)
          break

        case 'subscribed':
          if (message.symbol) {
            this.subscribedSymbols.add(message.symbol)
          }
          break

        case 'unsubscribed':
          if (message.symbol) {
            this.subscribedSymbols.delete(message.symbol)
          }
          break

        case 'pong':
          // Heartbeat response - silent
          break

        case 'stats':
          // Silent stats handling
          break

        case 'error':
          console.error('WebSocket server error:', message.message)
          break

        default:
          // Log unknown message types for debugging (but only in development)
          if (process.env.NODE_ENV === 'development') {
            console.warn('Unknown message type:', message.type, 'Message:', message)
          } else {
            // In production, just log the type to avoid spam
            console.warn('Unknown message type:', message.type)
          }
      }
    } catch (error) {
      console.error('Failed to parse individual JSON message:', error)
      console.error('📄 Message data:', data)
      
      // Try to extract partial JSON if possible
      try {
        const firstBrace = data.indexOf('{')
        const lastBrace = data.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const extractedJson = data.substring(firstBrace, lastBrace + 1)
          console.log('Attempting to parse extracted JSON:', extractedJson)
          const partialMessage = JSON.parse(extractedJson)
          console.log('Successfully parsed partial message:', partialMessage)
        }
      } catch (extractError) {
        console.error('Could not extract valid JSON from message')
      }
    }
  }

  /**
   * Handle price updates
   */
  private handlePriceUpdate(update: PriceUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in price update callback:', error)
        }
      })
    }
  }

  /**
   * Handle depth updates
   */
  private handleDepthUpdate(update: DepthUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in depth update callback:', error)
        }
      })
    }
  }

  /**
   * Handle trade updates
   */
  private handleTradeUpdate(update: TradeUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in trade update callback:', error)
        }
      })
    }
  }

  /**
   * Handle kline updates
   */
  private handleKlineUpdate(update: KlineUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in kline update callback:', error)
        }
      })
    }
  }

  /**
   * Handle mark price updates
   */
  private handleMarkPriceUpdate(update: MarkPriceUpdate): void {
    const callbacks = this.subscriptions.get(update.symbol)
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in mark price update callback:', error)
        }
      })
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    this.isConnected = false
    this.isConnecting = false
    this.subscribedSymbols.clear()

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    // Notify connection callbacks
    this.connectionCallbacks.forEach(callback => callback(false))

    // Attempt reconnection
    this.scheduleReconnect()
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Giving up.')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay)

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Send subscription message
   */
  private sendSubscription(symbol: string): void {
    if (this.ws && this.isConnected) {
      const message = {
        type: 'subscribe',
        symbol: symbol
      }
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Send unsubscription message
   */
  private unsubscribeFromSymbol(symbol: string): void {
    if (this.ws && this.isConnected) {
      const message = {
        type: 'unsubscribe',
        symbol: symbol
      }
      this.ws.send(JSON.stringify(message))
      this.subscribedSymbols.delete(symbol)
    }
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((_, symbol) => {
      this.sendSubscription(symbol)
    })
  }

  /**
   * Start ping interval for connection health
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds
  }

  /**
   * Send ping immediately after connection
   */
  private sendPing(): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ type: 'ping' }))
    }
  }
}

// Singleton instance
export const tradingWebSocket = new TradingWebSocketService()

// Auto-connect when module loads
if (typeof window !== 'undefined') {
  tradingWebSocket.connect().catch(error => {
    console.error('Failed to auto-connect WebSocket:', error)
  })
} 