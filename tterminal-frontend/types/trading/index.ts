/**
 * Core trading terminal types and interfaces
 * Centralized type definitions for better maintainability
 */

export interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MousePosition {
  x: number
  y: number
  candle?: CandleData
  price?: number
}

export interface OrderbookEntry {
  price: number
  size: number
  total: number
}

export interface OrderbookData {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
}

export interface VolumeProfileEntry {
  price: number
  volume: number
  buyVolume: number
  sellVolume: number
  delta: number
  trades: number
  type: 'buy' | 'sell' | 'neutral'
}

export interface VolumeProfileLevel {
  price: number
  totalVolume: number
  buyVolume: number
  sellVolume: number
  delta: number // buyVolume - sellVolume
  isPOC: boolean // Point of Control
  isValueArea: boolean // Within Value Area
}

export interface VolumeProfileData {
  levels: VolumeProfileLevel[]
  poc: number // Point of Control price
  vah: number // Value Area High
  val: number // Value Area Low
  totalVolume: number
  totalDelta: number
  priceRange: { min: number; max: number }
  rawCandles: CandleData[] // PERFORMANCE: Store raw data for recalculation
  singlePrints: SinglePrint[] // Areas with no trading volume
}

export interface SinglePrint {
  priceStart: number // Start of single print range
  priceEnd: number   // End of single print range
  isGap: boolean     // True if this is a price gap between candles
}

export interface TradeData {
  timestamp: number
  price: number
  quantity: number
  isBuyerMaker: boolean
  symbol: string
}

export interface HeatmapData {
  x: number
  y: number
  intensity: number
}

export interface Drawing {
  type: string
  price1: number
  time1: number
  price2: number
  time2: number
  color: string
  lineWidth: number
}

export interface MeasuringSelection {
  startX: number
  startY: number
  endX: number
  endY: number
  startTimeIndex: number
  endTimeIndex: number
  startPrice: number
  endPrice: number
  isActive: boolean
}

export interface IndicatorSettings {
  vpvr: {
    enableFixedTicks: boolean
    rowCount: number
    bullColor: string
    bearColor: string
    origin: string
    showPOC: boolean
    pocLineColor: string
    valueArea: number
    deltaMode: boolean
    showStatsBox: boolean
    showVolumeText: boolean
    opacity: number
    showSinglePrints: boolean
    singlePrintColor: string
    singlePrintOpacity: number
  }
  liquidations: {
    threshold: number
    color: string
    showLabels: boolean
  }
  cvd: {
    lineColor: string
    lineWidth: number
    smoothing: boolean
  }
  heatmap: {
    intensity: number
    colorScheme: string
  }
  chart: {
    showVerticalGrid: boolean
    showHorizontalGrid: boolean
    gridColor: string
    gridOpacity: number
  }
}

export interface ViewportState {
  priceZoom: number
  timeZoom: number
  priceOffset: number
  timeOffset: number
}

export interface ComponentSizes {
  orderbookWidth: number
  cvdHeight: number
  liquidationsHeight: number
}

export interface DragState {
  isDraggingPrice: boolean
  isDraggingTime: boolean
  isDraggingChart: boolean
  isDraggingOrderbook: boolean
  isDraggingCvd: boolean
  isDraggingLiquidations: boolean
  dragStart: { x: number; y: number }
  potentialDrag?: boolean
} 