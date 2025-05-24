/**
 * Trading Terminal State Management Hook
 * Centralizes all state logic for better maintainability and reusability
 */

import { useState } from 'react'
import type { 
  CandleData, 
  MousePosition, 
  IndicatorSettings, 
  Drawing, 
  ViewportState, 
  ComponentSizes, 
  DragState 
} from '../../types/trading'

export const useTradingState = () => {
  // Core trading data
  const [currentPrice, setCurrentPrice] = useState(107674.0)
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m")
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null)
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })

  // UI state
  const [showIndicators, setShowIndicators] = useState(false)
  const [showTimeframes, setShowTimeframes] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showChartSettings, setShowChartSettings] = useState(false)
  const [showOrderbook, setShowOrderbook] = useState(true)

  // Indicators
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["CVD", "Liquidations", "VPVR", "Heatmap"])
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(null)
  const [openSettingsPanel, setOpenSettingsPanel] = useState<string | null>(null)

  // Drawing tools
  const [drawingMode, setDrawingMode] = useState<string | null>(null)
  const [drawingTools, setDrawingTools] = useState<Drawing[]>([])
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<string | null>(null)
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState<number | null>(null)

  // Theme settings
  const [backgroundColor, setBackgroundColor] = useState("#000000")
  const [bullCandleColor, setBullCandleColor] = useState("#00ff88")
  const [bearCandleColor, setBearCandleColor] = useState("#ff4444")

  // Indicator settings
  const [indicatorSettings, setIndicatorSettings] = useState<IndicatorSettings>({
    vpvr: {
      enableFixedTicks: false,
      rowCount: 60,
      bullColor: "#00ff88",
      bearColor: "#ff4444",
      origin: "right",
      showPOC: false,
      pocLineColor: "#888888",
      valueArea: 0.7,
      deltaMode: false,
    },
    liquidations: {
      threshold: 10,
      color: "#ff4444",
      showLabels: true,
    },
    cvd: {
      lineColor: "#00ff88",
      lineWidth: 2,
      smoothing: false,
    },
    heatmap: {
      intensity: 0.8,
      colorScheme: "purple",
    },
  })

  // Viewport and zoom state
  const [viewportState, setViewportState] = useState<ViewportState>({
    priceZoom: 1,
    timeZoom: 1,
    priceOffset: 0,
    timeOffset: 0,
  })

  // Component sizes
  const [componentSizes, setComponentSizes] = useState<ComponentSizes>({
    orderbookWidth: 320,
    cvdHeight: 80,
    liquidationsHeight: 64,
  })

  // Drag states
  const [dragState, setDragState] = useState<DragState>({
    isDraggingPrice: false,
    isDraggingTime: false,
    isDraggingChart: false,
    isDraggingOrderbook: false,
    isDraggingCvd: false,
    isDraggingLiquidations: false,
    dragStart: { x: 0, y: 0 },
  })

  return {
    // Core data
    currentPrice,
    setCurrentPrice,
    selectedTimeframe,
    setSelectedTimeframe,
    hoveredCandle,
    setHoveredCandle,
    mousePosition,
    setMousePosition,

    // UI state
    showIndicators,
    setShowIndicators,
    showTimeframes,
    setShowTimeframes,
    showTools,
    setShowTools,
    showSettings,
    setShowSettings,
    showChartSettings,
    setShowChartSettings,
    showOrderbook,
    setShowOrderbook,

    // Indicators
    activeIndicators,
    setActiveIndicators,
    hoveredIndicator,
    setHoveredIndicator,
    openSettingsPanel,
    setOpenSettingsPanel,

    // Drawing tools
    drawingMode,
    setDrawingMode,
    drawingTools,
    setDrawingTools,
    selectedDrawingTool,
    setSelectedDrawingTool,
    selectedDrawingIndex,
    setSelectedDrawingIndex,

    // Theme
    backgroundColor,
    setBackgroundColor,
    bullCandleColor,
    setBullCandleColor,
    bearCandleColor,
    setBearCandleColor,

    // Indicator settings
    indicatorSettings,
    setIndicatorSettings,

    // Viewport
    viewportState,
    setViewportState,

    // Component sizes
    componentSizes,
    setComponentSizes,

    // Drag state
    dragState,
    setDragState,
  }
} 