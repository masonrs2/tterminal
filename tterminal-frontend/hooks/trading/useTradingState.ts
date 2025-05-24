/**
 * Trading Terminal State Management Hook
 * Centralizes all state logic for better maintainability and reusability
 * Now includes localStorage persistence for all UI state
 */

import { useState, useEffect } from 'react'
import { getStoredData, setStoredData, STORAGE_KEYS } from '../../utils/storage'
import { useDebounce } from '../useDebounce'
import type { 
  CandleData, 
  MousePosition, 
  IndicatorSettings, 
  Drawing, 
  ViewportState, 
  ComponentSizes, 
  DragState 
} from '../../types/trading'

// Default values for state (moved outside to prevent recreation)
const defaultUIState = {
  showIndicators: false,
  showTimeframes: false,
  showTools: false,
  showSettings: false,
  showChartSettings: false,
  showOrderbook: true,
  selectedTimeframe: "15m",
  activeIndicators: ["CVD", "Liquidations", "VPVR", "Heatmap"],
  hoveredIndicator: null,
  openSettingsPanel: null,
}

const defaultThemeState = {
  backgroundColor: "#000000",
  bullCandleColor: "#00ff88",
  bearCandleColor: "#ff4444",
}

const defaultViewportState = {
  priceZoom: 1,
  timeZoom: 1,
  priceOffset: 0,
  timeOffset: 0,
}

const defaultComponentSizes = {
  orderbookWidth: 320,
  cvdHeight: 80,
  liquidationsHeight: 64,
}

const defaultIndicatorSettings = {
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
  chart: {
    showVerticalGrid: true,
    showHorizontalGrid: true,
    gridColor: "#333333",
    gridOpacity: 0.5,
  },
}

export const useTradingState = () => {
  // Track if we're hydrated (client-side) to avoid SSR mismatches
  const [isHydrated, setIsHydrated] = useState(false)

  // Load persisted state - only on client side
  const persistedUIState = isHydrated ? getStoredData(STORAGE_KEYS.UI_STATE, defaultUIState) : defaultUIState
  const persistedThemeState = isHydrated ? getStoredData(STORAGE_KEYS.THEME_STATE, defaultThemeState) : defaultThemeState
  const persistedViewportState = isHydrated ? getStoredData(STORAGE_KEYS.VIEWPORT_STATE, defaultViewportState) : defaultViewportState
  const persistedComponentSizes = isHydrated ? getStoredData(STORAGE_KEYS.COMPONENT_SIZES, defaultComponentSizes) : defaultComponentSizes
  const persistedIndicatorSettings = isHydrated ? getStoredData(STORAGE_KEYS.INDICATOR_SETTINGS, defaultIndicatorSettings) : defaultIndicatorSettings
  const persistedDrawingTools = isHydrated ? getStoredData(STORAGE_KEYS.DRAWING_TOOLS, []) : []

  // Core trading data (not persisted)
  const [currentPrice, setCurrentPrice] = useState(107674.0)
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null)
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 })

  // UI state (persisted)
  const [showIndicators, setShowIndicators] = useState(persistedUIState.showIndicators)
  const [showTimeframes, setShowTimeframes] = useState(persistedUIState.showTimeframes)
  const [showTools, setShowTools] = useState(persistedUIState.showTools)
  const [showSettings, setShowSettings] = useState(persistedUIState.showSettings)
  const [showChartSettings, setShowChartSettings] = useState(persistedUIState.showChartSettings)
  const [showOrderbook, setShowOrderbook] = useState(persistedUIState.showOrderbook)
  const [selectedTimeframe, setSelectedTimeframe] = useState(persistedUIState.selectedTimeframe)

  // Indicators (persisted)
  const [activeIndicators, setActiveIndicators] = useState<string[]>(persistedUIState.activeIndicators)
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(persistedUIState.hoveredIndicator)
  const [openSettingsPanel, setOpenSettingsPanel] = useState<string | null>(persistedUIState.openSettingsPanel)

  // Drawing tools (persisted)
  const [drawingMode, setDrawingMode] = useState<string | null>(null)
  const [drawingTools, setDrawingTools] = useState<Drawing[]>(persistedDrawingTools)
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<string | null>(null)
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState<number | null>(null)

  // Theme settings (persisted)
  const [backgroundColor, setBackgroundColor] = useState(persistedThemeState.backgroundColor)
  const [bullCandleColor, setBullCandleColor] = useState(persistedThemeState.bullCandleColor)
  const [bearCandleColor, setBearCandleColor] = useState(persistedThemeState.bearCandleColor)

  // Indicator settings (persisted)
  const [indicatorSettings, setIndicatorSettings] = useState<IndicatorSettings>(persistedIndicatorSettings)

  // Viewport and zoom state (persisted)
  const [viewportState, setViewportState] = useState<ViewportState>(persistedViewportState)

  // Component sizes (persisted)
  const [componentSizes, setComponentSizes] = useState<ComponentSizes>(persistedComponentSizes)

  // Drag states (not persisted - runtime only)
  const [dragState, setDragState] = useState<DragState>({
    isDraggingPrice: false,
    isDraggingTime: false,
    isDraggingChart: false,
    isDraggingOrderbook: false,
    isDraggingCvd: false,
    isDraggingLiquidations: false,
    dragStart: { x: 0, y: 0 },
  })

  // Debounced save functions to optimize localStorage writes
  const saveUIState = useDebounce(() => {
    const uiState = {
      showIndicators,
      showTimeframes,
      showTools,
      showSettings,
      showChartSettings,
      showOrderbook,
      selectedTimeframe,
      activeIndicators,
      hoveredIndicator,
      openSettingsPanel,
    }
    setStoredData(STORAGE_KEYS.UI_STATE, uiState)
  }, 300)

  const saveThemeState = useDebounce(() => {
    const themeState = {
      backgroundColor,
      bullCandleColor,
      bearCandleColor,
    }
    setStoredData(STORAGE_KEYS.THEME_STATE, themeState)
  }, 300)

  const saveIndicatorSettings = useDebounce(() => {
    setStoredData(STORAGE_KEYS.INDICATOR_SETTINGS, indicatorSettings)
  }, 300)

  const saveViewportState = useDebounce(() => {
    setStoredData(STORAGE_KEYS.VIEWPORT_STATE, viewportState)
  }, 500) // Longer delay for frequently changing viewport

  const saveComponentSizes = useDebounce(() => {
    setStoredData(STORAGE_KEYS.COMPONENT_SIZES, componentSizes)
  }, 100)

  const saveDrawingTools = useDebounce(() => {
    setStoredData(STORAGE_KEYS.DRAWING_TOOLS, drawingTools)
  }, 300)

  // Hydration effect - run once on client side to load persisted state
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Update state with persisted values once hydrated
  useEffect(() => {
    if (!isHydrated) return

    const storedUIState = getStoredData(STORAGE_KEYS.UI_STATE, defaultUIState)
    const storedThemeState = getStoredData(STORAGE_KEYS.THEME_STATE, defaultThemeState)
    const storedViewportState = getStoredData(STORAGE_KEYS.VIEWPORT_STATE, defaultViewportState)
    const storedComponentSizes = getStoredData(STORAGE_KEYS.COMPONENT_SIZES, defaultComponentSizes)
    const storedIndicatorSettings = getStoredData(STORAGE_KEYS.INDICATOR_SETTINGS, defaultIndicatorSettings)
    const storedDrawingTools = getStoredData(STORAGE_KEYS.DRAWING_TOOLS, [])

    // Apply persisted UI state
    setShowIndicators(storedUIState.showIndicators)
    setShowTimeframes(storedUIState.showTimeframes)
    setShowTools(storedUIState.showTools)
    setShowSettings(storedUIState.showSettings)
    setShowChartSettings(storedUIState.showChartSettings)
    setShowOrderbook(storedUIState.showOrderbook)
    setSelectedTimeframe(storedUIState.selectedTimeframe)
    setActiveIndicators(storedUIState.activeIndicators)
    setHoveredIndicator(storedUIState.hoveredIndicator)
    setOpenSettingsPanel(storedUIState.openSettingsPanel)

    // Apply persisted theme state
    setBackgroundColor(storedThemeState.backgroundColor)
    setBullCandleColor(storedThemeState.bullCandleColor)
    setBearCandleColor(storedThemeState.bearCandleColor)

    // Apply persisted viewport state
    setViewportState(storedViewportState)

    // Apply persisted component sizes
    setComponentSizes(storedComponentSizes)

    // Apply persisted indicator settings
    setIndicatorSettings(storedIndicatorSettings)

    // Apply persisted drawing tools
    setDrawingTools(storedDrawingTools)

    // Debug logging for localStorage (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('ComponentSizes loaded from localStorage:', storedComponentSizes)
      console.log('Applied componentSizes to state:', storedComponentSizes)
    }
     }, [isHydrated])

  // Persistence effects - save state changes to localStorage
  useEffect(() => {
    saveUIState()
  }, [
    showIndicators,
    showTimeframes,
    showTools,
    showSettings,
    showChartSettings,
    showOrderbook,
    selectedTimeframe,
    activeIndicators,
    hoveredIndicator,
    openSettingsPanel,
    saveUIState,
  ])

  useEffect(() => {
    saveThemeState()
  }, [backgroundColor, bullCandleColor, bearCandleColor, saveThemeState])

  useEffect(() => {
    saveIndicatorSettings()
  }, [indicatorSettings, saveIndicatorSettings])

  useEffect(() => {
    saveViewportState()
  }, [viewportState, saveViewportState])

  useEffect(() => {
    saveComponentSizes()
    // Debug logging for component size changes
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('ComponentSizes changed, saving to localStorage:', componentSizes)
    }
  }, [componentSizes, saveComponentSizes])

  useEffect(() => {
    saveDrawingTools()
  }, [drawingTools, saveDrawingTools])

  return {
    // Hydration state
    isHydrated,

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