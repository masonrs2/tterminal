/**
 * Trading Terminal State Management Hook
 * Centralizes all state logic for better maintainability and reusability
 * Now includes localStorage persistence for all UI state
 */

import { useState, useEffect, useCallback } from 'react'
import { getStoredData, setStoredData, STORAGE_KEYS } from '../../utils/storage'
import { useDebounce } from '../useDebounce'
import type { 
  CandleData, 
  MousePosition, 
  IndicatorSettings, 
  Drawing, 
  ViewportState, 
  ComponentSizes, 
  DragState,
  MeasuringSelection 
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
  navigationMode: "auto", // "auto" = horizontal only, "manual" = full directional
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
    rowCount: 64,
    bullColor: "#00ff88",
    bearColor: "#ff4444",
    origin: "right",
    showPOC: false,
    pocLineColor: "#888888",
    valueArea: 0.63,
    deltaMode: false,
    showStatsBox: true,
    showVolumeText: false,
    opacity: 0.7,
    showSinglePrints: true,
    singlePrintColor: "#fbbf24",
    singlePrintOpacity: 0.3,
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
    gridColor: "#1a1a1a",
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

  // Navigation mode (persisted)
  const [navigationMode, setNavigationMode] = useState<"auto" | "manual">((persistedUIState.navigationMode as "auto" | "manual") || "auto")

  // Indicators (persisted)
  const [activeIndicators, setActiveIndicators] = useState<string[]>(persistedUIState.activeIndicators)
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(persistedUIState.hoveredIndicator)
  const [openSettingsPanel, setOpenSettingsPanel] = useState<string | null>(persistedUIState.openSettingsPanel)

  // Drawing tools (persisted)
  const [drawingMode, setDrawingMode] = useState<string | null>(null)
  const [drawingTools, setDrawingTools] = useState<Drawing[]>(persistedDrawingTools)
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<string | null>(null)
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState<number | null>(null)

  // Measuring tool state (runtime only)
  const [measuringSelection, setMeasuringSelection] = useState<MeasuringSelection>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    startTimeIndex: 0,
    endTimeIndex: 0,
    startPrice: 0,
    endPrice: 0,
    isActive: false,
  })
  const [isCreatingMeasurement, setIsCreatingMeasurement] = useState(false)

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
      navigationMode,
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
  }, 500) // Increased debounce delay to reduce log spam

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
    setNavigationMode((storedUIState.navigationMode as "auto" | "manual") || "auto")

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
    navigationMode,
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
  }, [componentSizes, saveComponentSizes])

  useEffect(() => {
    saveDrawingTools()
  }, [drawingTools, saveDrawingTools])

  // Reset functions - restore default settings
  const resetIndicatorSettings = useCallback(() => {
    setIndicatorSettings(defaultIndicatorSettings)
  }, [])

  const resetThemeSettings = useCallback(() => {
    setBackgroundColor(defaultThemeState.backgroundColor)
    setBullCandleColor(defaultThemeState.bullCandleColor)
    setBearCandleColor(defaultThemeState.bearCandleColor)
  }, [])

  const resetViewportSettings = useCallback(() => {
    setViewportState(defaultViewportState)
  }, [])

  const resetComponentSizes = useCallback(() => {
    setComponentSizes(defaultComponentSizes)
  }, [])

  const resetSpecificIndicator = useCallback((indicatorName: string) => {
    if (defaultIndicatorSettings[indicatorName as keyof typeof defaultIndicatorSettings]) {
      setIndicatorSettings(prev => ({
        ...prev,
        [indicatorName]: defaultIndicatorSettings[indicatorName as keyof typeof defaultIndicatorSettings]
      }))
    }
  }, [])

  const resetAllSettings = useCallback(() => {
    resetIndicatorSettings()
    resetThemeSettings()
    resetViewportSettings()
    resetComponentSizes()
    setDrawingTools([])
  }, [resetIndicatorSettings, resetThemeSettings, resetViewportSettings, resetComponentSizes])

  const clearMeasuringSelection = useCallback(() => {
    setMeasuringSelection(prev => ({ ...prev, isActive: false }))
    setIsCreatingMeasurement(false)
  }, [])

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

    // Navigation mode
    navigationMode,
    setNavigationMode,

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

    // Measuring tool
    measuringSelection,
    setMeasuringSelection,
    isCreatingMeasurement,
    setIsCreatingMeasurement,

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

    // Reset functions
    resetIndicatorSettings,
    resetThemeSettings,
    resetViewportSettings,
    resetComponentSizes,
    resetSpecificIndicator,
    resetAllSettings,
    clearMeasuringSelection,
  }
} 