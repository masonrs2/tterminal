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

// Seeded random number generator for consistent data generation
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  random(): number {
    const x = Math.sin(this.seed++) * 10000
    return x - Math.floor(x)
  }
}

// Create seeded random instance with fixed seed for consistency
const seededRandom = new SeededRandom(12345)

// Generate realistic historical trading data (500 candles) with seeded randomness
const generateRealisticCandleData = (): CandleData[] => {
  const candles: CandleData[] = []
  // Use fixed timestamp for consistent data generation (Jan 1, 2024)
  const baseTime = 1704067200000 - 3600000 * 500 // 500 hours before Jan 1, 2024
  let currentPrice = 108000 // Starting price
  
  for (let i = 0; i < 500; i++) {
    const timestamp = baseTime + i * 3600000 // Hourly candles
    
    // Realistic price movement with trends and volatility
    const trend = Math.sin(i / 50) * 0.002 // Long-term trend
    const noise = (seededRandom.random() - 0.5) * 0.008 // Random volatility
    const momentum = (seededRandom.random() - 0.5) * 0.004 // Momentum component
    
    const priceChange = trend + noise + momentum
    currentPrice *= (1 + priceChange)
    
    // Generate OHLC with realistic wicks
    const open = currentPrice
    const volatility = 0.015 + seededRandom.random() * 0.01 // 1.5-2.5% volatility
    const high = open * (1 + seededRandom.random() * volatility)
    const low = open * (1 - seededRandom.random() * volatility)
    
    // Close price tends to stay within range but can break out
    const closeDirection = seededRandom.random() - 0.5
    const close = open + (closeDirection * (high - low) * 0.7)
    currentPrice = Math.max(low, Math.min(high, close))
    
    // Realistic volume with higher volume on big moves
    const priceMovement = Math.abs(close - open) / open
    const baseVolume = 800 + seededRandom.random() * 400
    const volumeMultiplier = 1 + (priceMovement * 5) // Higher volume on big moves
    const volume = Math.floor(baseVolume * volumeMultiplier)
    
    candles.push({
      timestamp,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume
    })
  }
  
  return candles
}

const candleData: CandleData[] = generateRealisticCandleData()

// Generate realistic volume profile based on price levels with seeded randomness
const generateVolumeProfile = (): VolumeProfileEntry[] => {
  const profile: VolumeProfileEntry[] = []
  const priceMin = Math.min(...candleData.map(c => c.low))
  const priceMax = Math.max(...candleData.map(c => c.high))
  const priceStep = (priceMax - priceMin) / 100 // 100 price levels
  
  for (let i = 0; i < 100; i++) {
    const price = priceMin + (i * priceStep)
    
    // Calculate how much volume occurred at this price level
    let totalVolume = 0
    candleData.forEach(candle => {
      if (price >= candle.low && price <= candle.high) {
        // More volume near the close price, less at extremes
        const pricePosition = (price - candle.low) / (candle.high - candle.low)
        const closeness = 1 - Math.abs(pricePosition - 0.5) * 2
        totalVolume += candle.volume * closeness * 0.1
      }
    })
    
    if (totalVolume > 50) { // Only include significant levels
      const type = seededRandom.random() > 0.5 ? "buy" : "sell"
      profile.push({
        price: Math.round(price * 100) / 100,
        volume: Math.floor(totalVolume),
        type
      })
    }
  }
  
  return profile.sort((a, b) => b.price - a.price) // Sort by price descending
}

const volumeProfile: VolumeProfileEntry[] = generateVolumeProfile()

// Generate realistic heatmap data across the chart with seeded randomness
const generateHeatmapData = (): HeatmapData[] => {
  const heatmap: HeatmapData[] = []
  
  // Generate heatmap points for significant price/time areas
  for (let timeIndex = 50; timeIndex < candleData.length - 50; timeIndex += 10) {
    for (let priceLevel = 0; priceLevel < 20; priceLevel++) {
      if (seededRandom.random() > 0.7) { // 30% chance of heatmap point
        const candle = candleData[timeIndex]
        const priceRange = candle.high - candle.low
        const baseIntensity = candle.volume / 1000
        
        // Higher intensity around high volume areas
        const intensity = baseIntensity * (0.5 + seededRandom.random() * 1.5)
        
        heatmap.push({
          x: timeIndex,
          y: priceLevel,
          intensity: Math.round(intensity * 100) / 100
        })
      }
    }
  }
  
  return heatmap
}

const heatmapData: HeatmapData[] = generateHeatmapData()

// Generate realistic orderbook data with enough entries to fill the height
const generateOrderbookData = () => {
  const asks = []
  const bids = []
  const currentPrice = candleData[candleData.length - 1]?.close || 108000
  
  let total = 0
  // Generate 100 ask levels (above current price)
  for (let i = 0; i < 100; i++) {
    const price = currentPrice + (i + 1) * 0.1
    const size = seededRandom.random() * 5 + 0.001
    total += size
    asks.push({ price: Math.round(price * 10) / 10, size: Math.round(size * 1000) / 1000, total: Math.round(total * 1000) / 1000 })
  }
  
  total = 0
  // Generate 100 bid levels (below current price)
  for (let i = 0; i < 100; i++) {
    const price = currentPrice - (i + 1) * 0.1
    const size = seededRandom.random() * 5 + 0.001
    total += size
    bids.push({ price: Math.round(price * 10) / 10, size: Math.round(size * 1000) / 1000, total: Math.round(total * 1000) / 1000 })
  }
  
  return { asks, bids }
}

const orderbook = generateOrderbookData()

export default function TradingTerminal() {
  // Centralized state management
  const state = useTradingState()
  
  // Set current price to the latest candle's close price
  React.useEffect(() => {
    if (candleData.length > 0) {
      const latestCandle = candleData[candleData.length - 1]
      state.setCurrentPrice(latestCandle.close)
    }
  }, [candleData, state.setCurrentPrice])
  
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
  const { handleMouseMove, handleCanvasMouseDown, handleAxisDragEnd, handleMeasuringToolMouseUp, handleWheel } = useChartInteractions({
    canvasRef,
    candleData,
    drawingMode: state.drawingMode,
    drawingTools: state.drawingTools,
    selectedDrawingIndex: state.selectedDrawingIndex,
    viewportState: state.viewportState,
    dragState: state.dragState,
    measuringSelection: state.measuringSelection,
    isCreatingMeasurement: state.isCreatingMeasurement,
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
  const handleSelectTimeframe = useCallback((timeframe: string) => {
    state.setSelectedTimeframe(timeframe)
    state.setShowTimeframes(false)
  }, [state.setSelectedTimeframe, state.setShowTimeframes])

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
  }, [state.drawingMode, state.drawingTools, state.viewportState.timeZoom, state.viewportState.priceZoom, state.viewportState.timeOffset, state.viewportState.priceOffset, state.setDrawingTools])

  const handleCanvasMouseUp = useCallback(() => {
    if (state.drawingMode === "Rectangle") {
      state.setDrawingMode(null)
      state.setSelectedDrawingTool(null)
    }
  }, [state.drawingMode, state.setDrawingMode, state.setSelectedDrawingTool])

  // Handle mouse down for chart panning
  const handleChartMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      state.setDragState(prev => ({
        ...prev,
        isDraggingChart: true,
        dragStart: { x: e.clientX, y: e.clientY }
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

      if (state.dragState.isDraggingChart) {
        const deltaX = e.clientX - state.dragState.dragStart.x
        const deltaY = e.clientY - state.dragState.dragStart.y
        
        // Apply drag sensitivity multiplier for faster panning
        const dragSensitivity = 1.25
        
        state.setViewportState(prev => ({
          ...prev,
          timeOffset: prev.timeOffset - (deltaX * dragSensitivity),
          priceOffset: prev.priceOffset - (deltaY * dragSensitivity)
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
      // Handle measuring tool mouse up separately
      if (state.isCreatingMeasurement) {
        handleMeasuringToolMouseUp()
      } else {
        handleAxisDragEnd()
      }
    }

    if (state.dragState.isDraggingChart || state.dragState.isDraggingPrice || state.dragState.isDraggingTime || state.dragState.isDraggingCvd || state.dragState.isDraggingLiquidations || state.isCreatingMeasurement) {
      console.log('Attaching global mouse handlers', { isCreatingMeasurement: state.isCreatingMeasurement })
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
    state.isCreatingMeasurement, 
    state.setViewportState, 
    state.setDragState, 
    state.setComponentSizes, 
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
    const maxVolume = Math.max(...candleData.map(c => c.volume))
    
    candleData.forEach((candle, index) => {
      // More realistic CVD calculation with proper buy/sell ratio
      const isBullish = candle.close > candle.open
      const priceMove = Math.abs(candle.close - candle.open) / candle.open
      const volumeWeight = isBullish ? 1 + priceMove * 2 : -(1 + priceMove * 2)
      
      cvdValue += volumeWeight * candle.volume
      const x = index * spacing + 50 - state.viewportState.timeOffset
      
      // Scale CVD to fit chart height properly
      const cvdRange = maxVolume * candleData.length * 0.1 // Estimated range
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
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.mousePosition, state.backgroundColor, state.indicatorSettings.cvd, candleData])

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
    candleData.forEach((candle, index) => {
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
  }, [state.viewportState.timeZoom, state.viewportState.timeOffset, state.backgroundColor, state.indicatorSettings.liquidations, candleData])

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

  // Reset chart to current price position (latest bars)
  const handleResetToCurrentPrice = useCallback(() => {
    // Calculate offset to show latest candles on the right side
    const canvas = canvasRef.current
    if (!canvas) return
    
    const spacing = 12 * 1 // Use default zoom for calculation
    const totalWidth = candleData.length * spacing
    const canvasWidth = canvas.offsetWidth
    const rightMargin = 100 // Keep some margin from the right edge
    
    // Position so latest candles are visible on the right side
    const targetOffset = Math.max(0, totalWidth - canvasWidth + rightMargin)
    
    state.setViewportState({
      priceZoom: 1,
      timeZoom: 1,
      priceOffset: 0,
      timeOffset: targetOffset,
    })
  }, [state, candleData])

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
    if (!state.mousePosition.x || !candleData.length) return ''
    
    const spacing = 12 * state.viewportState.timeZoom
    const candleIndex = Math.floor((state.mousePosition.x - 50 + state.viewportState.timeOffset) / spacing)
    
    if (candleIndex >= 0 && candleIndex < candleData.length) {
      return formatCrosshairDateTime(candleData[candleIndex].timestamp)
    }
    
    return ''
  }, [state.mousePosition.x, state.viewportState.timeZoom, state.viewportState.timeOffset, candleData, formatCrosshairDateTime])

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
              <span 
                className="cursor-pointer hover:text-blue-300 hover:bg-blue-900/20 px-1 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation() // Prevent chart click handler from interfering
                  state.setShowChartSettings(!state.showChartSettings)
                }}
                title="Click to open chart settings"
              >
                binancef btcusdt
              </span>
              <span> - </span>
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
                onClick={(e) => {
                  e.stopPropagation()
                  removeIndicator("main")
                }}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("volume")
                  }}
                >
                  Volume sell 556.61 buy 852.30
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Volume")
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("vpvr")
                  }}
                >
                  VPVR
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("VPVR")
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    openIndicatorSettings("heatmap")
                  }}
                >
                  Heatmap binancef
                </span>
                <span
                  className="ml-4 text-blue-400 cursor-pointer hover:text-blue-300"
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
            className="absolute top-2 right-4 z-10 bg-black/40 hover:bg-black/60 border border-gray-500/50 rounded px-1.5 py-0.5 text-xs transition-all flex items-center space-x-1 backdrop-blur-sm"
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
            <span className="text-[10px] text-gray-300">Current</span>
          </button>

          {/* Crosshair DateTime Display */}
          {state.mousePosition.x > 0 && getCrosshairDateTime() && (
            <div 
              className="absolute bottom-14 z-20 bg-[#181818] border border-gray-600 rounded px-2 py-1 text-xs text-white pointer-events-none"
              style={{ 
                left: `${Math.max(10, Math.min(state.mousePosition.x - 60, window.innerWidth - 140))}px` 
              }}
            >
              {getCrosshairDateTime()}
            </div>
          )}

          {/* VPVR Settings Panel */}
          {state.openSettingsPanel === "vpvr" && (
            <div
              className="absolute top-20 left-4 z-20 bg-[#181818] border border-gray-600 rounded p-4 min-w-80"
              ref={vpvrSettingsPanelRef}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold">VPVR Settings</h3>
                <button
                  onClick={() => handleResetIndicator('vpvr')}
                  className="px-2 py-1 text-xs bg-[#2a2a2a] hover:bg-[#353535] rounded transition-colors"
                  title="Reset to defaults"
                >
                  Reset
                </button>
              </div>

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
                    className="bg-[#0f0f0f] border border-gray-600 rounded px-2 py-1"
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
            measuringSelection={state.measuringSelection}
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
              <div className="absolute left-2 top-2 text-xs z-20">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "CVD" ? "bg-blue-800" : ""}`}
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
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300"
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
              <div className="absolute left-2 top-2 text-xs z-20">
                <span
                  className={`cursor-pointer ${state.hoveredIndicator === "Liquidations" ? "bg-blue-800" : ""}`}
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
                  className="ml-2 text-blue-400 cursor-pointer hover:text-blue-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeIndicator("Liquidations")
                  }}
                >
                  remove
                </span>
              </div>
              <div className="absolute right-2 bottom-2 text-xs z-20">
                <div>40</div>
                <div>30</div>
                <div>20</div>
                <div>10</div>
                <div>0</div>
              </div>
            </div>
          )}

          {/* Time Axis - Interactive version for horizontal zoom */}
          <div 
            className="h-12 bg-[#181818] border-t border-gray-700 cursor-ew-resize hover:bg-[#202020] transition-colors select-none"
            onMouseMove={handleAxisMouseMove}
            onMouseDown={handleAxisMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onWheel={(e) => handleAxisWheel(e, 'time')}
            title="Drag or scroll to zoom time axis horizontally"
          >
            <div className="flex items-center justify-between px-4 h-6 text-xs">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span className="text-yellow-400">18:00</span>
              <span>00:00</span>
            </div>
            <div className="flex items-center justify-between px-4 h-6 text-xs text-gray-400">
              <span>5/20/25</span>
              <span></span>
              <span></span>
              <span></span>
              <span>5/21/25</span>
              <span></span>
              <span></span>
              <span></span>
              <span>5/22/25</span>
            </div>
          </div>
        </div>

        {/* High-Performance Orderbook */}
        {state.showOrderbook && (
          <div className="flex-shrink-0 h-full">
          <HighPerformanceOrderbook
            bids={orderbook.bids}
            asks={orderbook.asks}
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
