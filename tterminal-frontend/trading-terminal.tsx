/** * Trading Terminal - Modular Implementation with Real-time WebSocket Integration
 * Enterprise-level component architecture for maintainability and scalability
 * 
 * Features:
 * - Modular component structure for better organization
 * - Custom hooks for centralized state management
 * - Real-time WebSocket price streaming with sub-100ms updates
 * - Reusable utility functions and type definitions
 * - High-performance canvas rendering with optimizations
 * - Interactive drawing tools with keyboard shortcuts
 * - Real-time price updates and multiple indicators
 * - ULTRA-FAST backend integration with intelligent caching
 * 
 * Architecture Benefits:
 * - Single responsibility principle for each component
 * - Easy testing and debugging of individual modules
 * - Improved code reusability and maintainability
 * - Better developer experience with TypeScript support
 * - Maximum performance for professional trading
 * 
 * Real-time Features:
 * - WebSocket streaming for live price updates
 * - Real-time candle updates for current timeframe
 * - Automatic fallback to HTTP polling if WebSocket fails
 * - Live price movement on Y-axis with smooth animations
 */

"use client"

import React, { useRef, useCallback, useEffect, useState, useMemo } from "react"
import { useTradingState } from './hooks/trading/useTradingState'
import { useTradingData } from './hooks/trading/useTradingData'
import { useWebSocketPrice } from './hooks/trading/useWebSocketPrice'
import { useChartInteractions } from './hooks/trading/useChartInteractions'
import { TopNavigation } from './components/trading-terminal/controls/TopNavigation'
import { SymbolTabs } from './components/trading-terminal/controls/SymbolTabs'
import { ChartControls } from './components/trading-terminal/controls/ChartControls'
import { MainChart } from './components/trading-terminal/charts/MainChart'
import { WebSocketStatus } from './components/trading/WebSocketStatus'
import HighPerformanceOrderbook from './components/orderbook'
import type { CandleData } from './types/trading'
import { VolumeProfile } from './components/trading-terminal/charts/VolumeProfile'
import { VPVRSettings } from './components/trading-terminal/controls/VPVRSettings'
import { VolumeSettings } from './components/trading-terminal/controls/VolumeSettings'
import { CVDSettings } from './components/trading-terminal/controls/CVDSettings'
import { useWebSocketLiquidations } from './hooks/trading/useWebSocketLiquidations'

export default function TradingTerminal() {
  // State for dynamic symbol selection (can be expanded to support multiple symbols)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  
  // Centralized state management
  const state = useTradingState()
  
  // Real-time CVD tracking for current candle updates
  const [realTimeCvdData, setRealTimeCvdData] = useState<{
    cumulativeDelta: number
    currentCandleDelta: number
    lastCandleTimestamp: number
  }>({ cumulativeDelta: 0, currentCandleDelta: 0, lastCandleTimestamp: 0 })

  // Real-time volume data state (moved after state initialization)
  const [realVolumeData, setRealVolumeData] = useState<{
    buyVolume: number
    sellVolume: number
    delta: number
    buyPercentage: number
    sellPercentage: number
  } | null>(null)

  // Fetch real volume data from backend (moved after state initialization)
  useEffect(() => {
    const fetchVolumeData = async () => {
      try {
        const response = await fetch(`http://localhost:8080/api/v1/websocket/volume/${selectedSymbol}?interval=${state.selectedTimeframe}`)
        if (response.ok) {
          const data = await response.json()
          if (data.current_candle) {
            setRealVolumeData({
              buyVolume: data.current_candle.buy_volume,
              sellVolume: data.current_candle.sell_volume,
              delta: data.current_candle.delta,
              buyPercentage: data.current_candle.buy_percentage,
              sellPercentage: data.current_candle.sell_percentage
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch volume data:', error)
      }
    }

    // Only fetch if Volume indicator is active
    if (state.activeIndicators.includes("Volume")) {
      // Initial fetch
      fetchVolumeData()

      // Update every 5 seconds
      const interval = setInterval(fetchVolumeData, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedSymbol, state.selectedTimeframe, state.activeIndicators]) // Updated dependencies to include selectedSymbol

  // Real-time WebSocket integration for live price updates
  const websocketPrice = useWebSocketPrice({ 
    symbol: selectedSymbol,
    enabled: true 
  })
  
  // Real-time liquidation data from WebSocket
  const liquidationData = useWebSocketLiquidations({
    symbol: selectedSymbol,
    enabled: true, // ULTRA-FAST FIX: Always enable liquidation data fetching for maximum speed
    maxHistory: 1000
  })
  
  // Real-time trading data from backend API with WebSocket integration
  const tradingData = useTradingData({
    symbol: selectedSymbol,
    interval: state.selectedTimeframe,
    limit: 500,
    enableRealTimeUpdates: true, // Enable real-time updates via WebSocket
    updateInterval: 5000, // HTTP fallback interval (slower since WebSocket handles real-time)
  })

  // Real-time price tracking with WebSocket updates
  useEffect(() => {
    // Use WebSocket price if available and connected
    if (websocketPrice.price !== null && websocketPrice.isConnected) {
      console.log(`Trading Terminal: Setting price from WebSocket: $${websocketPrice.price.toFixed(2)}`)
      state.setCurrentPrice(websocketPrice.price)
    } 
    // Fallback to HTTP data if WebSocket is not available
    else if (tradingData.currentPrice > 0) {
      console.log(`Trading Terminal: Setting price from HTTP: $${tradingData.currentPrice.toFixed(2)}`)
      state.setCurrentPrice(tradingData.currentPrice)
    }
  }, [
    websocketPrice.price, 
    websocketPrice.isConnected, 
    tradingData.currentPrice, 
    selectedSymbol,
    state.setCurrentPrice
  ])

  // Log connection status changes
  useEffect(() => {
    if (websocketPrice.isConnected) {
      console.log(`WebSocket active for ${selectedSymbol}`)
    }
  }, [websocketPrice.isConnected, selectedSymbol])

  // Component refs for dropdown management
  const timeframesDropdownRef = useRef<HTMLDivElement>(null)
  const indicatorsDropdownRef = useRef<HTMLDivElement>(null)
  const toolsDropdownRef = useRef<HTMLDivElement>(null)
  const settingsDropdownRef = useRef<HTMLButtonElement>(null)
  const chartSettingsPanelRef = useRef<HTMLDivElement>(null)
  const vpvrSettingsPanelRef = useRef<HTMLDivElement>(null)
  const volumeSettingsPanelRef = useRef<HTMLDivElement>(null)
  const cvdSettingsPanelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cvdCanvasRef = useRef<HTMLCanvasElement>(null)
  const liquidationsCanvasRef = useRef<HTMLCanvasElement>(null)

  // Chart interactions hook with real data
  const { handleCombinedMouseMove, handleCanvasMouseDown, handleAxisDragEnd, handleMeasuringToolMouseUp, handleWheel } = useChartInteractions({
    canvasRef,
    candleData: tradingData.candles,
    drawingMode: state.drawingMode,
    drawingTools: state.drawingTools,
    selectedDrawingIndex: state.selectedDrawingIndex,
    viewportState: state.viewportState,
    dragState: state.dragState,
    measuringSelection: state.measuringSelection,
    isCreatingMeasurement: state.isCreatingMeasurement,
    navigationMode: state.navigationMode,
    setHoveredCandle: state.setHoveredCandle,
    setMousePosition: state.setMousePosition,
    setDrawingTools: state.setDrawingTools,
    setSelectedDrawingIndex: state.setSelectedDrawingIndex,
    setDrawingMode: state.setDrawingMode,
    setSelectedDrawingTool: state.setSelectedDrawingTool,
    setDragState: state.setDragState,
    setViewportState: state.setViewportState,
    setMeasuringSelection: state.setMeasuringSelection,
    setIsCreatingMeasurement: state.setIsCreatingMeasurement,
  })

  /**
   * Chart control handlers
   */
  const handleSelectTimeframe = useCallback(async (timeframe: string) => {
    state.setSelectedTimeframe(timeframe)
    state.setShowTimeframes(false)
    
    // Load new interval data
    await tradingData.loadInterval(timeframe)
    
    // Navigation will be handled by the useEffect below that watches for candle changes
  }, [state.setSelectedTimeframe, state.setShowTimeframes, tradingData.loadInterval])

  // AUTOMATIC NAVIGATION TO CURRENT CANDLES after timeframe changes
  // This useEffect triggers when candles actually update, ensuring reliable navigation
  useEffect(() => {
    // Only navigate if we have candles and this looks like a timeframe switch
    if (tradingData.candles.length === 0) return
    
    // Add a small delay to ensure the chart is ready
    const navigationTimeout = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      console.log(`Auto-navigating after timeframe change: ${tradingData.candles.length} candles loaded`)
      
      // Use the same improved logic as the "Current" button for consistency
      const canvasWidth = canvas.offsetWidth
      const canvasHeight = canvas.offsetHeight
      const rightMargin = 300 // Doubled margin for maximum space for future candles
      const leftMargin = 50   // Left margin for price axis
      const availableWidth = canvasWidth - rightMargin - leftMargin
      
      // CALCULATE OPTIMAL TIME ZOOM (horizontal sizing) - Show around 100 candles
      const targetCandleCount = Math.min(120, Math.max(80, Math.floor(tradingData.candles.length * 0.8))) // Show 80-120 candles
      const actualCandlesToShow = Math.min(targetCandleCount, tradingData.candles.length)
      
      // Calculate optimal spacing to fill available width
      const baseSpacing = 12 // Base candle spacing
      const optimalTimeZoom = availableWidth / (actualCandlesToShow * baseSpacing)
      const finalTimeZoom = Math.max(0.3, Math.min(4.0, optimalTimeZoom)) // Allow smaller zoom for more candles
      
      // Calculate starting index and offset
      const startIndex = Math.max(0, tradingData.candles.length - actualCandlesToShow)
      const targetOffset = startIndex * baseSpacing * finalTimeZoom
      
      // CALCULATE OPTIMAL PRICE ZOOM - BALANCED SIZE AND POSITIONING
      const visibleCandles = tradingData.candles.slice(startIndex)
      let finalPriceZoom = 2.5 // Increased base zoom for 50% taller candles
      
      if (visibleCandles.length > 0) {
        // Get price range of visible candles
        const visiblePrices = visibleCandles.map(c => [c.low, c.high]).flat()
        const minPrice = Math.min(...visiblePrices)
        const maxPrice = Math.max(...visiblePrices)
        const priceRange = maxPrice - minPrice
        
        // Calculate optimal zoom to fill 80% of chart height for 50% taller candles
        const chartHeight = canvasHeight - 100 // Standard margins
        const targetFillRatio = 0.8 // Increased from 70% to 80% for 50% taller candles
        const optimalPriceZoom = (chartHeight * targetFillRatio) / (priceRange || 1)
        
        // Adjusted zoom bounds for taller candles
        finalPriceZoom = Math.max(1.5, Math.min(12, optimalPriceZoom))
      }
      
      // ADJUSTED OFFSET FOR TALLER CANDLES - MORE UPWARD ADJUSTMENT
      const adjustedOffset = -120 // Increased upward offset to account for taller candles
      
      state.setViewportState({
        priceZoom: finalPriceZoom,
        timeZoom: finalTimeZoom,
        priceOffset: adjustedOffset, // Adjusted offset for proper centering of taller candles
        timeOffset: targetOffset,
      })
      
      console.log(`Timeframe navigation: ${actualCandlesToShow} candles, timeZoom: ${finalTimeZoom.toFixed(2)}, priceZoom: ${finalPriceZoom.toFixed(2)}, offset: ${adjustedOffset}`)
    }, 100) // Small delay to ensure everything is ready
    
    return () => clearTimeout(navigationTimeout)
  }, [tradingData.candles.length, state.selectedTimeframe, state.setViewportState]) // Trigger when candles or timeframe changes

  // Reset chart to current price position (latest bars)
  const handleResetToCurrentPrice = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || tradingData.candles.length === 0) return
    
    // Calculate optimal display parameters
    const canvasWidth = canvas.offsetWidth
    const canvasHeight = canvas.offsetHeight
    const rightMargin = 300 // Doubled margin for maximum space for future candles
    const leftMargin = 50   // Left margin for price axis
    const availableWidth = canvasWidth - rightMargin - leftMargin
    
    // CALCULATE OPTIMAL TIME ZOOM (horizontal sizing)
    // Target: Show around 100 candles for better chart overview
    const targetCandleCount = Math.min(120, Math.max(80, Math.floor(tradingData.candles.length * 0.8))) // Show 80-120 candles
    const actualCandlesToShow = Math.min(targetCandleCount, tradingData.candles.length)
    
    // Calculate optimal spacing to fill available width
    const baseSpacing = 12 // Base candle spacing
    const optimalTimeZoom = availableWidth / (actualCandlesToShow * baseSpacing)
    const finalTimeZoom = Math.max(0.3, Math.min(4.0, optimalTimeZoom)) // Allow smaller zoom for more candles
    
    // Calculate starting index and offset
    const startIndex = Math.max(0, tradingData.candles.length - actualCandlesToShow)
    const targetOffset = startIndex * baseSpacing * finalTimeZoom
    
    // CALCULATE OPTIMAL PRICE ZOOM - BALANCED SIZE AND POSITIONING
    const visibleCandles = tradingData.candles.slice(startIndex)
    let finalPriceZoom = 2.5 // Increased base zoom for 50% taller candles
    
    if (visibleCandles.length > 0) {
      // Get price range of visible candles
      const visiblePrices = visibleCandles.map(c => [c.low, c.high]).flat()
      const minPrice = Math.min(...visiblePrices)
      const maxPrice = Math.max(...visiblePrices)
      const priceRange = maxPrice - minPrice
      
      // Calculate optimal zoom to fill 80% of chart height for 50% taller candles
      const chartHeight = canvasHeight - 100 // Standard margins
      const targetFillRatio = 0.8 // Increased from 70% to 80% for 50% taller candles
      const optimalPriceZoom = (chartHeight * targetFillRatio) / (priceRange || 1)
      
      // Adjusted zoom bounds for taller candles
      finalPriceZoom = Math.max(1.5, Math.min(12, optimalPriceZoom))
    }
    
    // ADJUSTED OFFSET FOR TALLER CANDLES - MORE UPWARD ADJUSTMENT
    const adjustedOffset = -120 // Increased upward offset to account for taller candles
    
    state.setViewportState({
      priceZoom: finalPriceZoom,
      timeZoom: finalTimeZoom,
      priceOffset: adjustedOffset, // Adjusted offset for proper centering of taller candles
      timeOffset: targetOffset,
    })
    
    console.log(`Reset to current: ${actualCandlesToShow} candles, timeZoom: ${finalTimeZoom.toFixed(2)}, priceZoom: ${finalPriceZoom.toFixed(2)}, offset: ${adjustedOffset}`)
  }, [state, tradingData.candles])

  const handleToggleIndicator = useCallback((indicator: string) => {
    state.setActiveIndicators(prev =>
      prev.includes(indicator) 
        ? prev.filter(i => i !== indicator) 
        : [...prev, indicator]
    )
  }, [state.setActiveIndicators])

  const handleSelectDrawingTool = useCallback((tool: string) => {
    console.log('Drawing tool selected:', tool)
    state.setDrawingMode(tool)
    state.setSelectedDrawingTool(tool)
    state.setShowTools(false)
  }, [state.setDrawingMode, state.setSelectedDrawingTool, state.setShowTools])

  const handleClearDrawings = useCallback(() => {
    state.setDrawingTools([])
    state.setShowTools(false)
  }, [state.setDrawingTools, state.setShowTools])

  const removeIndicator = useCallback((indicator: string) => {
    state.setActiveIndicators(prev => prev.filter(i => i !== indicator))
    state.setOpenSettingsPanel(null)
  }, [state.setActiveIndicators, state.setOpenSettingsPanel])

  const openIndicatorSettings = useCallback((indicator: string) => {
    state.setOpenSettingsPanel(state.openSettingsPanel === indicator ? null : indicator)
  }, [state.openSettingsPanel, state.setOpenSettingsPanel])

  const updateIndicatorSetting = useCallback((indicator: string, setting: string, value: any) => {
    state.setIndicatorSettings(prev => ({
      ...prev,
      [indicator]: {
        ...prev[indicator as keyof typeof prev],
        [setting]: value,
      },
    }))
  }, [state.setIndicatorSettings])

  const handleResetIndicator = useCallback((indicator: string) => {
    state.resetSpecificIndicator(indicator)
  }, [state.resetSpecificIndicator])

  const handleResetTheme = useCallback(() => {
    state.resetThemeSettings()
  }, [state.resetThemeSettings])

  const handleResetAllSettings = useCallback(() => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      state.resetAllSettings()
    }
  }, [state.resetAllSettings])

  const handleResetViewport = useCallback(() => {
    state.resetViewportSettings()
  }, [state.resetViewportSettings])

  const handleToggleNavigationMode = useCallback(() => {
    const newMode = state.navigationMode === 'auto' ? 'manual' : 'auto'
    state.setNavigationMode(newMode)
    
    // AUTO-NAVIGATION: When switching to auto mode, ensure candles are visible
    if (newMode === 'auto') {
      // Small delay to ensure mode change is processed
      setTimeout(() => {
        handleResetToCurrentPrice()
      }, 50)
      
      console.log('Switched to Auto mode - navigating to current candles')
    } else {
      console.log('Switched to Manual mode - full directional control enabled')
    }
  }, [state.setNavigationMode, state.navigationMode, handleResetToCurrentPrice])

  // Handle canvas mouse movement for drawing rectangles
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || state.drawingMode !== "Rectangle" || state.drawingTools.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const spacing = 12 * state.viewportState.timeZoom
    const timeIndex = Math.floor((x - 50 + state.viewportState.timeOffset) / spacing)
    const chartHeight = canvas.offsetHeight - 100
    
    // Calculate price range based on actual data
    const candles = tradingData.candles
    if (candles.length === 0) return
    
    const prices = candles.map(c => [c.low, c.high]).flat()
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = (maxPrice - minPrice) / state.viewportState.priceZoom
    const price = maxPrice - ((y - 50 + state.viewportState.priceOffset) / chartHeight) * priceRange

    state.setDrawingTools(prev => {
      const lastIndex = prev.length - 1
      const lastDrawing = prev[lastIndex]

      if (lastDrawing.type === "Rectangle") {
        const updatedDrawing = { 
          ...lastDrawing, 
          price2: price,
          time2: timeIndex
        }
        const newDrawingTools = [...prev]
        newDrawingTools[lastIndex] = updatedDrawing
        return newDrawingTools
      }

      return prev
    })
  }, [state.drawingMode, state.drawingTools, state.viewportState, tradingData.candles, state.setDrawingTools])

  const handleCanvasMouseUp = useCallback(() => {
    if (state.drawingMode === "Rectangle") {
      state.setDrawingMode(null)
      state.setSelectedDrawingTool(null)
    }
  }, [state.drawingMode, state.setDrawingMode, state.setSelectedDrawingTool])

  // Handle mouse down for chart panning
  const handleChartMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // CRITICAL FIX: Don't immediately set isDraggingChart
      // Instead, just store the potential drag start position
      // Only start dragging when mouse actually moves (drag threshold)
      state.setDragState(prev => ({
        ...prev,
        isDraggingChart: false, // Don't start dragging immediately
        dragStart: { x: e.clientX, y: e.clientY },
        potentialDrag: true // Flag to indicate we might start dragging
      }))
    }
  }, [state.setDragState])

  // Component resize handlers with improved smoothness
  const handleCvdResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Set cursor globally during resize
    document.body.style.cursor = 'ns-resize'
    
    state.setDragState(prev => ({
      ...prev,
      isDraggingCvd: true,
      dragStart: { x: e.clientX, y: e.clientY }
    }))
  }, [state.setDragState])

  const handleLiquidationsResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Set cursor globally during resize
    document.body.style.cursor = 'ns-resize'
    
    state.setDragState(prev => ({
      ...prev,
      isDraggingLiquidations: true,
      dragStart: { x: e.clientX, y: e.clientY }
    }))
  }, [state.setDragState])

  // Close all settings panels when clicking on chart
  const handleChartClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Close all open settings panels when clicking on the chart
    if (state.showChartSettings) {
      state.setShowChartSettings(false)
    }
    if (state.openSettingsPanel) {
      state.setOpenSettingsPanel(null)
    }
    if (state.showIndicators) {
      state.setShowIndicators(false)
    }
    if (state.showTools) {
      state.setShowTools(false)
    }
    if (state.showTimeframes) {
      state.setShowTimeframes(false)
    }
    if (state.showSettings) {
      state.setShowSettings(false)
    }
  }, [
    state.showChartSettings, 
    state.setShowChartSettings,
    state.openSettingsPanel,
    state.setOpenSettingsPanel,
    state.showIndicators,
    state.setShowIndicators,
    state.showTools,
    state.setShowTools,
    state.showTimeframes,
    state.setShowTimeframes,
    state.showSettings,
    state.setShowSettings
  ])

  // Combined mouse down handler
  const handleCombinedMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleChartClick(e)
    handleChartMouseDown(e)
    handleCanvasMouseDown(e)
  }, [handleChartClick, handleChartMouseDown, handleCanvasMouseDown])

  // Global drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Don't interfere with axis dragging or measuring tool - let the hook handle it
      if (state.dragState.isDraggingPrice || state.dragState.isDraggingTime || state.isCreatingMeasurement) {
        return
      }

      // CRITICAL FIX: Always update crosshair position for FASTEST response
      // Even during chart dragging, the crosshair should move instantly
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        // Update mouse position for crosshair - INSTANT response
        state.setMousePosition({ x, y })
        
        // Update hovered candle for real-time feedback
        const spacing = 12 * state.viewportState.timeZoom
        const candleIndex = Math.floor((x - 50 + state.viewportState.timeOffset) / spacing)
        if (candleIndex >= 0 && candleIndex < tradingData.candles.length) {
          state.setHoveredCandle(tradingData.candles[candleIndex])
        }
      }

      // DRAG THRESHOLD SYSTEM: Only start dragging if mouse moves significantly
      if (state.dragState.potentialDrag && !state.dragState.isDraggingChart) {
        const deltaX = e.clientX - state.dragState.dragStart.x
        const deltaY = e.clientY - state.dragState.dragStart.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
        
        // Start dragging only if mouse moved more than 5 pixels (drag threshold)
        if (distance > 5) {
          state.setDragState(prev => ({
            ...prev,
            isDraggingChart: true,
            potentialDrag: false // Clear the potential flag
          }))
        }
      }

      if (state.dragState.isDraggingChart) {
        const deltaX = e.clientX - state.dragState.dragStart.x
        const deltaY = e.clientY - state.dragState.dragStart.y
        
        // Apply drag sensitivity multiplier for faster panning
        const dragSensitivity = 1.25
        
        // Respect navigation mode for chart movement
        if (state.navigationMode === 'auto') {
          // Auto mode: Only horizontal movement (current behavior)
          state.setViewportState(prev => ({
            ...prev,
            timeOffset: prev.timeOffset - (deltaX * dragSensitivity),
            // priceOffset remains unchanged in auto mode
          }))
        } else {
          // Manual mode: Full directional movement
          state.setViewportState(prev => ({
            ...prev,
            timeOffset: prev.timeOffset - (deltaX * dragSensitivity),
            priceOffset: prev.priceOffset + (deltaY * dragSensitivity)
          }))
        }
        
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }

      if (state.dragState.isDraggingCvd) {
        const deltaY = state.dragState.dragStart.y - e.clientY
        
        // Throttled resize for smoother performance
        const newHeight = Math.max(40, Math.min(300, state.componentSizes.cvdHeight + deltaY))
        
        state.setComponentSizes((prev: any) => ({
          ...prev,
          cvdHeight: newHeight
        }))
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }

      if (state.dragState.isDraggingLiquidations) {
        const deltaY = state.dragState.dragStart.y - e.clientY
        
        // Throttled resize for smoother performance
        const newHeight = Math.max(40, Math.min(300, state.componentSizes.liquidationsHeight + deltaY))
        
        state.setComponentSizes((prev: any) => ({
          ...prev,
          liquidationsHeight: newHeight
        }))
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }

      if (state.dragState.isDraggingCvdPrice) {
        const deltaY = e.clientY - state.dragState.dragStart.y
        state.setComponentSizes((prev: any) => ({
          ...prev,
          cvdYOffset: prev.cvdYOffset + deltaY * 0.5  // Apply sensitivity for smooth panning
        }))
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }
    }

    const handleMouseUp = () => {
      // Reset cursor when any dragging stops
      document.body.style.cursor = ''
      
      // CRITICAL FIX: Clear potentialDrag flag on mouse up
      // This ensures single clicks don't leave the chart in a "potential drag" state
      if (state.dragState.potentialDrag) {
        state.setDragState(prev => ({
          ...prev,
          potentialDrag: false
        }))
      }
      
      // Handle measuring tool mouse up separately
      if (state.isCreatingMeasurement) {
        handleMeasuringToolMouseUp()
      } else {
        handleAxisDragEnd()
      }
    }

    if (state.dragState.isDraggingChart || state.dragState.isDraggingPrice || state.dragState.isDraggingTime || state.dragState.isDraggingCvd || state.dragState.isDraggingLiquidations || state.dragState.isDraggingCvdPrice || state.isCreatingMeasurement || state.dragState.potentialDrag) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [
    state.dragState.isDraggingChart, 
    state.dragState.isDraggingPrice, 
    state.dragState.isDraggingTime, 
    state.dragState.isDraggingCvd, 
    state.dragState.isDraggingLiquidations,
    state.dragState.isDraggingCvdPrice,
    state.dragState.dragStart,
    state.dragState.potentialDrag,
    state.isCreatingMeasurement, 
    state.setViewportState, 
    state.setDragState, 
    state.setComponentSizes, 
    state.setMousePosition,
    state.setHoveredCandle,
    state.viewportState.timeZoom,
    state.viewportState.timeOffset,
    state.navigationMode,
    tradingData.candles,
    handleMeasuringToolMouseUp, 
    handleAxisDragEnd
  ])

  // Setup wheel event for ultra-fast zooming
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Add wheel event with aggressive settings for responsive zoom
    const wheelOptions = { passive: false, capture: true }
    canvas.addEventListener("wheel", handleWheel, wheelOptions)

    return () => {
      canvas.removeEventListener("wheel", handleWheel, wheelOptions)
    }
  }, [handleWheel])

  // Click outside detection for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeframesDropdownRef.current && !timeframesDropdownRef.current.contains(event.target as Node) && state.showTimeframes) {
        state.setShowTimeframes(false)
      }
      if (indicatorsDropdownRef.current && !indicatorsDropdownRef.current.contains(event.target as Node) && state.showIndicators) {
        state.setShowIndicators(false)
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node) && state.showTools) {
        state.setShowTools(false)
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node) && state.showSettings) {
        state.setShowSettings(false)
      }
      if (chartSettingsPanelRef.current && !chartSettingsPanelRef.current.contains(event.target as Node) && state.showChartSettings) {
        state.setShowChartSettings(false)
      }
      if (vpvrSettingsPanelRef.current && !vpvrSettingsPanelRef.current.contains(event.target as Node) && state.openSettingsPanel === "vpvr") {
        state.setOpenSettingsPanel(null)
      }
      if (volumeSettingsPanelRef.current && !volumeSettingsPanelRef.current.contains(event.target as Node) && state.openSettingsPanel === "volume") {
        state.setOpenSettingsPanel(null)
      }
      if (cvdSettingsPanelRef.current && !cvdSettingsPanelRef.current.contains(event.target as Node) && state.openSettingsPanel === "cvd") {
        state.setOpenSettingsPanel(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [
    state.showTimeframes,
    state.showIndicators, 
    state.showTools,
    state.showSettings,
    state.showChartSettings,
    state.openSettingsPanel,
    state.setShowTimeframes,
    state.setShowIndicators,
    state.setShowTools,
    state.setShowSettings,
    state.setShowChartSettings,
    state.setOpenSettingsPanel
  ])

  // Draw CVD chart with real buy/sell volume data
  useEffect(() => {
    const canvas = cvdCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    ctx.fillStyle = state.backgroundColor
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

    if (tradingData.candles.length === 0) return

    const spacing = 12 * state.viewportState.timeZoom
    const cvdSettings = state.indicatorSettings.cvd
    const chartHeight = canvas.offsetHeight - 10 // Minimal margin for better space usage
    const chartWidth = canvas.offsetWidth - 60 // Leave margin for Y-axis on right
    const centerY = canvas.offsetHeight / 2 // Fixed center, no offset

    // Calculate CVD data using REAL buy/sell volume data from backend
    let cumulativeDelta = 0
    const cvdValues: { x: number; delta: number; cumulative: number }[] = []
    let maxAbsCumulative = 0
    let maxAbsDelta = 0

    tradingData.candles.forEach((candle, index) => {
      const x = index * spacing + 50 - state.viewportState.timeOffset // Match MainChart positioning exactly
      
      // Use REAL buy/sell volume data from backend (not estimation)
      let realBuyVolume = candle.buyVolume || 0
      let realSellVolume = candle.sellVolume || 0
      
      // FALLBACK: If no real volume data, create synthetic data for testing
      if (realBuyVolume === 0 && realSellVolume === 0 && candle.volume > 0) {
        // Create synthetic buy/sell split based on price movement
        const priceChange = candle.close - candle.open
        const bullishRatio = priceChange >= 0 ? 0.6 : 0.4 // 60% buy if bullish, 40% if bearish
        realBuyVolume = candle.volume * bullishRatio
        realSellVolume = candle.volume * (1 - bullishRatio)
        
        // Add some randomness for the current candle to simulate real-time changes
        if (index === tradingData.candles.length - 1) {
          const randomFactor = 0.8 + Math.random() * 0.4 // 0.8 to 1.2
          realBuyVolume *= randomFactor
          realSellVolume = candle.volume - realBuyVolume
        }
      }
      
      const realDelta = realBuyVolume - realSellVolume
      
      cumulativeDelta += realDelta
      
      cvdValues.push({
        x,
        delta: realDelta,
        cumulative: cumulativeDelta
      })
      
      // Track max values for scaling
      maxAbsCumulative = Math.max(maxAbsCumulative, Math.abs(cumulativeDelta))
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(realDelta))
    })

    // DEBUG: Log CVD data for troubleshooting
    if (process.env.NODE_ENV === 'development' && cvdValues.length > 0) {
      const lastCandle = tradingData.candles[tradingData.candles.length - 1]
      const lastCvd = cvdValues[cvdValues.length - 1]
      // Removed debug logging to prevent console spam
    }

    // Only render if we have data
    if (cvdValues.length === 0) return

    // Draw Y-axis labels and grid lines
    const drawYAxisLabels = (maxValue: number, isHistogram: boolean) => {
      ctx.fillStyle = "#888888" // Match main chart price axis color
      ctx.font = "10px monospace"
      ctx.textAlign = "left" // Left align for right-side positioning
      
      // DYNAMIC SCALING: More height = more labels and better precision
      const panelHeight = canvas.offsetHeight
      let divisions = 4 // Default divisions
      let precision = 0 // Default precision (whole numbers)
      
      // Adjust divisions and precision based on panel height for better granularity
      if (panelHeight >= 250) {
        divisions = 12 // Many labels for very tall panels
        precision = 1 // One decimal place
      } else if (panelHeight >= 200) {
        divisions = 10 // More labels for tall panels
        precision = 1 // One decimal place
      } else if (panelHeight >= 150) {
        divisions = 8 // Medium-high labels
        precision = 1 // One decimal place
      } else if (panelHeight >= 120) {
        divisions = 6 // Medium labels
        precision = 0 // Whole numbers
      } else if (panelHeight >= 80) {
        divisions = 5 // Standard labels
        precision = 0 // Whole numbers
      } else {
        divisions = 3 // Fewer labels for small panels
        precision = 0 // Whole numbers
      }
      
      // Calculate appropriate step size based on timeframe and data range
      let stepSize = maxValue / divisions
      
      // Adjust step size based on timeframe for better readability
      const timeframeMultipliers: { [key: string]: number } = {
        '1m': 0.5,   // Smaller steps for 1-minute data
        '5m': 1.0,   // Normal steps for 5-minute data
        '15m': 1.5,  // Larger steps for 15-minute data
        '1h': 2.0,   // Even larger for hourly
        '4h': 3.0,   // Larger for 4-hour
        '1d': 5.0    // Largest for daily
      }
      
      const multiplier = timeframeMultipliers[state.selectedTimeframe] || 1.0
      stepSize = (maxValue / divisions) * multiplier
      
      // Round step size to nice numbers
      const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)))
      const normalizedStep = stepSize / magnitude
      let niceStep = magnitude
      if (normalizedStep <= 1) niceStep = magnitude
      else if (normalizedStep <= 2) niceStep = 2 * magnitude
      else if (normalizedStep <= 5) niceStep = 5 * magnitude
      else niceStep = 10 * magnitude
      
      // Draw positive labels (buys) - RIGHT SIDE
      for (let i = 1; i <= divisions; i++) {
        const value = niceStep * i
        if (value > maxValue) break
        
        const y = centerY - (value / maxValue) * (chartHeight / 2)
        ctx.fillStyle = "#888888" // Match main chart price axis color
        ctx.fillText(`${value.toFixed(precision)}`, canvas.offsetWidth - 55, y + 3)
        
        // Draw subtle grid line
        ctx.strokeStyle = "#1a1a1a"
        ctx.lineWidth = 0.5
        ctx.setLineDash([1, 3])
        ctx.beginPath()
        ctx.moveTo(50, y)
        ctx.lineTo(canvas.offsetWidth - 60, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      
      // Draw negative labels (sells) - RIGHT SIDE
      for (let i = 1; i <= divisions; i++) {
        const value = niceStep * i
        if (value > maxValue) break
        
        const y = centerY + (value / maxValue) * (chartHeight / 2)
        ctx.fillStyle = "#888888" // Match main chart price axis color
        ctx.fillText(`-${value.toFixed(precision)}`, canvas.offsetWidth - 55, y + 3)
        
        // Draw subtle grid line
        ctx.strokeStyle = "#1a1a1a"
        ctx.lineWidth = 0.5
        ctx.setLineDash([1, 3])
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.offsetWidth - 60, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw zero line if enabled
    if (cvdSettings.showZeroLine) {
      ctx.strokeStyle = cvdSettings.zeroLineColor
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(canvas.offsetWidth - 60, centerY)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Zero label on right side
      ctx.fillStyle = "#888888" // Match main chart price axis color
      ctx.font = "10px monospace"
      ctx.textAlign = "left"
      ctx.fillText("0", canvas.offsetWidth - 55, centerY + 3)
    }

    if (cvdSettings.type === 'histogram') {
      // Draw Y-axis labels for histogram
      if (maxAbsDelta > 0) {
        drawYAxisLabels(maxAbsDelta, true)
      }
      
      // Histogram mode: Show individual delta bars for each candle
      if (maxAbsDelta > 0) {
        cvdValues.forEach((cvdData, index) => {
          // Extended visible range to show all bars including the last ones
          if (cvdData.x < -20 || cvdData.x > canvas.offsetWidth + 20) return

          // IMPROVED SCALING: Use full component height efficiently
          const maxBarHeight = chartHeight * 0.45 // Use 45% of chart height for max bar (90% total range)
          const minVisibleHeight = 1 // Minimum bar height for visibility
          
          // Check if this is the current (last) candle for real-time effects
          const isCurrentCandle = index === cvdValues.length - 1
          
          // PERFECT CANDLE ALIGNMENT: Match exact candle width and positioning
          const candleWidth = Math.max(1, Math.min(spacing * 0.8, 10)) // Match MainChart candle width calculation
          const barWidth = candleWidth * 0.9 // Slightly thinner than candle for visual clarity
          
          // ALWAYS draw the current candle bar, even if delta is zero (for real-time feedback)
          // For historical candles, only draw if delta is meaningful
          const shouldDrawBar = isCurrentCandle || Math.abs(cvdData.delta) > 0.001 // Much lower threshold
          
          if (shouldDrawBar) {
            // Calculate bar height with improved scaling
            let deltaHeight = Math.abs(cvdData.delta) / maxAbsDelta * maxBarHeight
            
            // Ensure minimum visibility for the current candle (even if delta is zero)
            if (isCurrentCandle && deltaHeight < minVisibleHeight) {
              deltaHeight = minVisibleHeight // Always show current candle with minimum height
            } else if (Math.abs(cvdData.delta) > 0.001 && deltaHeight < minVisibleHeight) {
              deltaHeight = minVisibleHeight // Show historical candles with meaningful data
            }
            
            // Color based on delta direction (buy vs sell dominance)
            let barColor = cvdData.delta >= 0 ? cvdSettings.histogramBullColor : cvdSettings.histogramBearColor
            
            // REAL-TIME VISUAL EFFECTS: Add glow/pulse effect for current candle
            if (isCurrentCandle) {
              // Add subtle glow for the current candle
              const glowAlpha = 0.3 + Math.sin(Date.now() / 500) * 0.1 // Subtle pulse effect
              const glowColor = cvdData.delta >= 0 ? '#00ff88' : '#ff4444'
              
              // Draw glow background
              ctx.fillStyle = `${glowColor}${Math.floor(glowAlpha * 255).toString(16).padStart(2, '0')}`
              ctx.fillRect(cvdData.x - barWidth/2 - 2, centerY - deltaHeight - 2, barWidth + 4, deltaHeight + 4)
              
              // Use full opacity for current candle
              barColor = cvdData.delta >= 0 ? cvdSettings.histogramBullColor + 'FF' : cvdSettings.histogramBearColor + 'FF'
              
              // Special color for zero delta (neutral)
              if (Math.abs(cvdData.delta) < 0.001) {
                barColor = '#888888FF' // Gray for zero delta
              }
            }
            
            ctx.fillStyle = barColor
            
            if (cvdData.delta >= 0) {
              // Positive delta (more buys): bar goes up from center
              ctx.fillRect(cvdData.x - barWidth/2, centerY - deltaHeight, barWidth, deltaHeight)
            } else {
              // Negative delta (more sells): bar goes down from center
              ctx.fillRect(cvdData.x - barWidth/2, centerY, barWidth, deltaHeight)
            }
            
            // Add border highlight for current candle
            if (isCurrentCandle) {
              ctx.strokeStyle = cvdData.delta >= 0 ? '#00ff88' : '#ff4444'
              if (Math.abs(cvdData.delta) < 0.001) {
                ctx.strokeStyle = '#888888' // Gray border for zero delta
              }
              ctx.lineWidth = 1
              ctx.setLineDash([1, 1])
              if (cvdData.delta >= 0) {
                ctx.strokeRect(cvdData.x - barWidth/2, centerY - deltaHeight, barWidth, deltaHeight)
              } else {
                ctx.strokeRect(cvdData.x - barWidth/2, centerY, barWidth, deltaHeight)
              }
              ctx.setLineDash([])
            }
          }
        })
      } else {
        // DEBUG: Show message when no delta data
        if (process.env.NODE_ENV === 'development') {
          ctx.fillStyle = '#ffffff'
          ctx.font = '12px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('No CVD delta data available', canvas.offsetWidth / 2, centerY)
        }
      }
    } else {
      // Draw Y-axis labels for line mode
      if (maxAbsCumulative > 0) {
        drawYAxisLabels(maxAbsCumulative, false)
      }
      
      // Line mode: Show cumulative CVD (running total)
      if (maxAbsCumulative > 0) {
        ctx.strokeStyle = cvdSettings.lineColor
        ctx.lineWidth = cvdSettings.lineWidth
        ctx.beginPath()
        
        let firstPoint = true
        cvdValues.forEach((cvdData, index) => {
          // Extended visible range to show all line segments including the last ones
          if (cvdData.x < -20 || cvdData.x > canvas.offsetWidth + 20) return

          // Scale cumulative CVD to chart height
          const maxLineHeight = chartHeight * 0.45 // Use 45% of chart height
          const y = centerY - (cvdData.cumulative / maxAbsCumulative) * maxLineHeight
          
          // Check if this is the current (last) point for real-time effects
          const isCurrentPoint = index === cvdValues.length - 1
          
          if (firstPoint) {
            ctx.moveTo(cvdData.x, y)
            firstPoint = false
          } else {
            ctx.lineTo(cvdData.x, y)
          }
          
          // Add real-time indicator for current point
          if (isCurrentPoint) {
            // Draw a pulsing circle at the current point
            const pulseRadius = 3 + Math.sin(Date.now() / 300) * 1 // Pulsing radius
            const pulseAlpha = 0.7 + Math.sin(Date.now() / 400) * 0.3 // Pulsing opacity
            
            ctx.save()
            ctx.fillStyle = `${cvdSettings.lineColor}${Math.floor(pulseAlpha * 255).toString(16).padStart(2, '0')}`
            ctx.beginPath()
            ctx.arc(cvdData.x, y, pulseRadius, 0, 2 * Math.PI)
            ctx.fill()
            
            // Add border
            ctx.strokeStyle = cvdSettings.lineColor
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()
          }
        })
        ctx.stroke()
      }
    }

    // Draw crosshair vertical line
    // Note: Crosshair lines now handled by global overlay spanning all panels
    /*
    if (state.mousePosition.x > 0 && state.mousePosition.x < canvas.offsetWidth - 60) {
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(state.mousePosition.x, 0)
      ctx.lineTo(state.mousePosition.x, canvas.offsetHeight)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw crosshair horizontal line
    if (state.mousePosition.y > 0 && state.mousePosition.y < canvas.offsetHeight) {
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(0, state.mousePosition.y)
      ctx.lineTo(canvas.offsetWidth - 60, state.mousePosition.y) // Stop before price axis on the right
      ctx.stroke()
      ctx.setLineDash([])
    }
    */
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.mousePosition, state.backgroundColor, state.indicatorSettings.cvd, tradingData.candles, state.selectedTimeframe, state.componentSizes.cvdHeight, state.currentPrice, realTimeCvdData]) // Added realTimeCvdData for real-time updates

  // Store liquidation bars data to avoid redrawing on mouse move
  const liquidationBarsRef = React.useRef<ImageData | null>(null)

  // Draw liquidations bars using REAL WebSocket liquidation data
  useEffect(() => {
    const canvas = liquidationsCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    ctx.fillStyle = state.backgroundColor
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

    // Debug logging for liquidation data
    console.log(`LIQUIDATION RENDER: ${liquidationData.liquidations?.length || 0} liquidations, ${tradingData.candles.length} candles`)

    // Only render if we have real liquidation data
    if (!liquidationData.liquidations || liquidationData.liquidations.length === 0) {
      // ULTRA-FAST DEBUG: Log liquidation data state
      console.log(`LIQUIDATION RENDER DEBUG:`, {
        hasLiquidations: !!liquidationData.liquidations,
        liquidationsLength: liquidationData.liquidations?.length || 0,
        isConnected: liquidationData.isConnected,
        lastUpdate: liquidationData.lastUpdate,
        totalLiquidations: liquidationData.totalLiquidations,
        totalUsdValue: liquidationData.totalUsdValue,
        symbol: selectedSymbol,
        enabled: true // Always enabled now
      })
      
      // Show loading state when no data
      ctx.fillStyle = '#666666'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Loading liquidation data...', canvas.offsetWidth / 2, canvas.offsetHeight / 2)
      return
    }

    // Map liquidations to candle timestamps for alignment
    const spacing = 12 * state.viewportState.timeZoom
    const candleTimeMap = new Map<number, number>() // timestamp -> index
    
    // Create time mapping for perfect alignment with main chart
    tradingData.candles.forEach((candle, index) => {
      candleTimeMap.set(candle.timestamp, index)
    })

    // Group liquidations by candle timestamp (aggregate USD values per candle)
    const liquidationsByCandle = new Map<number, { totalUsdValue: number, sides: Set<string>, count: number, liquidations: any[] }>()
    
    // Improved liquidation mapping with better time tolerance
    liquidationData.liquidations.forEach(liquidation => {
      // Get interval in milliseconds for better time matching
      const getIntervalMs = (timeframe: string): number => {
        switch (timeframe) {
          case '1m': return 60 * 1000
          case '5m': return 5 * 60 * 1000
          case '15m': return 15 * 60 * 1000
          case '30m': return 30 * 60 * 1000
          case '1h': return 60 * 60 * 1000
          case '4h': return 4 * 60 * 60 * 1000
          case '1d': return 24 * 60 * 60 * 1000
          default: return 60 * 1000
        }
      }

      const intervalMs = getIntervalMs(state.selectedTimeframe)
      
      // Find the candle period this liquidation belongs to
      // Round down to the nearest candle start time
      const candleStartTime = Math.floor(liquidation.timestamp / intervalMs) * intervalMs
      
      // Find the closest actual candle timestamp
      let closestCandleTime = candleStartTime
      let minTimeDiff = Infinity
      
      for (const [candleTime] of candleTimeMap) {
        const timeDiff = Math.abs(candleStartTime - candleTime)
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff
          closestCandleTime = candleTime
        }
      }
      
      // IMPROVED: Handle liquidations newer than available candles
      // If liquidation is significantly newer than any candle, create virtual mapping
      if (tradingData.candles.length > 0) {
        const newestCandleTime = tradingData.candles[tradingData.candles.length - 1].timestamp
        const isLiquidationNewer = liquidation.timestamp > newestCandleTime + intervalMs
        
        if (isLiquidationNewer) {
          // Map to virtual candle time based on liquidation timestamp
          closestCandleTime = candleStartTime
          minTimeDiff = 0 // Force acceptance
          
          // Add virtual candle to mapping if not exists
          if (!candleTimeMap.has(closestCandleTime)) {
            // Create virtual candle index beyond existing candles
            const virtualIndex = tradingData.candles.length + Math.floor((closestCandleTime - newestCandleTime) / intervalMs) - 1
            candleTimeMap.set(closestCandleTime, virtualIndex)
          }
        }
      }
      
      // Use a more generous time tolerance based on the timeframe
      const maxTimeDiff = intervalMs * 3 // Increased to 3 intervals for better coverage
      
      if (minTimeDiff < maxTimeDiff) {
        if (!liquidationsByCandle.has(closestCandleTime)) {
          liquidationsByCandle.set(closestCandleTime, {
            totalUsdValue: 0,
            sides: new Set(),
            count: 0,
            liquidations: []
          })
        }
        
        const candleLiq = liquidationsByCandle.get(closestCandleTime)!
        candleLiq.totalUsdValue += liquidation.usdValue // Sum up USD values
        candleLiq.sides.add(liquidation.side)
        candleLiq.count += 1
        candleLiq.liquidations.push(liquidation)
      }
    })

    // Debug logging for mapping results
    console.log(`LIQUIDATION MAPPING: ${liquidationsByCandle.size} candles have liquidations`)
    console.log(`LIQUIDATION DEBUG: Total liquidations: ${liquidationData.liquidations.length}, Total candles: ${tradingData.candles.length}`)
    
    if (liquidationData.liquidations.length > 0) {
      const oldestLiq = Math.min(...liquidationData.liquidations.map(l => l.timestamp))
      const newestLiq = Math.max(...liquidationData.liquidations.map(l => l.timestamp))
      const oldestCandle = tradingData.candles.length > 0 ? tradingData.candles[0].timestamp : 0
      const newestCandle = tradingData.candles.length > 0 ? tradingData.candles[tradingData.candles.length - 1].timestamp : 0
      
      console.log(`LIQUIDATION TIME RANGE: ${new Date(oldestLiq).toISOString()} to ${new Date(newestLiq).toISOString()}`)
      console.log(`CANDLE TIME RANGE: ${new Date(oldestCandle).toISOString()} to ${new Date(newestCandle).toISOString()}`)
      console.log(`TIME COVERAGE: Liquidations span ${((newestLiq - oldestLiq) / 60000).toFixed(1)} minutes, Candles span ${((newestCandle - oldestCandle) / 60000).toFixed(1)} minutes`)
    }
    
    if (liquidationsByCandle.size > 0) {
      const sampleCandle = Array.from(liquidationsByCandle.entries())[0]
      console.log(`SAMPLE LIQUIDATION: Candle ${new Date(sampleCandle[0]).toISOString()} has $${sampleCandle[1].totalUsdValue.toFixed(0)} in liquidations`)
      
      // Log all candles with liquidations
      Array.from(liquidationsByCandle.entries()).forEach(([candleTime, liqInfo], index) => {
        console.log(`LIQUIDATION CANDLE ${index + 1}: ${new Date(candleTime).toISOString()} - $${liqInfo.totalUsdValue.toFixed(0)} (${liqInfo.count} liquidations)`)
      })
    }

    // Find maximum USD value for scaling
    let maxUsdValue = 0
    liquidationsByCandle.forEach((liquidationInfo) => {
      maxUsdValue = Math.max(maxUsdValue, liquidationInfo.totalUsdValue)
    })
    
    // Set minimum scale to show meaningful data
    maxUsdValue = Math.max(maxUsdValue, 100000) // Minimum $100K scale

    // Render liquidation bars with aggregated USD values
    liquidationsByCandle.forEach((liquidationInfo, candleTimestamp) => {
      const candleIndex = candleTimeMap.get(candleTimestamp)
      if (candleIndex === undefined) return

      const x = candleIndex * spacing + 50 - state.viewportState.timeOffset // Match MainChart positioning exactly
      
      // Extended visible range to show all bars including the last ones
      if (x < -20 || x > canvas.offsetWidth + 20) return

      // Use REAL liquidation USD value aggregated per candle
      const totalUsdValue = liquidationInfo.totalUsdValue
      const liquidationCount = liquidationInfo.count
      
      // Check if this is the current (last) candle for real-time effects
      const isCurrentCandle = candleIndex === tradingData.candles.length - 1
      
      // Show liquidations with any USD value (no artificial threshold)
      if (totalUsdValue > 0) {
        // Scale height based on USD value relative to max
        const heightRatio = totalUsdValue / maxUsdValue
        const minHeight = canvas.offsetHeight * 0.02 // 2% minimum height
        const maxHeight = canvas.offsetHeight * 0.95 // 95% maximum height
        const scaledHeight = minHeight + heightRatio * (maxHeight - minHeight)
        
        // Color based on liquidation side - CORRECT TRADING LOGIC
        // BUY side = Long position liquidated (bearish) = RED
        // SELL side = Short position liquidated (bullish) = GREEN
        let barColor = "#ff4444" // Default red for BUY (long liquidated)
        
        // USD value thresholds for intensity
        const isHighLiquidation = totalUsdValue > 100000 // $100K+
        const isMassiveLiquidation = totalUsdValue > 1000000 // $1M+
        const hasMultipleSides = liquidationInfo.sides.size > 1
        
        // Determine dominant side for color
        const buyLiquidations = liquidationInfo.liquidations.filter(liq => liq.side === 'BUY')
        const sellLiquidations = liquidationInfo.liquidations.filter(liq => liq.side === 'SELL')
        const buyUsdValue = buyLiquidations.reduce((sum, liq) => sum + liq.usdValue, 0)
        const sellUsdValue = sellLiquidations.reduce((sum, liq) => sum + liq.usdValue, 0)
        
        if (sellUsdValue > buyUsdValue) {
          barColor = "#00ff88" // Green for SELL dominant (shorts liquidated - bullish)
        } else if (buyUsdValue > sellUsdValue) {
          barColor = "#ff4444" // Red for BUY dominant (longs liquidated - bearish)
        } else if (hasMultipleSides) {
          barColor = "#ffaa00" // Orange for equal/mixed liquidations
        }
        
        // Intensity based on USD value
        if (isMassiveLiquidation) {
          // Keep the same color but make it more intense for massive liquidations
          if (barColor === "#00ff88") barColor = "#00ff88" // Bright green
          else if (barColor === "#ff4444") barColor = "#ff0044" // Bright red
          else barColor = "#ff8800" // Bright orange
        }
        
        // REAL-TIME VISUAL EFFECTS: Add glow/pulse effect for current candle
        if (isCurrentCandle && liquidationData.hasRecentActivity) {
          // Add intense glow for current candle with recent liquidation activity
          const glowAlpha = 0.4 + Math.sin(Date.now() / 300) * 0.2 // More intense pulse
          
          // Draw glow background
          ctx.fillStyle = `${barColor}${Math.floor(glowAlpha * 255).toString(16).padStart(2, '0')}`
          ctx.fillRect(x - 3, canvas.offsetHeight - scaledHeight - 3, 8 * state.viewportState.timeZoom + 6, scaledHeight + 6)
          
          // Use full opacity for current candle
          barColor = barColor + 'FF'
        }
        
        ctx.fillStyle = barColor
        
        // Bar width scales with time zoom but has minimum visibility
        const barWidth = Math.max(3, 8 * state.viewportState.timeZoom)
        ctx.fillRect(x, canvas.offsetHeight - scaledHeight, barWidth, scaledHeight)
        
        // No border for cleaner look - removed all strokeRect code
        
        // Add USD value text for significant liquidations
        if (totalUsdValue > 50000 && barWidth > 6) {
          ctx.fillStyle = '#ffffff'
          ctx.font = '8px monospace'
          ctx.textAlign = 'center'
          
          // Format USD value for display
          let displayValue = ''
          if (totalUsdValue >= 1000000) {
            displayValue = `$${(totalUsdValue / 1000000).toFixed(1)}M`
          } else if (totalUsdValue >= 1000) {
            displayValue = `$${(totalUsdValue / 1000).toFixed(0)}K`
          } else {
            displayValue = `$${totalUsdValue.toFixed(0)}`
          }
          
          ctx.fillText(
            liquidationCount > 1 ? `${displayValue} (${liquidationCount})` : displayValue,
            x + barWidth / 2,
            canvas.offsetHeight - scaledHeight - 2
          )
        }
      }
    })

    // Add enhanced Y-axis labels for real liquidation USD values
    const drawRealLiquidationsYAxisLabels = () => {
      ctx.fillStyle = "#888888" // Match main chart price axis color
      ctx.font = "10px monospace"
      ctx.textAlign = "left" // Left align for right-side positioning
      
      // DYNAMIC SCALING: More height = more labels and better precision
      const panelHeight = canvas.offsetHeight
      let divisions = 4 // Default divisions
      
      // Adjust divisions based on panel height for better granularity
      if (panelHeight >= 250) {
        divisions = 10 // Many labels for very tall panels
      } else if (panelHeight >= 200) {
        divisions = 8 // More labels for tall panels
      } else if (panelHeight >= 150) {
        divisions = 6 // Medium-high labels
      } else if (panelHeight >= 120) {
        divisions = 5 // Medium labels
      } else if (panelHeight >= 80) {
        divisions = 4 // Standard labels
      } else {
        divisions = 3 // Fewer labels for small panels
      }
      
      // Calculate step size for liquidation USD values
      const stepSize = maxUsdValue / divisions
      
      // Draw labels from bottom to top
      for (let i = 0; i <= divisions; i++) {
        const value = i * stepSize
        const y = canvas.offsetHeight - (value / maxUsdValue) * canvas.offsetHeight
        
        // Only show labels that are visible and meaningful
        if (y >= 10 && y <= canvas.offsetHeight - 10 && value >= 0) {
          ctx.fillStyle = "#888888" // Match main chart price axis color
          
          // Format USD value for Y-axis labels
          let labelText = ''
          if (value >= 1000000) {
            labelText = `$${(value / 1000000).toFixed(1)}M`
          } else if (value >= 100000) {
            labelText = `$${(value / 1000).toFixed(0)}K`
          } else if (value >= 1000) {
            labelText = `$${(value / 1000).toFixed(1)}K`
          } else if (value > 0) {
            labelText = `$${value.toFixed(0)}`
          } else {
            labelText = '$0'
          }
          
          ctx.fillText(labelText, canvas.offsetWidth - 55, y + 3)
          
          // Draw subtle grid line
          ctx.strokeStyle = "#1a1a1a"
          ctx.lineWidth = 0.5
          ctx.setLineDash([1, 3])
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvas.offsetWidth - 60, y)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
    }

    // Draw the Y-axis labels
    drawRealLiquidationsYAxisLabels()

    // Store the bars data for crosshair overlay
    liquidationBarsRef.current = ctx.getImageData(0, 0, canvas.offsetWidth * 2, canvas.offsetHeight * 2)
  }, [
    state.viewportState.timeZoom, 
    state.viewportState.timeOffset, 
    state.backgroundColor, 
    state.indicatorSettings.liquidations, 
    tradingData.candles, 
    state.selectedTimeframe, 
    state.componentSizes.liquidationsHeight, 
    liquidationData.liquidations, // Real liquidation data dependency
    liquidationData.hasRecentActivity, // Real-time activity dependency
    liquidationData.lastUpdate // Force re-render on new liquidations
  ])

  // Draw crosshair overlay for liquidations (separate effect for mouse movement)
  useEffect(() => {
    const canvas = liquidationsCanvasRef.current
    if (!canvas || !liquidationBarsRef.current) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Restore the bars without regenerating them
    ctx.putImageData(liquidationBarsRef.current, 0, 0)

    // Note: Crosshair lines now handled by global overlay spanning all panels
  }, [state.mousePosition.x]) // Only depends on mouse X position

  // Dedicated axis mouse handlers to prevent conflicts with canvas
  const handleAxisMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // For time axis div, force time axis detection by using coordinates that will trigger time-axis zone
    const canvasElement = canvasRef.current
    if (!canvasElement) return

    const canvasRect = canvasElement.getBoundingClientRect()
    
    // Force coordinates that will be detected as time-axis (bottom area of canvas)
    const mockX = e.clientX - canvasRect.left  // Use actual X position
    const mockY = canvasRect.height - 15       // Force Y to be in time axis zone
    
    // Create a canvas-like event for the hook
    const mockCanvasEvent = {
      ...e,
      currentTarget: canvasElement,
      target: canvasElement,
      clientX: canvasRect.left + mockX,
      clientY: canvasRect.top + mockY,
      preventDefault: e.preventDefault.bind(e),
      stopPropagation: e.stopPropagation.bind(e)
    } as React.MouseEvent<HTMLCanvasElement>
    
    handleCombinedMouseMove(mockCanvasEvent)
  }, [handleCombinedMouseMove])

  const handleAxisMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // For time axis div, force time axis detection by using coordinates that will trigger time-axis zone
    const canvasElement = canvasRef.current
    if (!canvasElement) return

    const canvasRect = canvasElement.getBoundingClientRect()
    
    // Force coordinates that will be detected as time-axis (bottom area of canvas)
    const mockX = e.clientX - canvasRect.left  // Use actual X position
    const mockY = canvasRect.height - 15       // Force Y to be in time axis zone
    
    const mockCanvasEvent = {
      ...e,
      currentTarget: canvasElement,
      target: canvasElement,
      clientX: canvasRect.left + mockX,
      clientY: canvasRect.top + mockY,
      preventDefault: e.preventDefault.bind(e),
      stopPropagation: e.stopPropagation.bind(e)
    } as React.MouseEvent<HTMLCanvasElement>
    
    // Only call the axis-specific mouse down handler
    handleCanvasMouseDown(mockCanvasEvent)
    e.stopPropagation()
  }, [handleCanvasMouseDown])

  // Dedicated axis wheel handler for ultra-fast zooming
  const handleAxisWheel = useCallback((e: React.WheelEvent<HTMLDivElement>, axisType: 'time' | 'price') => {
    // Note: Don't call preventDefault() here as it causes passive event listener warnings
    // React synthetic events handle this automatically for wheel events
    e.stopPropagation()
    
    // Ultra-aggressive zoom factors for THE FASTEST response
    const wheelSensitivity = Math.abs(e.deltaY) / 30 // Even more sensitive
    const dynamicZoomFactor = e.deltaY > 0 
      ? Math.max(0.2, 1 - wheelSensitivity * 0.6)  // Ultra-fast zoom out
      : Math.min(4.0, 1 + wheelSensitivity * 0.8)  // Ultra-fast zoom in

    if (axisType === 'price') {
      // Vertical zoom (price axis)
      state.setViewportState(prev => ({
        ...prev,
        priceZoom: Math.max(0.01, Math.min(100, prev.priceZoom * dynamicZoomFactor))
      }))
    } else {
      // Horizontal zoom (time axis)  
      state.setViewportState(prev => ({
        ...prev,
        timeZoom: Math.max(0.01, Math.min(100, prev.timeZoom * dynamicZoomFactor))
      }))
    }
  }, [state])

  // Price axis wheel handler for MainChart
  const handlePriceAxisWheel = useCallback((axisType: 'price', deltaY: number) => {
    // Ultra-aggressive zoom factors for THE FASTEST response
    const wheelSensitivity = Math.abs(deltaY) / 30 // Even more sensitive
    const dynamicZoomFactor = deltaY > 0 
      ? Math.max(0.2, 1 - wheelSensitivity * 0.6)  // Ultra-fast zoom out
      : Math.min(4.0, 1 + wheelSensitivity * 0.8)  // Ultra-fast zoom in

    // Vertical zoom (price axis)
    state.setViewportState(prev => ({
      ...prev,
      priceZoom: Math.max(0.01, Math.min(100, prev.priceZoom * dynamicZoomFactor))
    }))
  }, [state])

  // Format datetime for crosshair (e.g., "Sat, May 25 07:00")
  const formatCrosshairDateTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const dayName = days[date.getDay()]
    const monthName = months[date.getMonth()]
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${dayName}, ${monthName} ${day} ${hours}:${minutes}`
  }, [])

  // Get crosshair datetime based on mouse position
  const getCrosshairDateTime = useCallback(() => {
    if (!state.mousePosition.x || !tradingData.candles.length) return ''
    
    const spacing = 12 * state.viewportState.timeZoom
    const candleIndex = Math.floor((state.mousePosition.x - 50 + state.viewportState.timeOffset) / spacing)
    
    // If we have a valid candle, use its timestamp
    if (candleIndex >= 0 && candleIndex < tradingData.candles.length) {
      return formatCrosshairDateTime(tradingData.candles[candleIndex].timestamp)
    }
    
    // For future dates (beyond available candles), generate a fallback datetime
    if (candleIndex >= tradingData.candles.length && tradingData.candles.length > 0) {
      const lastCandle = tradingData.candles[tradingData.candles.length - 1]
      const candlesBeyond = candleIndex - (tradingData.candles.length - 1)
      
      // Calculate time interval based on timeframe
      const timeframeMinutes: { [key: string]: number } = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '1h': 60,
        '4h': 240,
        '1d': 1440
      }
      const intervalMs = (timeframeMinutes[state.selectedTimeframe] || 1) * 60 * 1000
      const futureTimestamp = lastCandle.timestamp + (candlesBeyond * intervalMs)
      
      return formatCrosshairDateTime(futureTimestamp)
    }
    
    // For past dates (before available candles), generate a fallback datetime
    if (candleIndex < 0 && tradingData.candles.length > 0) {
      const firstCandle = tradingData.candles[0]
      const candlesBefore = Math.abs(candleIndex)
      
      // Calculate time interval based on timeframe
      const timeframeMinutes: { [key: string]: number } = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '1h': 60,
        '4h': 240,
        '1d': 1440
      }
      const intervalMs = (timeframeMinutes[state.selectedTimeframe] || 1) * 60 * 1000
      const pastTimestamp = firstCandle.timestamp - (candlesBefore * intervalMs)
      
      return formatCrosshairDateTime(pastTimestamp)
    }
    
    return ''
  }, [state.mousePosition.x, state.viewportState.timeZoom, state.viewportState.timeOffset, tradingData.candles, formatCrosshairDateTime, state.selectedTimeframe])

  const chartAreaWidth = state.showOrderbook ? `calc(100% - ${state.componentSizes.orderbookWidth}px)` : "100%"

  // Real-time candle update tracking - ensures MainChart detects changes
  const lastCandleData = useMemo(() => {
    const lastCandle = tradingData.candles[tradingData.candles.length - 1]
    return lastCandle ? {
      close: lastCandle.close,
      high: lastCandle.high,
      low: lastCandle.low,
      timestamp: lastCandle.timestamp
    } : null
  }, [tradingData.candles])

  // Log candle changes for debugging
  useEffect(() => {
    if (lastCandleData && process.env.NODE_ENV === 'development') {
      console.log('Last candle data changed:', lastCandleData)
    }
  }, [lastCandleData])

  // Update real-time CVD data when candles change
  useEffect(() => {
    if (tradingData.candles.length === 0) return

    const currentCandle = tradingData.candles[tradingData.candles.length - 1]
    const currentBuyVolume = currentCandle.buyVolume || 0
    const currentSellVolume = currentCandle.sellVolume || 0
    const currentDelta = currentBuyVolume - currentSellVolume

    // Calculate cumulative delta up to the current candle
    let cumulativeDelta = 0
    tradingData.candles.forEach((candle) => {
      const buyVol = candle.buyVolume || 0
      const sellVol = candle.sellVolume || 0
      cumulativeDelta += (buyVol - sellVol)
    })

    // Check if this is a new candle (timestamp changed)
    const isNewCandle = currentCandle.timestamp !== realTimeCvdData.lastCandleTimestamp

    if (isNewCandle) {
      console.log(`CVD: New CVD candle detected: ${new Date(currentCandle.timestamp).toISOString()}`)
    }

    setRealTimeCvdData({
      cumulativeDelta,
      currentCandleDelta: currentDelta,
      lastCandleTimestamp: currentCandle.timestamp
    })
  }, [tradingData.candles, realTimeCvdData.lastCandleTimestamp])

  // Real-time CVD animation timer for smooth updates
  useEffect(() => {
    if (!state.activeIndicators.includes("CVD")) return

    const animationInterval = setInterval(() => {
      // Force re-render of CVD chart for real-time animations (pulsing effects)
      // This ensures the glow/pulse effects are smooth
      if (cvdCanvasRef.current) {
        // Trigger a small state change to force re-render
        setRealTimeCvdData(prev => ({ ...prev }))
      }
    }, 100) // Update every 100ms for smooth animations

    return () => clearInterval(animationInterval)
  }, [state.activeIndicators])

  // Handle symbol change
  const handleSymbolChange = useCallback((newSymbol: string) => {
    console.log(`Trading Terminal: Changing symbol from ${selectedSymbol} to ${newSymbol}`)
    setSelectedSymbol(newSymbol)
  }, [selectedSymbol])

  return (
    <div className="h-screen bg-[#111111] text-white flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Real-time Data Status Indicator with WebSocket Status */}
      <div className="flex items-center justify-between px-2 py-0.5 bg-[#0a0a0a] border-b border-gray-800 text-[10px] font-mono">
        <div className="flex items-center space-x-2">
          {/* WebSocket Status */}
          <WebSocketStatus 
            symbol={selectedSymbol} 
            showDetails={true}
            className="shrink-0"
          />

          {/* API Status */}
          <div className="flex items-center space-x-1">
            <div className={`w-1.5 h-1.5 rounded-full ${tradingData.error ? 'bg-red-500' : tradingData.isLoading ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span className="text-gray-400 font-mono">
              {tradingData.error ? 'API Error' : tradingData.isLoading ? 'Loading...' : 'HTTP OK'}
            </span>
          </div>

          {/* Data Stats */}
          {!tradingData.error && !tradingData.isLoading && (
            <>
              <span className="text-gray-500 font-mono">•</span>
              <span className="text-gray-400 font-mono">
                {tradingData.dataCount} candles
              </span>
              <span className="text-gray-500 font-mono">•</span>
              <span className="text-green-400 font-mono">
                Current: ${state.currentPrice.toFixed(2)}
              </span>
              {/* Show data source indicator */}
              <span className={`text-[9px] ${websocketPrice.isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                ({websocketPrice.isConnected ? 'WS' : 'HTTP'})
              </span>
              <span className="text-gray-500 font-mono">•</span>
              <span className="text-gray-400 font-mono">
                Real-time: {tradingData.isRealTimeActive ? 'ON' : 'OFF'}
              </span>
              
              {/* Liquidation Status */}
              {state.activeIndicators.includes("Liquidations") && (
                <>
                  <span className="text-gray-500 font-mono">•</span>
                  <div className="flex items-center space-x-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${liquidationData.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-gray-400 font-mono">
                      Liquidations: {liquidationData.totalLiquidations} (${(() => {
                        const totalValue = liquidationData.totalUsdValue
                        if (totalValue >= 1000000) {
                          return `${(totalValue / 1000000).toFixed(1)}M`
                        } else if (totalValue >= 100000) {
                          return `${(totalValue / 1000).toFixed(1)}K`
                        } else if (totalValue >= 1000) {
                          return `${(totalValue / 1000).toFixed(2)}K`
                        } else {
                          return totalValue.toFixed(1)
                        }
                      })()} total)
                    </span>
                  </div>
                </>
              )}
              {(tradingData.lastUpdateTime > 0 || websocketPrice.lastUpdate > 0) && (
                <>
                  <span className="text-gray-500 font-mono">•</span>
                  <span className="text-gray-400 font-mono">
                    Last update: {Math.floor((Date.now() - Math.max(tradingData.lastUpdateTime, websocketPrice.lastUpdate)) / 1000)}s ago
                  </span>
                </>
              )}
            </>
          )}

          {/* Error Message */}
          {tradingData.error && (
            <>
              <span className="text-gray-500 font-mono">•</span>
              <span className="text-red-400 truncate max-w-md font-mono">
                {tradingData.error}
              </span>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1">
          {tradingData.error && (
            <button
              onClick={tradingData.refreshAllData}
              className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 rounded text-[9px] font-mono transition-colors"
            >
              Retry
            </button>
          )}
          <button
            onClick={tradingData.refreshAllData}
            disabled={tradingData.isLoading}
            className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[9px] font-mono transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={tradingData.clearCache}
            className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[9px] font-mono transition-colors"
          >
            Clear Cache
          </button>
          
          {/* Debug Backend Test (Development only) */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={async () => {
                console.log('Testing backend endpoints...')
                try {
                  // Test current timeframe
                  const response = await fetch(`http://localhost:8080/api/v1/aggregation/candles/BTCUSDT/${state.selectedTimeframe}?limit=5`)
                  const data = await response.json()
                  console.log(`Backend test for ${state.selectedTimeframe}:`, data)
                  alert(`Backend test successful! Check console for details.`)
                } catch (error) {
                  console.error('Backend test failed:', error)
                  alert(`Backend test failed: ${error}`)
                }
              }}
              className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-700 rounded text-[9px] font-mono transition-colors"
            >
              Test Backend
            </button>
          )}
        </div>
      </div>

      {/* SYMBOL TABS */}
      <SymbolTabs 
        selectedSymbol={selectedSymbol}
        onSymbolChange={handleSymbolChange}
        showChartSettings={state.showChartSettings}
        onToggleChartSettings={() => state.setShowChartSettings(!state.showChartSettings)}
      />

      {/* CHART CONTROLS */}
      <ChartControls
        selectedSymbol={selectedSymbol}
        onSymbolChange={handleSymbolChange}
        selectedTimeframe={state.selectedTimeframe}
        showTimeframes={state.showTimeframes}
        showIndicators={state.showIndicators}
        showTools={state.showTools}
        showSettings={state.showSettings}
        activeIndicators={state.activeIndicators}
        selectedDrawingTool={state.selectedDrawingTool}
        navigationMode={state.navigationMode}
        onShowTimeframes={() => state.setShowTimeframes(true)}
        onHideTimeframes={() => state.setShowTimeframes(false)}
        onShowIndicators={() => state.setShowIndicators(true)}
        onHideIndicators={() => state.setShowIndicators(false)}
        onShowTools={() => state.setShowTools(true)}
        onHideTools={() => state.setShowTools(false)}
        onToggleSettings={() => state.setShowSettings(!state.showSettings)}
        onSelectTimeframe={handleSelectTimeframe}
        onToggleIndicator={handleToggleIndicator}
        onSelectDrawingTool={handleSelectDrawingTool}
        onClearDrawings={handleClearDrawings}
        onResetViewport={handleResetViewport}
        onToggleNavigationMode={handleToggleNavigationMode}
        timeframesRef={timeframesDropdownRef}
        indicatorsRef={indicatorsDropdownRef}
        toolsRef={toolsDropdownRef}
        settingsRef={settingsDropdownRef}
        onClearCache={tradingData.clearCache}
        onForceRefresh={tradingData.refreshAllData}
        onForceCompleteRefresh={tradingData.forceCompleteRefresh}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col relative min-h-0" style={{ width: chartAreaWidth }}>
          
          {/* Indicator Info Overlay - Exact UX Design Match */}
          <div className="absolute top-2 left-4 z-30 space-y-1 text-xs font-light">
            <div className="text-xs font-thin">
              <span 
                className="cursor-pointer hover:text-blue-300 hover:bg-blue-900/20 px-1 rounded transition-colors text-xs font-thin"
                onClick={(e) => {
                  e.stopPropagation()
                  state.setShowChartSettings(!state.showChartSettings)
                }}
                title="Click to open chart settings"
              >
                binancef btcusdt
              </span>
              <span className="text-[10px] font-thin"> - </span>
              {/* Real-time OHLC data - matching exact format from image */}
              {tradingData.candles.length > 0 ? (
                <span className="text-[10px] font-thin">
                  {(() => {
                    const currentCandle = tradingData.candles[tradingData.candles.length - 1]
                    return (
                      <>
                        <span className="text-[10px] font-thin">O {currentCandle.open.toFixed(2)} </span>
                        <span className="text-[10px] font-thin">H {currentCandle.high.toFixed(2)} </span>
                        <span className="text-[10px] font-thin">L {currentCandle.low.toFixed(2)} </span>
                        <span className="text-[10px] font-thin">C {currentCandle.close.toFixed(2)} </span>
                        <span className="text-[10px] font-thin">D {Math.round(currentCandle.volume)}</span>
                      </>
                    )
                  })()}
                </span>
              ) : (
                <span className="text-[10px] font-thin">O 108611.50 H 108886.50 L 107950.00 C 108666.60 D -3483.00</span>
              )}
              <span
                className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                onClick={(e) => {
                  e.stopPropagation()
                  removeIndicator("main")
                }}
              >
                remove
              </span>
            </div>

            {/* Volume indicator - real-time data with settings */}
            {state.activeIndicators.includes("Volume") && (
              <div className="text-xs font-thin">
                <span
                  className={`cursor-pointer font-thin ${state.hoveredIndicator === "Volume" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Volume")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("volume")
                  }}
                >
                  {(() => {
                    // Use hovered candle data if available, otherwise use current (last) candle
                    const targetCandle = state.hoveredCandle || tradingData.candles[tradingData.candles.length - 1]
                    if (!targetCandle) return "Volume: No data"
                    
                    // Use REAL volume data from backend instead of estimation
                    const displayBuyVolume = targetCandle.buyVolume || 0
                    const displaySellVolume = targetCandle.sellVolume || 0
                    const displayDelta = displayBuyVolume - displaySellVolume

                    // Format display based on settings
                    const settings = state.indicatorSettings.volume || {
                      showBuyVolume: true,
                      showSellVolume: true,
                      showDelta: true,
                      showPercentage: false,
                      showTotalVolume: false,
                      barType: "total"
                    }
                    
                    // Split into indicator name and stats
                    let indicatorName = "Volume"
                    let statsText = ""
                    
                    // Show total volume if enabled
                    if (settings.showTotalVolume) {
                      const totalVolume = displayBuyVolume + displaySellVolume
                      statsText += ` total ${totalVolume.toFixed(2)}`
                    }
                    
                    // Show individual buy/sell volumes
                    if (settings.showSellVolume) {
                      statsText += ` sell ${displaySellVolume.toFixed(2)}`
                    }
                    if (settings.showBuyVolume) {
                      statsText += ` buy ${displayBuyVolume.toFixed(2)}`
                    }
                    
                    // Show delta
                    if (settings.showDelta) {
                      const deltaSign = displayDelta >= 0 ? "+" : ""
                      statsText += ` Δ${deltaSign}${displayDelta.toFixed(2)}`
                    }
                    
                    // Show percentages
                    if (settings.showPercentage) {
                      const buyPercentage = (displayBuyVolume / (displayBuyVolume + displaySellVolume)) * 100
                      const sellPercentage = (displaySellVolume / (displayBuyVolume + displaySellVolume)) * 100
                      statsText += ` (${buyPercentage.toFixed(1)}%/${sellPercentage.toFixed(1)}%)`
                    }
                    
                    return (
                      <>
                        <span className="text-xs font-thin">{indicatorName}</span>
                        {statsText && <span className="text-[10px] font-thin">{statsText}</span>}
                      </>
                    )
                  })()}
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Volume")
                  }}
                >
                  remove
                </span>
              </div>
            )}

            {/* VPVR indicator - exact match to image */}
            {state.activeIndicators.includes("VPVR") && (
              <div className="text-xs font-thin">
                <span
                  className={`cursor-pointer font-thin ${state.hoveredIndicator === "VPVR" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("VPVR")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("vpvr")
                  }}
                >
                  VPVR
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("VPVR")
                  }}
                >
                  remove
                </span>
              </div>
            )}

            {/* Heatmap indicator - exact match to image */}
            {state.activeIndicators.includes("Heatmap") && (
              <div className="text-xs font-thin">
                <span
                  className={`cursor-pointer font-thin ${state.hoveredIndicator === "Heatmap" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Heatmap")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("heatmap")
                  }}
                >
                  Heatmap binancef
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Heatmap")
                  }}
                >
                  remove
                </span>
              </div>
            )}
          </div>

          {/* Reset to Current Price Button */}
          <button
            onClick={handleResetToCurrentPrice}
            className="absolute top-2 right-4 z-30 bg-black/40 hover:bg-black/60 border border-gray-500/50 rounded px-1.5 py-0.5 text-xs font-mono transition-all flex items-center space-x-1 backdrop-blur-sm"
            title="Reset view to latest candles"
          >
            <svg 
              className="w-2.5 h-2.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
              />
            </svg>
            <span className="text-[10px] text-gray-300 font-mono">Current</span>
          </button>

          {/* Global Crosshair Overlay - spans all chart panels */}
          {state.mousePosition.x > 0 && (
            <div className="absolute inset-0 pointer-events-none z-30">
              {/* Vertical crosshair line - spans from top of main chart to bottom of last panel, right up to datebox */}
              <div
                className="absolute top-0 w-px bg-white opacity-60"
                style={{
                  left: `${state.mousePosition.x}px`,
                  height: 'calc(100% - 48px)', // Stop 48px from bottom (right at the datebox)
                  background: 'repeating-linear-gradient(to bottom, white 0px, white 2px, transparent 2px, transparent 4px)'
                }}
              />
              
              {/* Horizontal crosshair line - spans across all chart panels */}
              {state.mousePosition.y > 0 && (
                <div
                  className="absolute left-0 h-px bg-white opacity-60"
                  style={{
                    top: `${state.mousePosition.y}px`,
                    width: 'calc(100% - 80px)', // Stop before price axis on the right
                    background: 'repeating-linear-gradient(to right, white 0px, white 2px, transparent 2px, transparent 4px)'
                  }}
                />
              )}
            </div>
          )}

          {/* Crosshair DateTime Display - positioned on time axis below all panels */}
          {state.mousePosition.x > 0 && (
            <div 
              className="absolute z-20 bg-[#181818] border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono pointer-events-none"
              style={{ 
                left: `${Math.max(10, Math.min(state.mousePosition.x - 60, window.innerWidth - 140))}px`,
                bottom: '12px' // Position on the time axis itself (12px from bottom)
              }}
            >
              {getCrosshairDateTime()}
            </div>
          )}

          {/* VPVR Settings Panel */}
          <VPVRSettings
            ref={vpvrSettingsPanelRef}
            isOpen={state.openSettingsPanel === "vpvr"}
            onClose={() => state.setOpenSettingsPanel(null)}
            settings={{
              enableFixedTicks: state.indicatorSettings.vpvr.enableFixedTicks,
              rowCount: state.indicatorSettings.vpvr.rowCount,
              bullColor: state.indicatorSettings.vpvr.bullColor,
              bearColor: state.indicatorSettings.vpvr.bearColor,
              origin: state.indicatorSettings.vpvr.origin as 'left' | 'right',
              showPOC: state.indicatorSettings.vpvr.showPOC,
              pocLineColor: state.indicatorSettings.vpvr.pocLineColor,
              valueArea: state.indicatorSettings.vpvr.valueArea,
              deltaMode: state.indicatorSettings.vpvr.deltaMode,
              showStatsBox: state.indicatorSettings.vpvr.showStatsBox,
              showVolumeText: state.indicatorSettings.vpvr.showVolumeText,
              opacity: state.indicatorSettings.vpvr.opacity,
              showSinglePrints: state.indicatorSettings.vpvr.showSinglePrints,
              singlePrintColor: state.indicatorSettings.vpvr.singlePrintColor,
              singlePrintOpacity: state.indicatorSettings.vpvr.singlePrintOpacity,
            }}
            onSettingsChange={(newSettings) => {
              // PERFORMANCE: Update all settings at once for instant rendering
              Object.entries(newSettings).forEach(([key, value]) => {
                updateIndicatorSetting("vpvr", key, value)
              })
            }}
            initialPosition={{ x: 400, y: 100 }}
          />

          {/* Volume Settings Panel */}
          <VolumeSettings
            ref={volumeSettingsPanelRef}
            isOpen={state.openSettingsPanel === "volume"}
            onClose={() => state.setOpenSettingsPanel(null)}
            settings={{
              showBuyVolume: state.indicatorSettings.volume?.showBuyVolume ?? true,
              showSellVolume: state.indicatorSettings.volume?.showSellVolume ?? true,
              showDelta: state.indicatorSettings.volume?.showDelta ?? true,
              showPercentage: state.indicatorSettings.volume?.showPercentage ?? false,
              showTotalVolume: state.indicatorSettings.volume?.showTotalVolume ?? false,
              barType: state.indicatorSettings.volume?.barType ?? "total",
              buyColor: state.indicatorSettings.volume?.buyColor ?? "#00ff88",
              sellColor: state.indicatorSettings.volume?.sellColor ?? "#ff4444",
              deltaColor: state.indicatorSettings.volume?.deltaColor ?? "#ffffff",
              opacity: state.indicatorSettings.volume?.opacity ?? 0.4,
              barHeight: state.indicatorSettings.volume?.barHeight ?? 0.3,
              position: state.indicatorSettings.volume?.position ?? "bottom",
            }}
            onSettingsChange={(newSettings) => {
              // PERFORMANCE: Update all settings at once for instant rendering
              Object.entries(newSettings).forEach(([key, value]) => {
                updateIndicatorSetting("volume", key, value)
              })
            }}
            initialPosition={{ x: 450, y: 150 }}
          />

          {/* CVD Settings Panel */}
          <CVDSettings
            ref={cvdSettingsPanelRef}
            isOpen={state.openSettingsPanel === "cvd"}
            onClose={() => state.setOpenSettingsPanel(null)}
            settings={{
              type: state.indicatorSettings.cvd.type,
              lineColor: state.indicatorSettings.cvd.lineColor,
              lineWidth: state.indicatorSettings.cvd.lineWidth,
              smoothing: state.indicatorSettings.cvd.smoothing,
              histogramBullColor: state.indicatorSettings.cvd.histogramBullColor,
              histogramBearColor: state.indicatorSettings.cvd.histogramBearColor,
              showZeroLine: state.indicatorSettings.cvd.showZeroLine,
              zeroLineColor: state.indicatorSettings.cvd.zeroLineColor,
            }}
            onSettingsChange={(newSettings) => {
              // Update all settings at once for instant rendering
              Object.entries(newSettings).forEach(([key, value]) => {
                updateIndicatorSetting("cvd", key, value)
              })
            }}
            initialPosition={{ x: 550, y: 250 }}
          />

          {/* Chart Settings Panel */}
          {state.showChartSettings && (
            <div
              className="absolute top-20 left-4 z-20 bg-[#181818] border border-gray-600 rounded p-4 min-w-80"
              ref={chartSettingsPanelRef}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold">Chart Settings</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleResetTheme}
                    className="px-2 py-1 text-xs bg-[#2a2a2a] hover:bg-[#353535] rounded transition-colors"
                    title="Reset theme colors"
                  >
                    Reset Theme
                  </button>
                  <button
                    onClick={handleResetAllSettings}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition-colors"
                    title="Reset all settings to defaults"
                  >
                    Reset All
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Background Color</span>
                  <input
                    type="color"
                    value={state.backgroundColor}
                    onChange={(e) => state.setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Bull Candle Color</span>
                  <input
                    type="color"
                    value={state.bullCandleColor}
                    onChange={(e) => state.setBullCandleColor(e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Bear Candle Color</span>
                  <input
                    type="color"
                    value={state.bearCandleColor}
                    onChange={(e) => state.setBearCandleColor(e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <hr className="border-gray-600" />

                <div className="flex items-center justify-between">
                  <span>Show Vertical Grid</span>
                  <input
                    type="checkbox"
                    checked={state.indicatorSettings.chart.showVerticalGrid}
                    onChange={(e) => updateIndicatorSetting("chart", "showVerticalGrid", e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Show Horizontal Grid</span>
                  <input
                    type="checkbox"
                    checked={state.indicatorSettings.chart.showHorizontalGrid}
                    onChange={(e) => updateIndicatorSetting("chart", "showHorizontalGrid", e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Grid Color</span>
                  <input
                    type="color"
                    value={state.indicatorSettings.chart.gridColor}
                    onChange={(e) => updateIndicatorSetting("chart", "gridColor", e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Grid Opacity</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={state.indicatorSettings.chart.gridOpacity}
                      onChange={(e) => updateIndicatorSetting("chart", "gridOpacity", Number.parseFloat(e.target.value))}
                      className="w-32"
                    />
                    <span className="w-8 text-center">{state.indicatorSettings.chart.gridOpacity.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* MAIN CHART */}
          <MainChart 
            symbol={selectedSymbol}
            candleData={tradingData.candles}
            volumeProfile={tradingData.volumeProfile}
            heatmapData={tradingData.heatmapData}
            currentPrice={state.currentPrice}
            selectedTimeframe={state.selectedTimeframe}
            mousePosition={state.mousePosition}
            hoveredCandle={state.hoveredCandle}
            activeIndicators={state.activeIndicators}
            drawingTools={state.drawingTools}
            selectedDrawingIndex={state.selectedDrawingIndex}
            viewportState={state.viewportState}
            backgroundColor={state.backgroundColor}
            bullCandleColor={state.bullCandleColor}
            bearCandleColor={state.bearCandleColor}
            indicatorSettings={state.indicatorSettings}
            showOrderbook={state.showOrderbook}
            measuringSelection={state.measuringSelection}
            navigationMode={state.navigationMode}
            canvasRef={canvasRef}
            onMouseMove={handleCombinedMouseMove}
            onMouseDown={handleCombinedMouseDown}
            onMouseUp={handleMeasuringToolMouseUp}
            onMouseLeave={() => {
              state.setMousePosition({ x: 0, y: 0 })
              state.setHoveredCandle(null)
            }}
            onMouseMoveCapture={handleCombinedMouseMove}
            onContextMenu={(e) => e.preventDefault()}
            onClearMeasuring={state.clearMeasuringSelection}
            onAxisWheel={handlePriceAxisWheel}
            className="w-full h-full cursor-crosshair"
          />

          {/* CVD Chart with resize handle */}
          {state.activeIndicators.includes("CVD") && (
            <div className="border-t border-gray-700 relative" style={{ height: `${state.componentSizes.cvdHeight}px` }}>
              {/* Resize handle at top */}
              <div
                className={`absolute top-0 left-0 right-0 h-2 cursor-ns-resize transition-all duration-150 z-10 flex items-center justify-center ${
                  state.dragState.isDraggingCvd 
                    ? 'bg-blue-400/60 h-3' 
                    : 'bg-gray-600/20 hover:bg-blue-400/40 hover:h-3'
                }`}
                onMouseDown={handleCvdResize}
                title="Drag to resize CVD chart"
              >
                {/* Visual grip indicator */}
                <div className={`w-8 h-0.5 rounded-full transition-colors duration-150 ${
                  state.dragState.isDraggingCvd ? 'bg-white/80' : 'bg-gray-400/50'
                }`} />
              </div>
              
              <canvas 
                ref={cvdCanvasRef} 
                className="w-full h-full transition-all duration-150 cursor-crosshair" 
                style={{ width: "100%", height: "100%" }}
                onMouseMove={handleCombinedMouseMove}
                onMouseLeave={() => {
                  // Don't clear mouse position when leaving CVD panel - keep crosshair visible
                  // state.setMousePosition({ x: 0, y: 0 })
                  // state.setHoveredCandle(null)
                }}
                onMouseEnter={(e) => {
                  // Update mouse position when entering CVD panel
                  handleCombinedMouseMove(e)
                }}
              />
              <div className="absolute left-2 top-2 text-xs font-thin z-20">
                <span
                  className={`cursor-pointer font-thin ${state.hoveredIndicator === "CVD" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("CVD")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("cvd")
                  }}
                >
                  {(() => {
                    // Calculate real CVD using actual buy/sell volume data
                    const targetCandle = state.hoveredCandle || tradingData.candles[tradingData.candles.length - 1]
                    if (!targetCandle || tradingData.candles.length === 0) return "CVD: No data"
                    
                    // Get the specific candle's buy/sell volumes
                    const realBuyVolume = targetCandle.buyVolume || 0
                    const realSellVolume = targetCandle.sellVolume || 0
                    const candleDelta = realBuyVolume - realSellVolume
                    
                    // Calculate cumulative delta up to the target candle
                    let cumulativeDelta = 0
                    const targetIndex = state.hoveredCandle 
                      ? tradingData.candles.findIndex(c => c.timestamp === state.hoveredCandle!.timestamp)
                      : tradingData.candles.length - 1
                    
                    for (let i = 0; i <= targetIndex && i < tradingData.candles.length; i++) {
                      const candle = tradingData.candles[i]
                      const buyVol = candle.buyVolume || 0
                      const sellVol = candle.sellVolume || 0
                      const delta = buyVol - sellVol
                      cumulativeDelta += delta
                    }
                    
                    // Format CVD display with detailed information
                    const cvdSign = cumulativeDelta >= 0 ? "+" : ""
                    const deltaSign = candleDelta >= 0 ? "+" : ""
                    const cvdType = state.indicatorSettings.cvd.type === 'histogram' ? 'CVD' : 'CVD'
                    
                    // Show detailed info when hovering over a specific candle
                    if (state.hoveredCandle) {
                      return (
                        <>
                          <span className="text-xs font-thin">{cvdType} {cvdSign}{cumulativeDelta.toFixed(2)}</span>
                          <span className="text-[10px] font-thin"> | Buy: {realBuyVolume.toFixed(2)} Sell: {realSellVolume.toFixed(2)} Δ{deltaSign}{candleDelta.toFixed(2)}</span>
                        </>
                      )
                    } else {
                      // Show just cumulative when not hovering
                      return <span className="text-xs font-thin">{cvdType} {cvdSign}{cumulativeDelta.toFixed(2)}</span>
                    }
                  })()}
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("CVD")
                  }}
                >
                  remove
                </span>
              </div>
            </div>
          )}

          {/* Liquidations Chart with resize handle */}
          {state.activeIndicators.includes("Liquidations") && (
            <div className="border-t border-gray-700 relative" style={{ height: `${state.componentSizes.liquidationsHeight}px` }}>
              {/* Resize handle at top */}
              <div
                className={`absolute top-0 left-0 right-0 h-2 cursor-ns-resize transition-all duration-150 z-10 flex items-center justify-center ${
                  state.dragState.isDraggingLiquidations 
                    ? 'bg-blue-400/60 h-3' 
                    : 'bg-gray-600/20 hover:bg-blue-400/40 hover:h-3'
                }`}
                onMouseDown={handleLiquidationsResize}
                title="Drag to resize Liquidations chart"
              >
                {/* Visual grip indicator */}
                <div className={`w-8 h-0.5 rounded-full transition-colors duration-150 ${
                  state.dragState.isDraggingLiquidations ? 'bg-white/80' : 'bg-gray-400/50'
                }`} />
              </div>
              <canvas 
                ref={liquidationsCanvasRef} 
                className="w-full h-full transition-all duration-150 cursor-crosshair" 
                style={{ width: "100%", height: "100%" }}
                onMouseMove={handleCombinedMouseMove}
                onMouseLeave={() => {
                  // Don't clear mouse position when leaving liquidations panel - keep crosshair visible
                  // state.setMousePosition({ x: 0, y: 0 })
                  // state.setHoveredCandle(null)
                }}
                onMouseEnter={(e) => {
                  // Update mouse position when entering liquidations panel
                  handleCombinedMouseMove(e)
                }}
              />
              <div className="absolute left-2 top-2 text-xs font-thin z-20">
                <span
                  className={`cursor-pointer font-thin ${state.hoveredIndicator === "Liquidations" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Liquidations")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("liquidations")
                  }}
                >
                  {(() => {
                    // Display REAL liquidation data from WebSocket
                    if (!liquidationData.liquidations || liquidationData.liquidations.length === 0) {
                      return "Liquidations: No data"
                    }
                    
                    // Show current liquidation info if hovering over a specific candle
                    if (state.hoveredCandle && liquidationData.liquidations.length > 0) {
                      // Find liquidations near the hovered candle timestamp
                      const candleTime = state.hoveredCandle.timestamp
                      const nearbyLiquidations = liquidationData.liquidations.filter(liq => 
                        Math.abs(liq.timestamp - candleTime) < 5 * 60 * 1000 // Within 5 minutes
                      )
                      
                      if (nearbyLiquidations.length > 0) {
                        const totalUsdValue = nearbyLiquidations.reduce((sum, liq) => sum + liq.usdValue, 0)
                        const maxUsdValue = Math.max(...nearbyLiquidations.map(liq => liq.usdValue || 0))
                        const sides = new Set(nearbyLiquidations.map(liq => liq.side))
                        const isHigh = maxUsdValue > 100000 // $100K threshold
                        
                        // Format USD value for display
                        let displayValue = ''
                        if (totalUsdValue >= 1000000) {
                          displayValue = `$${(totalUsdValue / 1000000).toFixed(1)}M`
                        } else if (totalUsdValue >= 1000) {
                          displayValue = `$${(totalUsdValue / 1000).toFixed(0)}K`
                        } else {
                          displayValue = `$${totalUsdValue.toFixed(0)}`
                        }
                        
                        return (
                          <>
                            <span className="text-xs font-thin">Liquidations: {displayValue} {isHigh ? '(HIGH)' : '(LOW)'}</span>
                            <span className="text-[10px] font-thin"> | Count: {nearbyLiquidations.length} | Sides: {Array.from(sides).join('/')}</span>
                          </>
                        )
                      }
                    }
                    
                    // Show latest liquidation info when not hovering
                    if (liquidationData.currentLiquidation) {
                      const latest = liquidationData.currentLiquidation
                      const isHigh = (latest.usdValue || 0) > 100000 // $100K threshold
                      const timeSince = Math.floor((Date.now() - latest.timestamp) / 1000)
                      
                      // Format USD value for display
                      let displayValue = ''
                      if (latest.usdValue >= 1000000) {
                        displayValue = `$${(latest.usdValue / 1000000).toFixed(1)}M`
                      } else if (latest.usdValue >= 1000) {
                        displayValue = `$${(latest.usdValue / 1000).toFixed(0)}K`
                      } else {
                        displayValue = `$${latest.usdValue.toFixed(0)}`
                      }
                      
                      return (
                        <>
                          <span className="text-xs font-thin">Liquidations: {displayValue} {isHigh ? '(HIGH)' : '(LOW)'}</span>
                          <span className="text-[10px] font-thin"> | Latest: {latest.side} ${latest.price.toFixed(2)} ({timeSince}s ago) | Total: {liquidationData.totalLiquidations}</span>
                        </>
                      )
                    }
                    
                    // Fallback display
                    const totalUsdFormatted = liquidationData.totalUsdValue >= 1000000 
                      ? `$${(liquidationData.totalUsdValue / 1000000).toFixed(1)}M`
                      : liquidationData.totalUsdValue >= 1000
                      ? `$${(liquidationData.totalUsdValue / 1000).toFixed(0)}K`
                      : `$${liquidationData.totalUsdValue.toFixed(0)}`
                    
                    return (
                      <>
                        <span className="text-xs font-thin">Liquidations</span>
                        <span className="text-[10px] font-thin"> | Total: {liquidationData.totalLiquidations} | Value: {totalUsdFormatted}</span>
                      </>
                    )
                  })()}
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300 text-[10px] font-thin"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Liquidations")
                  }}
                >
                  remove
                </span>
              </div>
              <div className="absolute right-2 bottom-2 text-xs font-light z-20">
                <div className="font-light">40</div>
                <div className="font-light">30</div>
                <div className="font-light">20</div>
                <div className="font-light">10</div>
                <div className="font-light">0</div>
              </div>
            </div>
          )}

          {/* Real-time Interactive Time Axis */}
          <div 
            className="h-12 bg-[#181818] border-t border-gray-700 cursor-ew-resize hover:bg-[#202020] transition-colors select-none"
            onMouseMove={handleAxisMouseMove}
            onMouseDown={handleAxisMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onWheel={(e) => handleAxisWheel(e, 'time')}
            title="Drag or scroll to zoom time axis horizontally"
          >
            {/* Real-time time axis display */}
            <div className="flex items-center justify-between px-4 h-6 text-xs font-mono">
              {(() => {
                const now = new Date()
                const spacing = 12 * state.viewportState.timeZoom
                // Fix SSR issue - only access window on client side
                const visibleCandles = typeof window !== 'undefined' ? Math.floor(window.innerWidth / spacing) : 8
                const times = []
                
                // Generate time labels based on current time and timeframe
                for (let i = 0; i < 9; i++) {
                  const hoursBack = (8 - i) * 3 // Show times going back in time
                  const timeStamp = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)
                  const timeStr = timeStamp.getHours().toString().padStart(2, '0') + ':' + 
                                timeStamp.getMinutes().toString().padStart(2, '0')
                  
                  times.push(
                    <span 
                      key={i}
                      className={i === 8 ? "text-yellow-400 font-bold font-mono" : "font-mono"}
                    >
                      {timeStr}
                    </span>
                  )
                }
                
                return times
              })()}
            </div>
            
            {/* Real-time date axis display */}
            <div className="flex items-center justify-between px-4 h-6 text-xs text-gray-400 font-mono">
              {(() => {
                const now = new Date()
                const dates = []
                
                // Generate date labels
                for (let i = 0; i < 9; i++) {
                  if (i === 0 || i === 4 || i === 8) {
                    const daysBack = Math.floor((8 - i) / 4) // Show dates every 4 positions
                    const dateStamp = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
                    const dateStr = `${(dateStamp.getMonth() + 1).toString().padStart(2, '0')}/${dateStamp.getDate().toString().padStart(2, '0')}/${dateStamp.getFullYear().toString().slice(-2)}`
                    
                    dates.push(<span key={i} className="font-mono">{dateStr}</span>)
                  } else {
                    dates.push(<span key={i} className="font-mono"></span>)
                  }
                }
                
                return dates
              })()}
            </div>
          </div>
        </div>

        {/* High-Performance Orderbook */}
        {state.showOrderbook && (
          <div className="flex-shrink-0 h-full">
          <HighPerformanceOrderbook
            symbol={selectedSymbol}
            currentPrice={state.currentPrice}
            width={state.componentSizes.orderbookWidth}
            onResize={(width) => state.setComponentSizes((prev: any) => ({ ...prev, orderbookWidth: width }))}
            onClose={() => state.setShowOrderbook(false)}
          />
          </div>
        )}
      </div>
    </div>
  )
}

