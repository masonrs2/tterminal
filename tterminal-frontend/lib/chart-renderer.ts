/**
 * High-Performance Canvas Chart Renderer
 * Optimized for real-time trading data with minimal redraws
 */

export interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBookData {
  bids: Array<{ price: number; size: number; total: number }>
  asks: Array<{ price: number; size: number; total: number }>
}

export interface VolumeProfileData {
  price: number
  volume: number
  type: 'buy' | 'sell'
}

export interface ChartConfig {
  backgroundColor: string
  bullColor: string
  bearColor: string
  gridColor: string
  crosshairColor: string
  currentPriceColor: string
}

export interface ViewportState {
  priceMin: number
  priceMax: number
  timeStart: number
  timeEnd: number
  candleWidth: number
  pricePixelRatio: number
}

export class HighPerformanceChartRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private config: ChartConfig
  private viewport: ViewportState
  private lastFrameTime = 0
  private frameId: number | null = null
  private isDirty = false
  private lastMousePosition = { x: 0, y: 0 }

  // Cached elements for performance
  private candleDataCache: CandleData[] = []
  private volumeProfileCache: VolumeProfileData[] = []
  private orderbookCache: OrderBookData | null = null

  // Offscreen canvases for static elements
  private backgroundCanvas: HTMLCanvasElement
  private backgroundCtx: CanvasRenderingContext2D
  private gridCanvas: HTMLCanvasElement
  private gridCtx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement, config: ChartConfig) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.config = config

    // Create offscreen canvases
    this.backgroundCanvas = document.createElement('canvas')
    this.backgroundCtx = this.backgroundCanvas.getContext('2d')!
    this.gridCanvas = document.createElement('canvas')
    this.gridCtx = this.gridCanvas.getContext('2d')!

    // Setup high DPI
    this.setupHighDPI()

    // Initialize viewport
    this.viewport = {
      priceMin: 107000,
      priceMax: 113000,
      timeStart: 0,
      timeEnd: 100,
      candleWidth: 8,
      pricePixelRatio: 1
    }

    this.startRenderLoop()
  }

  private setupHighDPI() {
    const devicePixelRatio = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()

    // Set canvas size
    this.canvas.width = rect.width * devicePixelRatio
    this.canvas.height = rect.height * devicePixelRatio
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'

    // Scale context
    this.ctx.scale(devicePixelRatio, devicePixelRatio)

    // Setup offscreen canvases
    this.backgroundCanvas.width = this.canvas.width
    this.backgroundCanvas.height = this.canvas.height
    this.backgroundCtx.scale(devicePixelRatio, devicePixelRatio)

    this.gridCanvas.width = this.canvas.width
    this.gridCanvas.height = this.canvas.height
    this.gridCtx.scale(devicePixelRatio, devicePixelRatio)
  }

  // Frame-rate limited render loop (60fps max)
  private startRenderLoop() {
    const render = (currentTime: number) => {
      if (currentTime - this.lastFrameTime >= 16.67) { // ~60fps
        if (this.isDirty) {
          this.renderFrame()
          this.isDirty = false
          this.lastFrameTime = currentTime
        }
      }
      this.frameId = requestAnimationFrame(render)
    }
    this.frameId = requestAnimationFrame(render)
  }

  // Main render function - only renders what's changed
  private renderFrame() {
    const rect = this.canvas.getBoundingClientRect()
    
    // Clear main canvas
    this.ctx.fillStyle = this.config.backgroundColor
    this.ctx.fillRect(0, 0, rect.width, rect.height)

    // Draw static elements from cache
    this.ctx.drawImage(this.backgroundCanvas, 0, 0)
    this.ctx.drawImage(this.gridCanvas, 0, 0)

    // Draw dynamic elements
    this.renderCandlesticks()
    this.renderVolumeProfile()
    this.renderCurrentPrice()
    this.renderCrosshair()
  }

  // Render background (cached, only updates when viewport changes)
  private renderBackground() {
    const rect = this.canvas.getBoundingClientRect()
    this.backgroundCtx.fillStyle = this.config.backgroundColor
    this.backgroundCtx.fillRect(0, 0, rect.width, rect.height)
  }

  // Render grid (cached, only updates when viewport changes)
  private renderGrid() {
    const rect = this.canvas.getBoundingClientRect()
    this.gridCtx.clearRect(0, 0, rect.width, rect.height)
    this.gridCtx.strokeStyle = this.config.gridColor
    this.gridCtx.lineWidth = 0.5

    // Vertical grid lines (time)
    const timeStep = 50 * (this.viewport.candleWidth / 8)
    for (let x = 0; x < rect.width; x += timeStep) {
      this.gridCtx.beginPath()
      this.gridCtx.moveTo(x, 0)
      this.gridCtx.lineTo(x, rect.height)
      this.gridCtx.stroke()
    }

    // Horizontal grid lines (price)
    const priceStep = 30
    for (let y = 0; y < rect.height; y += priceStep) {
      this.gridCtx.beginPath()
      this.gridCtx.moveTo(0, y)
      this.gridCtx.lineTo(rect.width, y)
      this.gridCtx.stroke()
    }
  }

  // Ultra-fast candlestick rendering
  private renderCandlesticks() {
    if (!this.candleDataCache.length) return

    const rect = this.canvas.getBoundingClientRect()
    const spacing = this.viewport.candleWidth + 4

    // Only render visible candles
    const startIndex = Math.max(0, Math.floor(this.viewport.timeStart))
    const endIndex = Math.min(
      this.candleDataCache.length,
      Math.ceil(this.viewport.timeEnd)
    )

    // Batch drawing operations for performance
    this.ctx.lineWidth = 1

    for (let i = startIndex; i < endIndex; i++) {
      const candle = this.candleDataCache[i]
      const x = i * spacing + 50
      
      // Skip if outside viewport
      if (x < -this.viewport.candleWidth || x > rect.width + this.viewport.candleWidth) continue

      const isBull = candle.close > candle.open
      const color = isBull ? this.config.bullColor : this.config.bearColor

      // Calculate positions
      const high = this.priceToY(candle.high)
      const low = this.priceToY(candle.low)
      const open = this.priceToY(candle.open)
      const close = this.priceToY(candle.close)

      // Draw wick (single path for performance)
      this.ctx.strokeStyle = color
      this.ctx.beginPath()
      this.ctx.moveTo(x + this.viewport.candleWidth / 2, high)
      this.ctx.lineTo(x + this.viewport.candleWidth / 2, low)
      this.ctx.stroke()

      // Draw body
      this.ctx.fillStyle = color
      const bodyTop = Math.min(open, close)
      const bodyHeight = Math.abs(close - open)
      this.ctx.fillRect(x, bodyTop, this.viewport.candleWidth, bodyHeight || 1)
    }
  }

  // Fast volume profile rendering
  private renderVolumeProfile() {
    if (!this.volumeProfileCache.length) return

    const rect = this.canvas.getBoundingClientRect()
    const profileWidth = 150
    const maxVolume = Math.max(...this.volumeProfileCache.map(v => v.volume))

    for (const profile of this.volumeProfileCache) {
      const y = this.priceToY(profile.price)
      const width = (profile.volume / maxVolume) * profileWidth
      
      this.ctx.fillStyle = profile.type === 'buy' 
        ? this.config.bullColor + '80' 
        : this.config.bearColor + '80'
      
      this.ctx.fillRect(rect.width - profileWidth - 100, y - 2, width, 4)
    }
  }

  // Current price line
  private renderCurrentPrice() {
    const currentPrice = this.candleDataCache[this.candleDataCache.length - 1]?.close
    if (!currentPrice) return

    const rect = this.canvas.getBoundingClientRect()
    const y = this.priceToY(currentPrice)

    this.ctx.strokeStyle = this.config.currentPriceColor
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([3, 3])
    this.ctx.beginPath()
    this.ctx.moveTo(0, y)
    this.ctx.lineTo(rect.width - 100, y)
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }

  // Crosshair (only renders if mouse moved significantly)
  private renderCrosshair() {
    if (this.lastMousePosition.x === 0 && this.lastMousePosition.y === 0) return

    const rect = this.canvas.getBoundingClientRect()
    
    this.ctx.strokeStyle = this.config.crosshairColor
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([2, 2])

    // Vertical line
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastMousePosition.x, 0)
    this.ctx.lineTo(this.lastMousePosition.x, rect.height)
    this.ctx.stroke()

    // Horizontal line
    this.ctx.beginPath()
    this.ctx.moveTo(0, this.lastMousePosition.y)
    this.ctx.lineTo(rect.width - 100, this.lastMousePosition.y)
    this.ctx.stroke()

    this.ctx.setLineDash([])
  }

  // Utility functions
  private priceToY(price: number): number {
    const rect = this.canvas.getBoundingClientRect()
    const priceRange = this.viewport.priceMax - this.viewport.priceMin
    return rect.height - ((price - this.viewport.priceMin) / priceRange) * rect.height
  }

  private yToPrice(y: number): number {
    const rect = this.canvas.getBoundingClientRect()
    const priceRange = this.viewport.priceMax - this.viewport.priceMin
    return this.viewport.priceMin + ((rect.height - y) / rect.height) * priceRange
  }

  // Public API
  public updateCandles(candles: CandleData[]) {
    this.candleDataCache = candles
    this.markDirty()
  }

  public updateVolumeProfile(volumeProfile: VolumeProfileData[]) {
    this.volumeProfileCache = volumeProfile
    this.markDirty()
  }

  public updateOrderbook(orderbook: OrderBookData) {
    this.orderbookCache = orderbook
    this.markDirty()
  }

  public setMousePosition(x: number, y: number) {
    // Only update if mouse moved significantly (reduce unnecessary redraws)
    if (Math.abs(x - this.lastMousePosition.x) > 1 || Math.abs(y - this.lastMousePosition.y) > 1) {
      this.lastMousePosition = { x, y }
      this.markDirty()
    }
  }

  public updateViewport(viewport: Partial<ViewportState>) {
    const wasViewportChanged = JSON.stringify(this.viewport) !== JSON.stringify({...this.viewport, ...viewport})
    
    this.viewport = { ...this.viewport, ...viewport }
    
    if (wasViewportChanged) {
      // Viewport changed, re-render static elements
      this.renderBackground()
      this.renderGrid()
      this.markDirty()
    }
  }

  public updateConfig(config: Partial<ChartConfig>) {
    this.config = { ...this.config, ...config }
    this.renderBackground() // Re-render background
    this.markDirty()
  }

  private markDirty() {
    this.isDirty = true
  }

  public destroy() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
    }
  }
} 