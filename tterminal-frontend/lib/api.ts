/**
 * Ultra-Fast Trading Terminal API Service
 * Optimized for maximum performance and minimal latency
 * Features: Request batching, caching, parallel requests, error handling
 */

import type { CandleData, VolumeProfileEntry, HeatmapData, OrderbookData } from '../types/trading'

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
const CACHE_DURATION = 5000 // 5 seconds cache for ultra-fast updates
const REQUEST_TIMEOUT = 3000 // 3 seconds timeout for performance

// Response types matching backend API
interface BackendCandleResponse {
  s: string // symbol
  i: string // interval
  d: Array<{
    t: number // timestamp
    o: number // open
    h: number // high
    l: number // low
    c: number // close
    v: number // volume
    bv: number // buy volume
    sv: number // sell volume
  }>
  n: number // count
  f: number // first timestamp
  l: number // last timestamp
}

interface BackendVolumeProfileResponse {
  s: string
  st: number
  et: number
  l: Array<{
    p: number // price
    v: number // volume
    pct: number // percentage
  }>
  poc: number
  vah: number
  val: number
  vav: number
}

interface BackendHeatmapResponse {
  s: string
  st: number
  et: number
  l: Array<{
    p: number // price
    t: number // time
    v: number // volume
    i: number // intensity
  }>
  max: number
}

interface BackendLiquidationResponse {
  symbol: string
  timeRange: number
  liquidations: Array<{
    t: number
    p: number
    v: number
    side?: string
    type?: string
    conf?: number
  }>
  count: number
}

interface BackendMultiResponse {
  symbol: string
  candles: Record<string, BackendCandleResponse>
  volume_profile?: BackendVolumeProfileResponse
  liquidations?: BackendLiquidationResponse['liquidations']
}

// Performance optimized HTTP client
class FastHTTPClient {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private requestQueue = new Map<string, Promise<any>>()

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private getCacheKey(url: string, options?: RequestInit): string {
    return `${url}:${JSON.stringify(options?.body || '')}`
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_DURATION
  }

  async get<T>(endpoint: string, useCache = true): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const cacheKey = this.getCacheKey(url)

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.data
      }
    }

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey)!
    }

    // Create new request
    const requestPromise = this.fetchWithTimeout(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        
        // Cache successful response
        if (useCache) {
          this.cache.set(cacheKey, { data, timestamp: Date.now() })
        }
        
        return data
      })
      .finally(() => {
        this.requestQueue.delete(cacheKey)
      })

    this.requestQueue.set(cacheKey, requestPromise)
    return requestPromise
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Clear cache when needed
  clearCache(): void {
    this.cache.clear()
  }

  // Clear cache for specific symbol and interval combination
  clearCacheForSymbol(symbol: string, interval?: string): void {
    const keysToDelete: string[] = []
    for (const [key] of this.cache.entries()) {
      // More precise interval matching to avoid false positives
      const symbolMatch = key.includes(symbol)
      let intervalMatch = true
      
      if (interval) {
        // Exact interval matching in URL path to avoid "1m" matching "15m"
        intervalMatch = key.includes(`/${symbol}/${interval}?`) || key.includes(`/${symbol}/${interval}`)
      }
      
      if (symbolMatch && intervalMatch) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleared ${keysToDelete.length} cache entries for ${symbol}${interval ? `/${interval}` : ''}`)
    }
  }

  // Clear old cache entries
  cleanCache(): void {
    const now = Date.now()
    for (const [key, { timestamp }] of this.cache.entries()) {
      if (!this.isCacheValid(timestamp)) {
        this.cache.delete(key)
      }
    }
  }
}

// Global HTTP client instance
const httpClient = new FastHTTPClient()

// Clean cache periodically
setInterval(() => httpClient.cleanCache(), 30000) // Every 30 seconds

/**
 * Trading Terminal API Service Class
 * Provides all trading data with ultra-fast performance
 */
export class TradingAPI {
  // Health check
  static async getHealth(): Promise<{ status: string; database: string }> {
    return httpClient.get('/health', false) // No cache for health checks
  }

  // Get available symbols
  static async getSymbols(): Promise<{ symbols: string[]; count: number }> {
    return httpClient.get('/symbols')
  }

  // Get candle data with real buy/sell volume from backend
  static async getCandles(
    symbol: string,
    interval: string,
    limit: number = 500
  ): Promise<CandleData[]> {
    try {
      // Use the aggregation endpoint that provides real buy/sell volume data
      const response: BackendCandleResponse = await httpClient.get(
        `/aggregation/candles/${symbol}/${interval}?limit=${limit}`
      )

      return response.d.map(candle => ({
        timestamp: candle.t,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        volume: candle.v,
        buyVolume: candle.bv,   // Real buy volume from backend
        sellVolume: candle.sv,  // Real sell volume from backend
      }))
    } catch (error) {
      console.error('Failed to fetch candles:', error)
      throw error
    }
  }

  // Get latest candle for real-time updates
  static async getLatestCandle(
    symbol: string,
    interval: string = '1m'
  ): Promise<CandleData | null> {
    try {
      // Add timestamp to prevent any caching and ensure fresh data
      const timestamp = Date.now()
      const response: { candle: { t: number, o: number, h: number, l: number, c: number, v: number, bv: number, sv: number }, interval: string, symbol: string } = await httpClient.get(
        `/candles/${symbol}/latest?interval=${interval}&_t=${timestamp}`,
        false // No cache for latest data
      )

      if (response.candle) {
        const candle = response.candle
        return {
          timestamp: candle.t,
          open: candle.o,
          high: candle.h,
          low: candle.l,
          close: candle.c,
          volume: candle.v,
          buyVolume: candle.bv || 0,   // Real buy volume from backend
          sellVolume: candle.sv || 0,  // Real sell volume from backend
        }
      }
      return null
    } catch (error) {
      console.warn('Failed to fetch latest candle:', error)
      return null
    }
  }

  // Get volume profile data
  static async getVolumeProfile(
    symbol: string,
    hours: number = 24
  ): Promise<VolumeProfileEntry[]> {
    try {
      const response: BackendVolumeProfileResponse = await httpClient.get(
        `/aggregation/volume-profile/${symbol}?hours=${hours}`
      )

      return response.l.map(level => ({
        price: level.p,
        volume: level.v,
        buyVolume: level.v * 0.5,    // TODO: Backend should provide real buy/sell breakdown
        sellVolume: level.v * 0.5,   // TODO: Backend should provide real buy/sell breakdown
        delta: 0,                    // TODO: Backend should provide real delta
        trades: Math.floor(level.v / 10) + 1, // Estimate trade count
        type: 'neutral' as 'buy' | 'sell' | 'neutral',
      }))
    } catch (error) {
      console.warn('Failed to fetch volume profile:', error)
      return []
    }
  }

  // Get heatmap data
  static async getHeatmap(
    symbol: string,
    hours: number = 6,
    resolution: number = 100
  ): Promise<HeatmapData[]> {
    try {
      const response: BackendHeatmapResponse = await httpClient.get(
        `/aggregation/heatmap/${symbol}?hours=${hours}&resolution=${resolution}`
      )

      return response.l.map(cell => ({
        x: Math.floor(cell.t / 60000), // Convert timestamp to minute index
        y: Math.floor(cell.p), // Price level
        intensity: cell.i,
      }))
    } catch (error) {
      console.warn('Failed to fetch heatmap:', error)
      return []
    }
  }

  // Get liquidation data
  static async getLiquidations(
    symbol: string,
    hours: number = 1
  ): Promise<Array<{ timestamp: number; price: number; volume: number; side?: string }>> {
    try {
      const response: BackendLiquidationResponse = await httpClient.get(
        `/aggregation/liquidations/${symbol}?hours=${hours}`
      )

      return response.liquidations.map(liq => ({
        timestamp: liq.t,
        price: liq.p,
        volume: liq.v,
        side: liq.side,
      }))
    } catch (error) {
      console.warn('Failed to fetch liquidations:', error)
      return []
    }
  }

  // Ultra-fast multi-request for dashboard loading
  static async getMultiData(
    symbol: string,
    intervals: string[] = ['1m', '5m', '15m', '1h'],
    limit: number = 500,
    includeVolumeProfile: boolean = true,
    includeLiquidations: boolean = true
  ): Promise<{
    candles: Record<string, CandleData[]>
    volumeProfile?: VolumeProfileEntry[]
    liquidations?: Array<{ timestamp: number; price: number; volume: number; side?: string }>
  }> {
    try {
      const response: BackendMultiResponse = await httpClient.post('/aggregation/multi', {
        symbol,
        intervals,
        limit,
        include_volume_profile: includeVolumeProfile,
        include_liquidations: includeLiquidations,
        vp_hours: 24,
        liq_hours: 1,
      })

      const result: any = {
        candles: {},
      }

      // Convert candles for each interval
      for (const [interval, candleResponse] of Object.entries(response.candles)) {
        const candleData = (candleResponse as BackendCandleResponse).d || [] // Extract the 'd' array from CandleResponse
        result.candles[interval] = candleData.map((candle: any) => ({
          timestamp: candle.t,
          open: candle.o,
          high: candle.h,
          low: candle.l,
          close: candle.c,
          volume: candle.v,
          buyVolume: candle.bv || 0,   // Real buy volume from backend
          sellVolume: candle.sv || 0,  // Real sell volume from backend
        }))
      }

      // Convert volume profile
      if (response.volume_profile) {
        result.volumeProfile = response.volume_profile.l.map(level => ({
          price: level.p,
          volume: level.v,
          buyVolume: level.v * 0.5,    // TODO: Backend should provide real buy/sell breakdown
          sellVolume: level.v * 0.5,   // TODO: Backend should provide real buy/sell breakdown
          delta: 0,                    // TODO: Backend should provide real delta
          trades: Math.floor(level.v / 10) + 1, // Estimate trade count
          type: 'neutral' as 'buy' | 'sell' | 'neutral',
        }))
      }

      // Convert liquidations
      if (response.liquidations) {
        result.liquidations = response.liquidations.map(liq => ({
          timestamp: liq.t,
          price: liq.p,
          volume: liq.v,
          side: liq.side,
        }))
      }

      const totalCandles = Object.values(result.candles).reduce((sum: number, candles: any) => sum + candles.length, 0)
      console.log(`Multi-data loaded: ${totalCandles} candles across ${Object.keys(result.candles).length} intervals`)

      return result
    } catch (error) {
      console.error('Failed to fetch multi data:', error)
      throw error
    }
  }

  // Real-time price updates (for WebSocket fallback)
  static async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const candle = await this.getLatestCandle(symbol)
      return candle?.close || 0
    } catch (error) {
      console.warn('Failed to fetch current price:', error)
      return 0
    }
  }

  // Generate orderbook data (mock for now, will be replaced with real WebSocket data)
  static async getOrderbook(symbol: string): Promise<OrderbookData> {
    // This will be replaced with real WebSocket orderbook data
    const currentPrice = await this.getCurrentPrice(symbol)
    
    const asks = []
    const bids = []
    let total = 0

    // Generate mock asks (above current price)
    for (let i = 0; i < 100; i++) {
      const price = currentPrice + (i + 1) * 0.1
      const size = Math.random() * 5 + 0.001
      total += size
      asks.push({ 
        price: Math.round(price * 10) / 10, 
        size: Math.round(size * 1000) / 1000, 
        total: Math.round(total * 1000) / 1000 
      })
    }

    total = 0
    // Generate mock bids (below current price)
    for (let i = 0; i < 100; i++) {
      const price = currentPrice - (i + 1) * 0.1
      const size = Math.random() * 5 + 0.001
      total += size
      bids.push({ 
        price: Math.round(price * 10) / 10, 
        size: Math.round(size * 1000) / 1000, 
        total: Math.round(total * 1000) / 1000 
      })
    }

    return { asks, bids }
  }

  // Performance stats
  static async getPerformanceStats(): Promise<any> {
    return httpClient.get('/aggregation/stats', false)
  }

  // Clear API cache
  static clearCache(): void {
    httpClient.clearCache()
  }

  // Clear cache for specific symbol/interval (useful for debugging timeframe issues)
  static clearCacheForSymbol(symbol: string, interval?: string): void {
    httpClient.clearCacheForSymbol(symbol, interval)
  }

  // Force fresh data for specific interval (bypasses cache)
  static async getFreshCandles(
    symbol: string,
    interval: string = '1m',
    limit: number = 500
  ): Promise<CandleData[]> {
    // Clear cache for this specific request first
    httpClient.clearCacheForSymbol(symbol, interval)
    
    // Fetch without cache
    const response = await httpClient.get<BackendCandleResponse>(
      `/aggregation/candles/${symbol}/${interval}?limit=${limit}`,
      false // No cache
    )

    const candles = response.d.map(candle => ({
      timestamp: candle.t,
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      volume: candle.v,
      buyVolume: candle.bv || 0,   // Real buy volume from backend
      sellVolume: candle.sv || 0,  // Real sell volume from backend
    }))

    console.log(`Fresh data: ${candles.length} candles for ${symbol}/${interval}`)
    return candles
  }
}

// Export default for convenience
export default TradingAPI 