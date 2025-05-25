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
  type: 'buy' | 'sell'
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