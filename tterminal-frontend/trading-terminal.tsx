/**
 * Trading Terminal - Modular Implementation with Real-time WebSocket Integration
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

export default function TradingTerminal() {
  // State for dynamic symbol selection (can be expanded to support multiple symbols)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  
  // Centralized state management
  const state = useTradingState()
  
  // Real-time WebSocket integration for live price updates
  const websocketPrice = useWebSocketPrice({ 
    symbol: selectedSymbol,
    enabled: true 
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
      state.setCurrentPrice(websocketPrice.price)
    } 
    // Fallback to HTTP data if WebSocket is not available
    else if (tradingData.currentPrice > 0) {
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
  const settingsDropdownRef = useRef<HTMLDivElement>(null)
  const chartSettingsPanelRef = useRef<HTMLDivElement>(null)
  const vpvrSettingsPanelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cvdCanvasRef = useRef<HTMLCanvasElement>(null)
  const liquidationsCanvasRef = useRef<HTMLCanvasElement>(null)

  // Chart interactions hook with real data
  const { handleMouseMove, handleCanvasMouseDown, handleAxisDragEnd, handleMeasuringToolMouseUp, handleWheel } = useChartInteractions({
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

  // Component resize handlers
  const handleCvdResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    state.setDragState(prev => ({
      ...prev,
      isDraggingCvd: true,
      dragStart: { x: e.clientX, y: e.clientY }
    }))
  }, [state.setDragState])

  const handleLiquidationsResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
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
        state.setComponentSizes(prev => ({
          ...prev,
          cvdHeight: Math.max(40, Math.min(300, prev.cvdHeight + deltaY))
        }))
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }

      if (state.dragState.isDraggingLiquidations) {
        const deltaY = state.dragState.dragStart.y - e.clientY
        state.setComponentSizes(prev => ({
          ...prev,
          liquidationsHeight: Math.max(40, Math.min(300, prev.liquidationsHeight + deltaY))
        }))
        state.setDragState(prev => ({
          ...prev,
          dragStart: { x: e.clientX, y: e.clientY }
        }))
      }
    }

    const handleMouseUp = () => {
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

    if (state.dragState.isDraggingChart || state.dragState.isDraggingPrice || state.dragState.isDraggingTime || state.dragState.isDraggingCvd || state.dragState.isDraggingLiquidations || state.isCreatingMeasurement || state.dragState.potentialDrag) {
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

  // Draw CVD chart with extended crosshair
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

    // Draw CVD line with realistic scaling
    ctx.strokeStyle = state.indicatorSettings.cvd.lineColor
    ctx.lineWidth = state.indicatorSettings.cvd.lineWidth
    ctx.beginPath()
    let cvdValue = 0
    const spacing = 12 * state.viewportState.timeZoom
    const maxVolume = Math.max(...tradingData.candles.map(c => c.volume))
    
    tradingData.candles.forEach((candle, index) => {
      // More realistic CVD calculation with proper buy/sell ratio
      const isBullish = candle.close > candle.open
      const priceMove = Math.abs(candle.close - candle.open) / candle.open
      const volumeWeight = isBullish ? 1 + priceMove * 2 : -(1 + priceMove * 2)
      
      cvdValue += volumeWeight * candle.volume
      const x = index * spacing + 50 - state.viewportState.timeOffset
      
      // Scale CVD to fit chart height properly
      const cvdRange = maxVolume * tradingData.candles.length * 0.1 // Estimated range
      const y = canvas.offsetHeight / 2 + (cvdValue / cvdRange) * (canvas.offsetHeight * 0.4)
      
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Draw crosshair vertical line
    if (state.mousePosition.x > 0) {
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(state.mousePosition.x, 0)
      ctx.lineTo(state.mousePosition.x, canvas.offsetHeight)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.mousePosition, state.backgroundColor, state.indicatorSettings.cvd, tradingData.candles])

  // Store liquidation bars data to avoid redrawing on mouse move
  const liquidationBarsRef = React.useRef<ImageData | null>(null)

  // Draw liquidations bars (stable - doesn't change on mouse move)
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

    // Generate stable liquidation data (using candle index as seed for consistency)
    const spacing = 12 * state.viewportState.timeZoom
    tradingData.candles.forEach((candle, index) => {
      const x = index * spacing + 50 - state.viewportState.timeOffset
      if (x < -8 || x > canvas.offsetWidth) return

      // Calculate liquidation intensity based on price volatility and volume
      const priceMove = Math.abs(candle.close - candle.open) / candle.open
      const volumeIntensity = candle.volume / 1000 // More sensitive volume normalization
      const wickSize = (candle.high - candle.low) / candle.close
      
      // Enhanced liquidation calculation to match Market Monkey scale
      const baseIntensity = priceMove * 300 + volumeIntensity * 1.5 + wickSize * 40
      
      // Use candle timestamp as seed for consistent random factor (doesn't change on mouse move)
      const seed = (candle.timestamp * 9301 + index * 49297) % 233280
      const randomFactor = 0.4 + (seed / 233280) * 0.8 // Deterministic "random" based on candle
      const liquidationIntensity = baseIntensity * randomFactor
      
      // Normalize to 0-100 scale for better height distribution
      const normalizedIntensity = Math.min(liquidationIntensity * 10, 100)
      
      // Show liquidations with much lower threshold for more activity
      if (normalizedIntensity > 5) {
        // Scale height to fill component like Market Monkey (5-95% of height)
        const minHeight = canvas.offsetHeight * 0.05 // 5% minimum height
        const maxHeight = canvas.offsetHeight * 0.95 // 95% maximum height
        const scaledHeight = minHeight + (normalizedIntensity / 100) * (maxHeight - minHeight)
        
        const isHighLiquidation = normalizedIntensity > state.indicatorSettings.liquidations.threshold
        ctx.fillStyle = isHighLiquidation ? state.indicatorSettings.liquidations.color : "#00ff88"
        
        // Bar width scales with time zoom but has minimum visibility
        const barWidth = Math.max(3, 8 * state.viewportState.timeZoom)
        ctx.fillRect(x, canvas.offsetHeight - scaledHeight, barWidth, scaledHeight)
      }
    })

    // Store the bars data for crosshair overlay
    liquidationBarsRef.current = ctx.getImageData(0, 0, canvas.offsetWidth * 2, canvas.offsetHeight * 2)
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.backgroundColor, state.indicatorSettings.liquidations, tradingData.candles])

  // Draw crosshair overlay for liquidations (separate effect for mouse movement)
  useEffect(() => {
    const canvas = liquidationsCanvasRef.current
    if (!canvas || !liquidationBarsRef.current) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Restore the bars without regenerating them
    ctx.putImageData(liquidationBarsRef.current, 0, 0)

    // Draw crosshair if mouse is active
    if (state.mousePosition.x > 0) {
      ctx.scale(2, 2)
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(state.mousePosition.x, 0)
      ctx.lineTo(state.mousePosition.x, canvas.offsetHeight)
      ctx.stroke()
      ctx.setLineDash([])
    }
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
    
    handleMouseMove(mockCanvasEvent)
  }, [handleMouseMove])

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
    e.preventDefault()
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
    
    if (candleIndex >= 0 && candleIndex < tradingData.candles.length) {
      return formatCrosshairDateTime(tradingData.candles[candleIndex].timestamp)
    }
    
    return ''
  }, [state.mousePosition.x, state.viewportState.timeZoom, state.viewportState.timeOffset, tradingData.candles, formatCrosshairDateTime])

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
      console.log(`🕯️ Last candle data changed:`, lastCandleData)
    }
  }, [lastCandleData])

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
                console.log('🧪 Testing backend endpoints...')
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

      {/* Symbol Tabs */}
      <SymbolTabs 
        showChartSettings={state.showChartSettings}
        onToggleChartSettings={() => state.setShowChartSettings(!state.showChartSettings)}
      />

      {/* Chart Controls */}
      <ChartControls
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
        onForceRefresh={() => tradingData.forceRefreshInterval(state.selectedTimeframe)}
        onForceCompleteRefresh={() => tradingData.forceCompleteRefresh()}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col relative min-h-0" style={{ width: chartAreaWidth }}>
          
          {/* Indicator Info Overlay - Exact UX Design Match */}
          <div className="absolute top-2 left-4 z-30 space-y-1 text-xs font-mono">
            <div className="text-xs font-mono">
              <span 
                className="cursor-pointer hover:text-blue-300 hover:bg-blue-900/20 px-1 rounded transition-colors text-xs font-mono"
                onClick={(e) => {
                  e.stopPropagation()
                  state.setShowChartSettings(!state.showChartSettings)
                }}
                title="Click to open chart settings"
              >
                binancef btcusdt
              </span>
              <span className="text-xs font-mono"> - </span>
              {/* Real-time OHLC data - matching exact format from image */}
              {tradingData.candles.length > 0 ? (
                <span className="text-xs font-mono">
                  {(() => {
                    const currentCandle = tradingData.candles[tradingData.candles.length - 1]
                    return (
                      <>
                        <span className="text-xs font-mono">O {currentCandle.open.toFixed(2)} </span>
                        <span className="text-xs font-mono">H {currentCandle.high.toFixed(2)} </span>
                        <span className="text-xs font-mono">L {currentCandle.low.toFixed(2)} </span>
                        <span className="text-xs font-mono">C {currentCandle.close.toFixed(2)} </span>
                        <span className="text-xs font-mono">D {Math.round(currentCandle.volume)}</span>
                      </>
                    )
                  })()}
                </span>
              ) : (
                <span className="text-xs font-mono">O 108611.50 H 108886.50 L 107950.00 C 108666.60 D -3483.00</span>
              )}
              <span
                className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 text-xs font-mono"
                onClick={(e) => {
                  e.stopPropagation()
                  removeIndicator("main")
                }}
              >
                remove
              </span>
            </div>

            {/* Volume indicator - exact match to image */}
            {state.activeIndicators.includes("Volume") && (
              <div className="text-xs font-mono">
                <span
                  className={`cursor-pointer font-mono ${state.hoveredIndicator === "Volume" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Volume")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("volume")
                  }}
                >
                  Volume sell 5307.37 buy 4113.91
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 font-mono"
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
              <div className="text-xs font-mono">
                <span
                  className={`cursor-pointer font-mono ${state.hoveredIndicator === "VPVR" ? "bg-blue-800" : ""}`}
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
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 font-mono"
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
              <div className="text-xs font-mono">
                <span
                  className={`cursor-pointer font-mono ${state.hoveredIndicator === "Heatmap" ? "bg-blue-800" : ""}`}
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
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300 font-mono"
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

          {/* Crosshair DateTime Display */}
          {state.mousePosition.x > 0 && getCrosshairDateTime() && (
            <div 
              className="absolute bottom-14 z-20 bg-[#181818] border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono pointer-events-none"
              style={{ 
                left: `${Math.max(10, Math.min(state.mousePosition.x - 60, window.innerWidth - 140))}px` 
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
          
          {/* Main Chart */}
          <MainChart
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
            onMouseMove={handleMouseMove}
            onMouseDown={handleCombinedMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              state.setMousePosition({ x: 0, y: 0 })
              state.setHoveredCandle(null)
            }}
            onMouseMoveCapture={handleCanvasMouseMove}
            onContextMenu={(e) => e.preventDefault()}
            onAxisWheel={handlePriceAxisWheel}
            onClearMeasuring={state.clearMeasuringSelection}
            className="w-full h-full cursor-crosshair"
          />

          {/* CVD Chart with resize handle */}
          {state.activeIndicators.includes("CVD") && (
            <div className="border-t border-gray-700 relative" style={{ height: `${state.componentSizes.cvdHeight}px` }}>
              {/* Resize handle at top */}
              <div
                className="absolute top-0 left-0 right-0 h-1 bg-[#2a2a2a] cursor-ns-resize hover:bg-[#353535] z-10"
                onMouseDown={handleCvdResize}
                title="Drag to resize CVD chart"
              />
              <canvas ref={cvdCanvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
              <div className="absolute left-2 top-2 text-xs font-mono z-20">
                <span
                  className={`cursor-pointer font-mono ${state.hoveredIndicator === "CVD" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("CVD")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("cvd")
                  }}
                >
                  CVD
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300 font-mono"
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
                className="absolute top-0 left-0 right-0 h-1 bg-[#2a2a2a] cursor-ns-resize hover:bg-[#353535] z-10"
                onMouseDown={handleLiquidationsResize}
                title="Drag to resize Liquidations chart"
              />
              <canvas ref={liquidationsCanvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
              <div className="absolute left-2 top-2 text-xs font-mono z-20">
                <span
                  className={`cursor-pointer font-mono ${state.hoveredIndicator === "Liquidations" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Liquidations")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("liquidations")
                  }}
                >
                  Liquidations
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300 font-mono"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Liquidations")
                  }}
                >
                  remove
                </span>
              </div>
              <div className="absolute right-2 bottom-2 text-xs font-mono z-20">
                <div className="font-mono">40</div>
                <div className="font-mono">30</div>
                <div className="font-mono">20</div>
                <div className="font-mono">10</div>
                <div className="font-mono">0</div>
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
            onResize={(width) => state.setComponentSizes(prev => ({ ...prev, orderbookWidth: width }))}
            onClose={() => state.setShowOrderbook(false)}
          />
          </div>
        )}
      </div>
    </div>
  )
}
