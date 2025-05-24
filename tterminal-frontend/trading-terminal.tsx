/**
 * Trading Terminal - Modular Implementation
 * Enterprise-level component architecture for maintainability and scalability
 * 
 * Features:
 * - Modular component structure for better organization
 * - Custom hooks for centralized state management
 * - Reusable utility functions and type definitions
 * - High-performance canvas rendering with optimizations
 * - Interactive drawing tools with keyboard shortcuts
 * - Real-time price updates and multiple indicators
 * 
 * Architecture Benefits:
 * - Single responsibility principle for each component
 * - Easy testing and debugging of individual modules
 * - Improved code reusability and maintainability
 * - Better developer experience with TypeScript support
 */

"use client"

import React, { useRef, useCallback, useEffect } from "react"
import { useTradingState } from './hooks/trading/useTradingState'
import { useChartInteractions } from './hooks/trading/useChartInteractions'
import { TopNavigation } from './components/trading-terminal/controls/TopNavigation'
import { SymbolTabs } from './components/trading-terminal/controls/SymbolTabs'
import { ChartControls } from './components/trading-terminal/controls/ChartControls'
import { MainChart } from './components/trading-terminal/charts/MainChart'
import HighPerformanceOrderbook from './components/orderbook'
import type { CandleData, VolumeProfileEntry, HeatmapData } from './types/trading'

// Sample data - In production, this would come from props or API
const candleData: CandleData[] = [
  { timestamp: Date.now() - 3600000 * 30, open: 111121, high: 111348, low: 111111, close: 111282, volume: 633 },
  { timestamp: Date.now() - 3600000 * 29, open: 111282, high: 111400, low: 111200, close: 111350, volume: 720 },
  { timestamp: Date.now() - 3600000 * 28, open: 111350, high: 111500, low: 111250, close: 111450, volume: 850 },
  { timestamp: Date.now() - 3600000 * 27, open: 111450, high: 111600, low: 111350, close: 111550, volume: 980 },
  { timestamp: Date.now() - 3600000 * 26, open: 111550, high: 111700, low: 111450, close: 111650, volume: 1020 },
  { timestamp: Date.now() - 3600000 * 25, open: 111650, high: 111800, low: 111550, close: 111750, volume: 890 },
  { timestamp: Date.now() - 3600000 * 24, open: 111750, high: 111900, low: 111650, close: 111850, volume: 1110 },
  { timestamp: Date.now() - 3600000 * 23, open: 111850, high: 112000, low: 111750, close: 111950, volume: 1240 },
  { timestamp: Date.now() - 3600000 * 22, open: 111950, high: 112100, low: 111850, close: 112050, volume: 1080 },
  { timestamp: Date.now() - 3600000 * 21, open: 112050, high: 112200, low: 111950, close: 112150, volume: 920 },
  { timestamp: Date.now() - 3600000 * 20, open: 112150, high: 112300, low: 112050, close: 112250, volume: 1170 },
  { timestamp: Date.now() - 3600000 * 19, open: 112250, high: 112400, low: 112150, close: 112350, volume: 1010 },
  { timestamp: Date.now() - 3600000 * 18, open: 112350, high: 112500, low: 112250, close: 112450, volume: 950 },
  { timestamp: Date.now() - 3600000 * 17, open: 112450, high: 112600, low: 112350, close: 112550, volume: 880 },
  { timestamp: Date.now() - 3600000 * 16, open: 112550, high: 112700, low: 112450, close: 112650, volume: 1120 },
  { timestamp: Date.now() - 3600000 * 15, open: 112650, high: 112500, low: 112100, close: 112200, volume: 1750 },
  { timestamp: Date.now() - 3600000 * 14, open: 112200, high: 112250, low: 111800, close: 111900, volume: 1590 },
  { timestamp: Date.now() - 3600000 * 13, open: 111900, high: 112000, low: 111600, close: 111700, volume: 1450 },
  { timestamp: Date.now() - 3600000 * 12, open: 111700, high: 111800, low: 111400, close: 111500, volume: 1620 },
  { timestamp: Date.now() - 3600000 * 11, open: 111500, high: 111600, low: 111200, close: 111300, volume: 1580 },
  { timestamp: Date.now() - 3600000 * 10, open: 111300, high: 111400, low: 111000, close: 111100, volume: 1800 },
  { timestamp: Date.now() - 3600000 * 9, open: 111100, high: 111200, low: 110900, close: 107674, volume: 1550 },
]

const volumeProfile: VolumeProfileEntry[] = [
  { price: 112700, volume: 450, type: "sell" },
  { price: 112600, volume: 680, type: "buy" },
  { price: 112500, volume: 890, type: "sell" },
  { price: 112400, volume: 1200, type: "buy" },
  { price: 112300, volume: 1450, type: "sell" },
  { price: 112200, volume: 1680, type: "buy" },
  { price: 112100, volume: 1320, type: "sell" },
  { price: 112000, volume: 980, type: "buy" },
  { price: 111900, volume: 1150, type: "sell" },
  { price: 111800, volume: 890, type: "buy" },
  { price: 111700, volume: 760, type: "sell" },
  { price: 111600, volume: 650, type: "buy" },
  { price: 111500, volume: 540, type: "sell" },
  { price: 111400, volume: 430, type: "buy" },
  { price: 111300, volume: 320, type: "sell" },
  { price: 111200, volume: 280, type: "buy" },
  { price: 111100, volume: 350, type: "sell" },
  { price: 111000, volume: 420, type: "buy" },
  { price: 110900, volume: 380, type: "sell" },
  { price: 110800, volume: 290, type: "buy" },
]

const heatmapData: HeatmapData[] = [
  { x: 15, y: 8, intensity: 126.968 },
  { x: 16, y: 8, intensity: 166.838 },
  { x: 15, y: 9, intensity: 19.822 },
  { x: 16, y: 9, intensity: 45.155 },
  { x: 15, y: 10, intensity: 32.946 },
  { x: 16, y: 10, intensity: 84.027 },
]

const orderbook = {
  asks: [
    { price: 108000.0, size: 0.026, total: 0.026 },
    { price: 108001.0, size: 0.011, total: 0.037 },
    { price: 108002.0, size: 0.005, total: 0.042 },
    { price: 108003.0, size: 0.002, total: 0.044 },
    { price: 108004.0, size: 0.001, total: 0.045 },
    { price: 108005.0, size: 0.004, total: 0.049 },
    { price: 108006.0, size: 0.007, total: 0.056 },
    { price: 108007.0, size: 0.02, total: 0.076 },
    { price: 108008.0, size: 0.007, total: 0.083 },
    { price: 108009.0, size: 2.178, total: 2.261 },
  ],
  bids: [
    { price: 107674.0, size: 7.926, total: 7.926 },
    { price: 107673.0, size: 1.186, total: 9.112 },
    { price: 107672.0, size: 0.003, total: 9.115 },
    { price: 107671.0, size: 0.002, total: 9.117 },
    { price: 107670.0, size: 0.072, total: 9.189 },
    { price: 107669.0, size: 0.005, total: 9.194 },
    { price: 107668.0, size: 0.002, total: 9.196 },
    { price: 107667.0, size: 0.006, total: 9.202 },
    { price: 107666.0, size: 0.005, total: 9.207 },
    { price: 107665.0, size: 0.235, total: 9.442 },
  ],
}

export default function TradingTerminal() {
  // Centralized state management
  const state = useTradingState()
  
  // Component refs for dropdown management
  const timeframesDropdownRef = useRef<HTMLDivElement>(null)
  const indicatorsDropdownRef = useRef<HTMLDivElement>(null)
  const toolsDropdownRef = useRef<HTMLDivElement>(null)
  const settingsDropdownRef = useRef<HTMLButtonElement>(null)
  const chartSettingsPanelRef = useRef<HTMLDivElement>(null)
  const vpvrSettingsPanelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cvdCanvasRef = useRef<HTMLCanvasElement>(null)
  const liquidationsCanvasRef = useRef<HTMLCanvasElement>(null)

  // Chart interactions hook
  const { handleMouseMove, handleCanvasMouseDown, handleWheel } = useChartInteractions({
    canvasRef,
    candleData,
    drawingMode: state.drawingMode,
    drawingTools: state.drawingTools,
    selectedDrawingIndex: state.selectedDrawingIndex,
    viewportState: state.viewportState,
    dragState: state.dragState,
    setHoveredCandle: state.setHoveredCandle,
    setMousePosition: state.setMousePosition,
    setDrawingTools: state.setDrawingTools,
    setSelectedDrawingIndex: state.setSelectedDrawingIndex,
    setDrawingMode: state.setDrawingMode,
    setSelectedDrawingTool: state.setSelectedDrawingTool,
    setDragState: state.setDragState,
    setViewportState: state.setViewportState,
  })

  /**
   * Chart control handlers
   */
  const handleSelectTimeframe = useCallback((timeframe: string) => {
    state.setSelectedTimeframe(timeframe)
    state.setShowTimeframes(false)
  }, [state])

  const handleToggleIndicator = useCallback((indicator: string) => {
    state.setActiveIndicators(prev =>
      prev.includes(indicator) 
        ? prev.filter(i => i !== indicator) 
        : [...prev, indicator]
    )
  }, [state])

  const handleSelectDrawingTool = useCallback((tool: string) => {
    state.setDrawingMode(tool)
    state.setSelectedDrawingTool(tool)
    state.setShowTools(false)
  }, [state])

  const handleClearDrawings = useCallback(() => {
    state.setDrawingTools([])
    state.setShowTools(false)
  }, [state])

  const removeIndicator = useCallback((indicator: string) => {
    state.setActiveIndicators(prev => prev.filter(i => i !== indicator))
    state.setOpenSettingsPanel(null)
  }, [state])

  const openIndicatorSettings = useCallback((indicator: string) => {
    state.setOpenSettingsPanel(state.openSettingsPanel === indicator ? null : indicator)
  }, [state])

  const updateIndicatorSetting = useCallback((indicator: string, setting: string, value: any) => {
    state.setIndicatorSettings(prev => ({
      ...prev,
      [indicator]: {
        ...prev[indicator as keyof typeof prev],
        [setting]: value,
      },
    }))
  }, [state])

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
    const priceRange = (113000 - 107000) / state.viewportState.priceZoom
    const price = 113000 - ((y - 50 + state.viewportState.priceOffset) / chartHeight) * priceRange

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
  }, [state.drawingMode, state.drawingTools, state.viewportState, state.setDrawingTools])

  const handleCanvasMouseUp = useCallback(() => {
    if (state.drawingMode === "Rectangle") {
      state.setDrawingMode(null)
      state.setSelectedDrawingTool(null)
    }
  }, [state])

  // Handle mouse down for chart panning
  const handleChartMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      state.setDragState(prev => ({
        ...prev,
        isDraggingChart: true,
        dragStart: { x: e.clientX, y: e.clientY }
      }))
    }
  }, [state])

  // Component resize handlers
  const handleCvdResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    state.setDragState(prev => ({
      ...prev,
      isDraggingCvd: true,
      dragStart: { x: e.clientX, y: e.clientY }
    }))
  }, [state])

  const handleLiquidationsResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    state.setDragState(prev => ({
      ...prev,
      isDraggingLiquidations: true,
      dragStart: { x: e.clientX, y: e.clientY }
    }))
  }, [state])

  // Combined mouse down handler
  const handleCombinedMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleChartMouseDown(e)
    handleCanvasMouseDown(e)
  }, [handleChartMouseDown, handleCanvasMouseDown])

  // Global drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (state.dragState.isDraggingChart) {
        const deltaX = e.clientX - state.dragState.dragStart.x
        const deltaY = e.clientY - state.dragState.dragStart.y
        state.setViewportState(prev => ({
          ...prev,
          timeOffset: prev.timeOffset - deltaX,
          priceOffset: prev.priceOffset - deltaY
        }))
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
      state.setDragState(prev => ({
        ...prev,
        isDraggingChart: false,
        isDraggingPrice: false,
        isDraggingTime: false,
        isDraggingOrderbook: false,
        isDraggingCvd: false,
        isDraggingLiquidations: false,
      }))
    }

    if (state.dragState.isDraggingChart || state.dragState.isDraggingCvd || state.dragState.isDraggingLiquidations) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [state.dragState, state.setViewportState, state.setDragState, state.setComponentSizes])

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
  }, [state])

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

    // Draw CVD line with custom settings
    ctx.strokeStyle = state.indicatorSettings.cvd.lineColor
    ctx.lineWidth = state.indicatorSettings.cvd.lineWidth
    ctx.beginPath()
    let cvdValue = 0
    const spacing = 12 * state.viewportState.timeZoom
    candleData.forEach((candle, index) => {
      cvdValue += (candle.close > candle.open ? 1 : -1) * candle.volume
      const x = index * spacing + 50 - state.viewportState.timeOffset
      const y = canvas.offsetHeight / 2 + (cvdValue / 10000) * 20
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
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.mousePosition, state.backgroundColor, state.indicatorSettings.cvd, candleData])

  // Draw liquidations with extended crosshair
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

    // Draw liquidation bars with custom settings
    const liquidations = [5, 12, 3, 8, 15, 2, 7, 20, 4, 9, 6, 14, 8, 11, 3, 18, 7, 13, 5, 10, 16, 4]
    const spacing = 12 * state.viewportState.timeZoom
    liquidations.forEach((liq, index) => {
      const x = index * spacing + 50 - state.viewportState.timeOffset
      if (x < -8 || x > canvas.offsetWidth) return

      const height = (liq / 25) * canvas.offsetHeight
      ctx.fillStyle = liq > state.indicatorSettings.liquidations.threshold ? state.indicatorSettings.liquidations.color : "#00ff88"
      ctx.fillRect(x, canvas.offsetHeight - height, 8 * state.viewportState.timeZoom, height)
    })

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
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.mousePosition, state.backgroundColor, state.indicatorSettings.liquidations])

  const chartAreaWidth = state.showOrderbook ? `calc(100% - ${state.componentSizes.orderbookWidth}px)` : "100%"

  return (
    <div className="h-screen bg-black text-white font-mono text-xs overflow-hidden flex flex-col">
      {/* Top Navigation */}
      <TopNavigation />

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
        onToggleTimeframes={() => state.setShowTimeframes(!state.showTimeframes)}
        onToggleIndicators={() => state.setShowIndicators(!state.showIndicators)}
        onToggleTools={() => state.setShowTools(!state.showTools)}
        onToggleSettings={() => state.setShowSettings(!state.showSettings)}
        onSelectTimeframe={handleSelectTimeframe}
        onToggleIndicator={handleToggleIndicator}
        onSelectDrawingTool={handleSelectDrawingTool}
        onClearDrawings={handleClearDrawings}
        timeframesRef={timeframesDropdownRef}
        indicatorsRef={indicatorsDropdownRef}
        toolsRef={toolsDropdownRef}
        settingsRef={settingsDropdownRef}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 flex flex-col relative min-h-0" style={{ width: chartAreaWidth }}>
          
          {/* Indicator Info Overlay */}
          <div className="absolute top-2 left-4 z-10 space-y-1">
            <div className="text-xs">
              <span>binancef btcusdt - </span>
              {state.hoveredCandle ? (
                <span>
                  O {state.hoveredCandle.open.toFixed(2)} H {state.hoveredCandle.high.toFixed(2)} L {state.hoveredCandle.low.toFixed(2)} C{" "}
                  {state.hoveredCandle.close.toFixed(2)} D {state.hoveredCandle.volume}
                </span>
              ) : (
                <span>O 111121.80 H 111348.00 L 111111.30 C 111282.10 D 633.00</span>
              )}
              <span
                className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                onClick={() => removeIndicator("main")}
              >
                remove
              </span>
            </div>

            {state.activeIndicators.includes("Volume") && (
              <div className="text-xs">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "Volume" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Volume")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={() => openIndicatorSettings("volume")}
                >
                  Volume sell 556.61 buy 852.30
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={() => removeIndicator("Volume")}
                >
                  remove
                </span>
              </div>
            )}

            {state.activeIndicators.includes("VPVR") && (
              <div className="text-xs">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "VPVR" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("VPVR")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={() => openIndicatorSettings("vpvr")}
                >
                  VPVR
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={() => removeIndicator("VPVR")}
                >
                  remove
                </span>
              </div>
            )}

            {state.activeIndicators.includes("Heatmap") && (
              <div className="text-xs">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "Heatmap" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Heatmap")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={() => openIndicatorSettings("heatmap")}
                >
                  Heatmap binancef
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={() => removeIndicator("Heatmap")}
                >
                  remove
                </span>
              </div>
            )}
          </div>

          {/* VPVR Settings Panel */}
          {state.openSettingsPanel === "vpvr" && (
            <div
              className="absolute top-20 left-4 z-20 bg-[#2a2a2a] border border-gray-600 rounded p-4 min-w-80"
              ref={vpvrSettingsPanelRef}
            >
              <h3 className="text-sm font-bold mb-4">VPVR Settings</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Enable fixed ticks</span>
                  <input
                    type="checkbox"
                    checked={state.indicatorSettings.vpvr.enableFixedTicks}
                    onChange={(e) => updateIndicatorSetting("vpvr", "enableFixedTicks", e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Row count</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={state.indicatorSettings.vpvr.rowCount}
                      onChange={(e) => updateIndicatorSetting("vpvr", "rowCount", Number.parseInt(e.target.value))}
                      className="w-32"
                    />
                    <span className="w-8 text-center">{state.indicatorSettings.vpvr.rowCount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Bull Color</span>
                  <input
                    type="color"
                    value={state.indicatorSettings.vpvr.bullColor}
                    onChange={(e) => updateIndicatorSetting("vpvr", "bullColor", e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Bear Color</span>
                  <input
                    type="color"
                    value={state.indicatorSettings.vpvr.bearColor}
                    onChange={(e) => updateIndicatorSetting("vpvr", "bearColor", e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Origin</span>
                  <select
                    value={state.indicatorSettings.vpvr.origin}
                    onChange={(e) => updateIndicatorSetting("vpvr", "origin", e.target.value)}
                    className="bg-[#1a1a1a] border border-gray-600 rounded px-2 py-1"
                  >
                    <option value="left">left</option>
                    <option value="right">right</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span>Show POC</span>
                  <input
                    type="checkbox"
                    checked={state.indicatorSettings.vpvr.showPOC}
                    onChange={(e) => updateIndicatorSetting("vpvr", "showPOC", e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>POC line color</span>
                  <input
                    type="color"
                    value={state.indicatorSettings.vpvr.pocLineColor}
                    onChange={(e) => updateIndicatorSetting("vpvr", "pocLineColor", e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span>Value area</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.01"
                      value={state.indicatorSettings.vpvr.valueArea}
                      onChange={(e) => updateIndicatorSetting("vpvr", "valueArea", Number.parseFloat(e.target.value))}
                      className="w-32"
                    />
                    <span className="w-12 text-center">{state.indicatorSettings.vpvr.valueArea.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Delta Mode</span>
                  <input
                    type="checkbox"
                    checked={state.indicatorSettings.vpvr.deltaMode}
                    onChange={(e) => updateIndicatorSetting("vpvr", "deltaMode", e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Chart Settings Panel */}
          {state.showChartSettings && (
            <div
              className="absolute top-20 left-4 z-20 bg-[#2a2a2a] border border-gray-600 rounded p-4 min-w-80"
              ref={chartSettingsPanelRef}
            >
              <h3 className="text-sm font-bold mb-4">Chart Settings</h3>

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
              </div>
            </div>
          )}
          
          {/* Main Chart */}
          <MainChart
            candleData={candleData}
            volumeProfile={volumeProfile}
            heatmapData={heatmapData}
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
          />

          {/* CVD Chart with resize handle */}
          {state.activeIndicators.includes("CVD") && (
            <div className="border-t border-gray-700 relative" style={{ height: `${state.componentSizes.cvdHeight}px` }}>
              <canvas ref={cvdCanvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
              <div className="absolute left-2 top-2 text-xs">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "CVD" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("CVD")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={() => openIndicatorSettings("cvd")}
                >
                  CVD
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={() => removeIndicator("CVD")}
                >
                  remove
                </span>
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600 cursor-ns-resize hover:bg-gray-500"
                onMouseDown={handleCvdResize}
              />
            </div>
          )}

          {/* Liquidations Chart with resize handle */}
          {state.activeIndicators.includes("Liquidations") && (
            <div className="border-t border-gray-700 relative" style={{ height: `${state.componentSizes.liquidationsHeight}px` }}>
              <canvas ref={liquidationsCanvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
              <div className="absolute left-2 top-2 text-xs">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "Liquidations" ? "bg-blue-800" : ""}`}
                  onMouseEnter={() => state.setHoveredIndicator("Liquidations")}
                  onMouseLeave={() => state.setHoveredIndicator(null)}
                  onClick={() => openIndicatorSettings("liquidations")}
                >
                  Liquidations
                </span>
                <span
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={() => removeIndicator("Liquidations")}
                >
                  remove
                </span>
              </div>
              <div className="absolute right-2 bottom-2 text-xs">
                <div>40</div>
                <div>30</div>
                <div>20</div>
                <div>10</div>
                <div>0</div>
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600 cursor-ns-resize hover:bg-gray-500"
                onMouseDown={handleLiquidationsResize}
              />
            </div>
          )}

          {/* Time Axis - Temporary simplified version */}
          <div className="h-5 bg-[#2a2a2a] border-t border-gray-700 flex items-center justify-between px-4 text-xs">
            <span>00:00</span>
            <span>00:00</span>
            <span>00:00</span>
            <span>00:00</span>
            <span>00:00</span>
            <span>00:00</span>
            <span>00:00</span>
            <span className="text-yellow-400">00:00</span>
            <span>00:00</span>
          </div>
        </div>

        {/* High-Performance Orderbook */}
        {state.showOrderbook && (
          <HighPerformanceOrderbook
            bids={orderbook.bids}
            asks={orderbook.asks}
            currentPrice={state.currentPrice}
            width={state.componentSizes.orderbookWidth}
            onResize={(width) => state.setComponentSizes(prev => ({ ...prev, orderbookWidth: width }))}
            onClose={() => state.setShowOrderbook(false)}
          />
        )}
      </div>
    </div>
  )
}
