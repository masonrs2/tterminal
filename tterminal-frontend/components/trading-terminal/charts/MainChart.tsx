/**
 * Main Chart Component
 * Handles the primary price chart canvas with candlesticks, volume, and overlays
 * Enhanced with real-time features: live price line, countdown timer, current candle animation
 */

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react'
import type { 
  CandleData, 
  MousePosition, 
  Drawing, 
  ViewportState, 
  IndicatorSettings,
  VolumeProfileEntry,
  HeatmapData,
  MeasuringSelection 
} from '../../../types/trading'
import { getTimeRemaining, getCurrentCandleProgress, formatTime, formatDate } from '../../../utils/trading/calculations'
import { MeasuringToolTooltip } from './MeasuringToolTooltip'
import { VolumeProfile } from './VolumeProfile'

interface MainChartProps {
  candleData: CandleData[]
  volumeProfile: VolumeProfileEntry[]
  heatmapData: HeatmapData[]
  currentPrice: number
  selectedTimeframe: string
  mousePosition: MousePosition
  hoveredCandle: CandleData | null
  activeIndicators: string[]
  drawingTools: Drawing[]
  selectedDrawingIndex: number | null
  viewportState: ViewportState
  backgroundColor: string
  bullCandleColor: string
  bearCandleColor: string
  indicatorSettings: IndicatorSettings
  showOrderbook: boolean
  measuringSelection: MeasuringSelection
  navigationMode: "auto" | "manual"
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onMouseMoveCapture: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onAxisWheel?: (axisType: 'price', deltaY: number) => void
  onClearMeasuring: () => void
  className?: string
}

// Custom comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: MainChartProps, nextProps: MainChartProps) => {
  // Always re-render if candleData array reference changed (this means real candle updates)
  if (prevProps.candleData !== nextProps.candleData) return false
  
  // Always re-render if current price changed significantly
  if (Math.abs(prevProps.currentPrice - nextProps.currentPrice) > 0.01) return false
  
  // Re-render if viewport state changed (zoom/pan)
  if (prevProps.viewportState !== nextProps.viewportState) return false
  
  // Re-render if mouse position changed
  if (prevProps.mousePosition !== nextProps.mousePosition) return false
  
  // Re-render if visual settings changed
  if (prevProps.backgroundColor !== nextProps.backgroundColor ||
      prevProps.bullCandleColor !== nextProps.bullCandleColor ||
      prevProps.bearCandleColor !== nextProps.bearCandleColor) return false
  
  // Skip re-render for other prop changes to reduce glitching
  return true
}

export const MainChart = React.memo<MainChartProps>((props: MainChartProps) => {
  const {
    candleData,
    volumeProfile,
    heatmapData,
    currentPrice,
    selectedTimeframe,
    mousePosition,
    hoveredCandle,
    activeIndicators,
    drawingTools,
    selectedDrawingIndex,
    viewportState,
    backgroundColor,
    bullCandleColor,
    bearCandleColor,
    indicatorSettings,
    showOrderbook,
    measuringSelection,
    navigationMode,
    canvasRef,
    onMouseMove,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onMouseMoveCapture,
    onContextMenu,
    onAxisWheel,
    onClearMeasuring,
    className = ""
  } = props

  // COMPREHENSIVE CHART DATA ANALYSIS
  useEffect(() => {
    if (candleData.length > 0) {
      const now = Date.now()
      const timeSpan = (candleData[candleData.length - 1].timestamp - candleData[0].timestamp) / (1000 * 60 * 60)
      const historical = candleData.filter(c => now - c.timestamp >= 6 * 60 * 60 * 1000).length
      const recent = candleData.filter(c => now - c.timestamp < 60 * 60 * 1000).length
      
      console.log(`Chart Data ${selectedTimeframe}:`, {
        total: candleData.length,
        timeSpan: `${timeSpan.toFixed(1)}h`,
        historical,
        recent
      })
    }
  }, [candleData.length, selectedTimeframe])

  // Helper function to get interval in milliseconds (moved to top to fix hoisting issue)
  const getIntervalInMs = (interval: string): number => {
    switch (interval) {
      case '1m': return 60 * 1000
      case '5m': return 5 * 60 * 1000
      case '15m': return 15 * 60 * 1000
      case '30m': return 30 * 60 * 1000
      case '1h': return 60 * 60 * 1000
      case '4h': return 4 * 60 * 60 * 1000
      case '1d': return 24 * 60 * 60 * 1000
      case '1w': return 7 * 24 * 60 * 60 * 1000
      default: return 60 * 1000
    }
  }

  // Real-time state for countdown and price updates
  const [realTimeCountdown, setRealTimeCountdown] = useState<string>('00:00')
  const [candleProgress, setCandleProgress] = useState<number>(0)
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  const [priceAxisKey, setPriceAxisKey] = useState<number>(0) // Force re-render of price axis
  const priceAxisUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Price direction tracking for color changes
  const [previousPrice, setPreviousPrice] = useState<number>(currentPrice)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral')
  const lastPriceChangeRef = useRef<number>(Date.now())

  // PERFORMANCE OPTIMIZATION: Memoize volume profile processing to prevent infinite re-renders
  const processedVolumeProfile = React.useMemo(() => {
    if (!volumeProfile || volumeProfile.length === 0) return []
    
    // Limit to prevent stack overflow and validate data
    return volumeProfile.slice(0, 10000).filter(v => 
      v && 
      typeof v.volume === 'number' && 
      typeof v.price === 'number' && 
      !isNaN(v.volume) && 
      !isNaN(v.price)
    )
  }, [volumeProfile])

  // Debounced price axis re-render when viewport changes
  useEffect(() => {
    // Clear existing timeout
    if (priceAxisUpdateTimeoutRef.current) {
      clearTimeout(priceAxisUpdateTimeoutRef.current)
    }
    
    // Set new timeout for debounced update
    priceAxisUpdateTimeoutRef.current = setTimeout(() => {
      setPriceAxisKey(prev => prev + 1)
    }, 16) // ~60fps update rate
    
    return () => {
      if (priceAxisUpdateTimeoutRef.current) {
        clearTimeout(priceAxisUpdateTimeoutRef.current)
      }
    }
  }, [viewportState.priceOffset, viewportState.priceZoom])

  // Track price direction for real-time color changes
  useEffect(() => {
    const now = Date.now()
    
    // Only update direction if price changed significantly and enough time has passed
    if (Math.abs(currentPrice - previousPrice) > 0.1 && now - lastPriceChangeRef.current > 100) {
      const newDirection = currentPrice > previousPrice ? 'up' : 'down'
      
      // Only update if direction actually changed or if we're starting from neutral
      if (priceDirection === 'neutral' || priceDirection !== newDirection) {
        setPriceDirection(newDirection)
      }
      
      setPreviousPrice(currentPrice)
      lastPriceChangeRef.current = now
      
      // NEVER reset to neutral - keep the direction until price moves opposite way
    }
  }, [currentPrice, previousPrice, priceDirection])

  // Calculate STABLE price range that doesn't change with real-time updates
  const calculateStablePriceRange = useCallback(() => {
    if (candleData.length === 0) return { finalMax: 0, finalMin: 0, priceRange: 1 }
    
    // CRITICAL FIX: Exclude the last candle from range calculation to prevent jumping
    // The last candle is being updated in real-time, so including it in range calculation
    // causes the entire Y-axis to shift when price updates, making candles appear to move wrong
    const historicalCandles = candleData.length > 1 ? candleData.slice(0, -1) : candleData
    
    // Create a STABLE baseline range using only historical data (not real-time updates)
    // Only use the first 90% of historical data to establish a stable baseline
    const stableDataLength = Math.max(1, Math.floor(historicalCandles.length * 0.9))
    const stableCandles = historicalCandles.slice(0, stableDataLength)
    
    if (stableCandles.length === 0) {
      // Fallback for edge case
      return { finalMax: currentPrice + 100, finalMin: currentPrice - 100, priceRange: 200 }
    }
    
    const allStablePrices = stableCandles.flatMap(c => [c.high, c.low, c.open, c.close])
    
    // IMPORTANT: Don't include currentPrice in range calculation - this prevents Y-axis jumping
    // The current price should be displayed within the stable range, not change the range
    
    const stablePriceMax = Math.max(...allStablePrices)
    const stablePriceMin = Math.min(...allStablePrices)
    
    // Use a FIXED padding that creates a stable viewing window
    const stableRange = stablePriceMax - stablePriceMin
    const fixedPadding = Math.max(stableRange * 0.25, 100) // Generous padding for stability
    
    // Create the stable baseline range (this should NEVER change during real-time updates)
    const baselineMax = stablePriceMax + fixedPadding
    const baselineMin = stablePriceMin - fixedPadding
    const baselineRange = baselineMax - baselineMin
    
    // Apply ONLY zoom to the baseline (offset is handled separately for smooth panning)
    const zoomFactor = Math.max(0.1, Math.min(10, viewportState.priceZoom)) // Clamp zoom for stability
    const effectiveRange = baselineRange / zoomFactor
    
    // Calculate the center point for zoom operations
    const baselineCenter = baselineMin + baselineRange / 2
    
    // Apply offset as a smooth translation without affecting the range size
    const offsetInPriceUnits = (viewportState.priceOffset / 100) * effectiveRange * 0.5 // Scale offset appropriately
    
    const finalMax = baselineCenter + effectiveRange / 2 + offsetInPriceUnits
    const finalMin = baselineCenter - effectiveRange / 2 + offsetInPriceUnits
    const priceRange = finalMax - finalMin
    
    return { finalMax, finalMin, priceRange }
  }, [
    // CRITICAL: Only depend on historical data length and viewport, not current price or last candle changes
    // This prevents recalculation when real-time updates occur
    candleData.length > 1 ? candleData[0].timestamp : 0, // First candle timestamp
    candleData.length > 1 ? candleData[candleData.length - 2].timestamp : 0, // Second-to-last candle (excluding last)
    viewportState.priceZoom, // Include zoom for proper scaling
    viewportState.priceOffset // Include offset for proper panning
    // NOTE: currentPrice and last candle changes are intentionally excluded to prevent Y-axis jumping
  ])

  // Real-time countdown timer (updates every second)
  useEffect(() => {
    const updateRealTimeData = () => {
      const countdown = getTimeRemaining(selectedTimeframe)
      const progress = getCurrentCandleProgress(selectedTimeframe)
      const now = Date.now()
      
      setRealTimeCountdown(countdown)
      setCandleProgress(progress)
      setCurrentTime(now)
    }

    // Initial update
    updateRealTimeData()

    // Set up interval for real-time updates
    const interval = setInterval(updateRealTimeData, 1000) // Update every second

    return () => clearInterval(interval)
  }, [selectedTimeframe])

  // Dedicated axis mouse handlers to prevent conflicts
  const handleAxisMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvasElement = canvasRef?.current
    if (!canvasElement) return

    const canvasRect = canvasElement.getBoundingClientRect()
    const divRect = e.currentTarget.getBoundingClientRect()
    
    const relativeX = divRect.left - canvasRect.left + (e.clientX - divRect.left)
    const relativeY = divRect.top - canvasRect.top + (e.clientY - divRect.top)
    
    const mockCanvasEvent = {
      ...e,
      currentTarget: canvasElement,
      target: canvasElement,
      clientX: canvasRect.left + relativeX,
      clientY: canvasRect.top + relativeY
    } as React.MouseEvent<HTMLCanvasElement>
    
    onMouseMove(mockCanvasEvent)
  }, [onMouseMove, canvasRef])

  const handleAxisMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvasElement = canvasRef?.current
    if (!canvasElement) return

    const canvasRect = canvasElement.getBoundingClientRect()
    const divRect = e.currentTarget.getBoundingClientRect()
    
    const relativeX = divRect.left - canvasRect.left + (e.clientX - divRect.left)
    const relativeY = divRect.top - canvasRect.top + (e.clientY - divRect.top)
    
    const mockCanvasEvent = {
      ...e,
      currentTarget: canvasElement,
      target: canvasElement,
      clientX: canvasRect.left + relativeX,
      clientY: canvasRect.top + relativeY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    } as React.MouseEvent<HTMLCanvasElement>
    
    onMouseDown(mockCanvasEvent)
  }, [onMouseDown, canvasRef])

  const handleAxisWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (onAxisWheel) {
      onAxisWheel('price', e.deltaY)
    }
  }, [onAxisWheel])

  /**
   * Main chart rendering effect
   * Draws candlesticks, volume, indicators, and drawings
   */
  useEffect(() => {
    const canvas = canvasRef?.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Setup high-DPI rendering
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)

    // Clear and set background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

    const { finalMax, finalMin, priceRange } = calculateStablePriceRange()
    
    const chartHeight = canvas.offsetHeight - 100
    
    // Calculate line end position for consistent use across components (where price axis begins)
    const lineEndX = canvas.offsetWidth - (showOrderbook ? 200 : 80)

    // Draw grid
    ctx.lineWidth = 0.5
    
    // Draw vertical grid lines
    if (indicatorSettings.chart.showVerticalGrid) {
      ctx.strokeStyle = indicatorSettings.chart.gridColor
      ctx.globalAlpha = indicatorSettings.chart.gridOpacity
      for (let i = 0; i < canvas.offsetWidth; i += 50 * viewportState.timeZoom) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, canvas.offsetHeight)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    
    // Draw horizontal grid lines
    if (indicatorSettings.chart.showHorizontalGrid) {
      ctx.strokeStyle = indicatorSettings.chart.gridColor
      ctx.globalAlpha = indicatorSettings.chart.gridOpacity
      for (let i = 0; i < canvas.offsetHeight; i += 30 * viewportState.priceZoom) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.offsetWidth, i)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // Draw volume bars in background
    const maxVolume = Math.max(...candleData.map((c) => c.volume))
    const spacing = 12 * viewportState.timeZoom
    candleData.forEach((candle, index) => {
      const x = index * spacing + 50 - viewportState.timeOffset
      if (x < -8 || x > canvas.offsetWidth) return

      const volumeHeight = (candle.volume / maxVolume) * (canvas.offsetHeight * 0.3)
      const buyRatio = candle.close > candle.open ? 0.6 : 0.4
      const sellRatio = 1 - buyRatio

      const buyHeight = volumeHeight * buyRatio
      const sellHeight = volumeHeight * sellRatio

      // Volume bars
      ctx.fillStyle = "rgba(255, 68, 68, 0.4)"
      ctx.fillRect(x, canvas.offsetHeight - sellHeight, 8 * viewportState.timeZoom, sellHeight)

      ctx.fillStyle = "rgba(0, 255, 136, 0.4)"
      ctx.fillRect(x, canvas.offsetHeight - volumeHeight, 8 * viewportState.timeZoom, buyHeight)
    })

    // Draw heatmap overlay (without text clutter)
    if (activeIndicators.includes("Heatmap")) {
      heatmapData.forEach((point) => {
        const x = point.x * spacing + 50 - viewportState.timeOffset
        const y = 50 + (point.y / 20) * chartHeight * 0.8 // Dynamic positioning based on chart height
        const intensity = Math.min(point.intensity / 200, 1)

        // Only draw if visible on screen
        if (x >= -40 && x <= canvas.offsetWidth + 40) {
          ctx.fillStyle = `rgba(138, 43, 226, ${intensity * indicatorSettings.heatmap.intensity})`
          ctx.fillRect(x - 15, y - 10, 30, 20)
        }
      })
    }

    // Draw candlesticks with dynamic price scaling
    const candleWidth = 8 * viewportState.timeZoom
    candleData.forEach((candle, index) => {
      const x = index * spacing + 50 - viewportState.timeOffset
      if (x < -candleWidth || x > canvas.offsetWidth) return

      // Check if this is the current (last) candle for real-time effects
      const isCurrentCandle = index === candleData.length - 1
      const intervalMs = getIntervalInMs(selectedTimeframe)
      const candleAge = currentTime - candle.timestamp
      const isActivelyCurrent = isCurrentCandle && candleAge < intervalMs

      // Dynamic price scaling based on actual data range with padding
      const high = 50 + ((finalMax - candle.high) / priceRange) * chartHeight
      const low = 50 + ((finalMax - candle.low) / priceRange) * chartHeight
      const open = 50 + ((finalMax - candle.open) / priceRange) * chartHeight
      const close = 50 + ((finalMax - candle.close) / priceRange) * chartHeight

      // Highlight hovered candle
      if (hoveredCandle && hoveredCandle.timestamp === candle.timestamp) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
        ctx.fillRect(x - 2, 0, candleWidth + 4, canvas.offsetHeight)
      }

      // REAL-TIME VISUAL EFFECTS: Add subtle glow/pulse effect for current candle
      if (isActivelyCurrent) {
        // Add subtle background glow for the current candle
        const glowAlpha = 0.3 + Math.sin(currentTime / 500) * 0.1 // Subtle pulse effect
        ctx.fillStyle = `rgba(255, 255, 0, ${glowAlpha * 0.15})` // Yellow glow
        ctx.fillRect(x - 3, 0, candleWidth + 6, canvas.offsetHeight)
        
        // Add border highlight for current candle
        ctx.strokeStyle = "rgba(255, 255, 0, 0.6)" // Yellow border
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.strokeRect(x - 1, Math.min(high, low) - 2, candleWidth + 2, Math.abs(high - low) + 4)
        ctx.setLineDash([])
      }

      // Draw wick with enhanced styling for current candle
      const wickColor = candle.close > candle.open ? bullCandleColor : bearCandleColor
      ctx.strokeStyle = isActivelyCurrent ? wickColor + "FF" : wickColor // Full opacity for current candle
      ctx.lineWidth = isActivelyCurrent ? 1.5 : 1 // Slightly thicker wick for current candle
      ctx.beginPath()
      ctx.moveTo(x + candleWidth / 2, high)
      ctx.lineTo(x + candleWidth / 2, low)
      ctx.stroke()

      // Draw body with enhanced styling for current candle
      const bodyColor = candle.close > candle.open ? bullCandleColor : bearCandleColor
      ctx.fillStyle = isActivelyCurrent ? bodyColor + "FF" : bodyColor // Full opacity for current candle
      const bodyTop = Math.min(open, close)
      const bodyHeight = Math.abs(close - open)
      
      // Add slight border for current candle body
      if (isActivelyCurrent) {
        ctx.strokeStyle = bodyColor
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, bodyTop, candleWidth, bodyHeight)
      }
      
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight)
    })

    // Draw current price line with dynamic color matching price box
    const currentPriceLineColor = priceDirection === 'down' ? "#ef4444" : "#22c55e" // Red for down, green for up
    ctx.strokeStyle = currentPriceLineColor
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    const currentY = 50 + ((finalMax - currentPrice) / priceRange) * chartHeight
    ctx.beginPath()
    ctx.moveTo(0, currentY)
    ctx.lineTo(canvas.offsetWidth, currentY) // Extend to full width including price axis
    ctx.stroke()
    ctx.setLineDash([])

    // Draw crosshair
    if (mousePosition.x > 0 && mousePosition.y > 0) {
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])

      // Vertical line
      ctx.beginPath()
      ctx.moveTo(mousePosition.x, 0)
      ctx.lineTo(mousePosition.x, canvas.offsetHeight)
      ctx.stroke()

      // Horizontal line
      ctx.beginPath()
      ctx.moveTo(0, mousePosition.y)
      ctx.lineTo(lineEndX, mousePosition.y)
      ctx.stroke()

      ctx.setLineDash([])

      // Price label (cleaned up and only shown on hover)
      if (mousePosition.price && mousePosition.x > canvas.offsetWidth - 100) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(canvas.offsetWidth - 80, mousePosition.y - 10, 75, 20)
        ctx.fillStyle = "#000000"
        ctx.font = "10px monospace"
        ctx.fillText(mousePosition.price.toFixed(1), canvas.offsetWidth - 77, mousePosition.y + 3)
      }
    }

    // Draw drawings with selection highlighting
    drawingTools.forEach((drawing, index) => {
      const isSelected = selectedDrawingIndex === index
      ctx.strokeStyle = isSelected ? "#ffffff" : drawing.color
      ctx.lineWidth = isSelected ? drawing.lineWidth + 1 : drawing.lineWidth
      ctx.beginPath()

      const x1 = drawing.time1 * spacing + 50 - viewportState.timeOffset
      const y1 = 50 + ((finalMax - drawing.price1) / priceRange) * chartHeight
      const x2 = drawing.time2 * spacing + 50 - viewportState.timeOffset
      const y2 = 50 + ((finalMax - drawing.price2) / priceRange) * chartHeight

      if (drawing.type === "Horizontal Ray") {
        ctx.moveTo(0, y1)
        ctx.lineTo(canvas.offsetWidth, y1)
      } else if (drawing.type === "Rectangle") {
        ctx.rect(x1, y1, x2 - x1, y2 - y1)
      }

      ctx.stroke()

      // Draw selection handles
      if (isSelected) {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(x1 - 3, y1 - 3, 6, 6)
        if (drawing.type === "Rectangle") {
          ctx.fillRect(x2 - 3, y2 - 3, 6, 6)
        }
      }
    })

    // Draw measuring tool selection box
    if (measuringSelection.isActive) {
      const startX = Math.min(measuringSelection.startX, measuringSelection.endX)
      const startY = Math.min(measuringSelection.startY, measuringSelection.endY)
      const width = Math.abs(measuringSelection.endX - measuringSelection.startX)
      const height = Math.abs(measuringSelection.endY - measuringSelection.startY)

      // Determine color based on price direction
      const startTimeIndex = Math.min(measuringSelection.startTimeIndex, measuringSelection.endTimeIndex)
      const endTimeIndex = Math.max(measuringSelection.startTimeIndex, measuringSelection.endTimeIndex)
      const startCandle = candleData[Math.max(0, startTimeIndex)]
      const endCandle = candleData[Math.min(candleData.length - 1, endTimeIndex)]
      
      const startPrice = startCandle?.close || measuringSelection.startPrice
      const endPrice = endCandle?.close || measuringSelection.endPrice
      const isGainSelection = endPrice > startPrice

      // Use blue for gains, red for losses
      const strokeColor = isGainSelection ? "#4a90e2" : "#ff4444"
      const fillColor = isGainSelection ? "rgba(74, 144, 226, 0.1)" : "rgba(255, 68, 68, 0.1)"

      // Draw selection rectangle
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(startX, startY, width, height)
      ctx.setLineDash([])

      // Fill with semi-transparent color
      ctx.fillStyle = fillColor
      ctx.fillRect(startX, startY, width, height)
    }
  }, [
    candleData,
    processedVolumeProfile,
    heatmapData,
    currentPrice,
    mousePosition,
    hoveredCandle,
    activeIndicators,
    drawingTools,
    selectedDrawingIndex,
    viewportState,
    backgroundColor,
    bullCandleColor,
    bearCandleColor,
    indicatorSettings,
    showOrderbook,
    measuringSelection,
  ])

  // Get current price range for volume profile
  const currentPriceRange = React.useMemo(() => {
    const { finalMax, finalMin } = calculateStablePriceRange()
    return { min: finalMin, max: finalMax }
  }, [calculateStablePriceRange])

  // Handle price click from volume profile
  const handleVolumeProfilePriceClick = useCallback((price: number) => {
    // Center the chart on the clicked price
    const { finalMax, finalMin } = calculateStablePriceRange()
    const priceRange = finalMax - finalMin
    const centerOffset = ((price - (finalMin + priceRange / 2)) / priceRange) * 200
    
    // Update viewport to center on clicked price
    // This would need to be passed up to the parent component
    console.log(`Volume Profile: Clicked price ${price.toFixed(2)}`)
  }, [calculateStablePriceRange])

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      {/* Main Chart Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
        style={{ zIndex: 10 }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMoveCapture={onMouseMoveCapture}
        onContextMenu={onContextMenu}
        onWheel={(e) => onAxisWheel?.('price', e.deltaY)}
      />

      {/* Volume Profile Overlay */}
      {activeIndicators.includes("VPVR") && candleData.length > 0 && (
        <VolumeProfile
          symbol="BTCUSDT" // TODO: Get from props or context
          timeRange={24} // TODO: Make configurable
          rowCount={indicatorSettings.vpvr.rowCount}
          enableRealTime={true}
          valueAreaPercentage={indicatorSettings.vpvr.valueArea * 100}
          viewportState={viewportState}
          chartHeight={canvasRef.current?.offsetHeight || 600}
          chartWidth={canvasRef.current?.offsetWidth || 800}
          priceRange={currentPriceRange}
          showDelta={indicatorSettings.vpvr.deltaMode}
          showPOC={indicatorSettings.vpvr.showPOC}
          showValueArea={true}
          showStatsBox={indicatorSettings.vpvr.showStatsBox}
          showVolumeText={indicatorSettings.vpvr.showVolumeText}
          showSinglePrints={indicatorSettings.vpvr.showSinglePrints}
          singlePrintColor={indicatorSettings.vpvr.singlePrintColor}
          singlePrintOpacity={indicatorSettings.vpvr.singlePrintOpacity}
          opacity={indicatorSettings.vpvr.opacity}
          candleData={candleData}
          onPriceClick={(price) => console.log('Volume profile price clicked:', price)}
        />
      )}

      {/* Measuring Tool Tooltip */}
      <MeasuringToolTooltip
        measuringSelection={measuringSelection}
        candleData={candleData}
        selectedTimeframe={selectedTimeframe}
        onClose={onClearMeasuring}
      />

      {/* Interactive Price axis with drag support */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-20 bg-[#181818] border-l border-gray-700 cursor-ns-resize hover:bg-[#202020] transition-colors select-none"
        style={{ 
          zIndex: 20, // CRITICAL FIX: Explicit z-index to ensure visibility
          display: 'block', // CRITICAL FIX: Ensure price axis is visible
          visibility: 'visible' // CRITICAL FIX: Force visibility
        }}
        onMouseMove={handleAxisMouseMove}
        onMouseDown={handleAxisMouseDown}
        onMouseUp={onMouseUp}
        onWheel={handleAxisWheel}
        title="Drag or scroll to zoom price axis vertically"
      >
        <div className="relative h-full w-full" key={priceAxisKey}>
          {(() => {
            // Use the SAME stable range calculation as the main chart
            const { finalMax, finalMin, priceRange: stableRange } = calculateStablePriceRange()
            const chartHeight = canvasRef?.current?.offsetHeight ? canvasRef.current.offsetHeight - 100 : 400
            
            // Generate FIXED price levels based on nice round numbers
            const priceLabels = []
            
            // Calculate appropriate price step for nice round numbers
            const roughStep = stableRange / 15 // More price levels
            const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
            const normalizedStep = roughStep / magnitude
            
            let niceStep
            if (normalizedStep <= 1) niceStep = 1 * magnitude
            else if (normalizedStep <= 2) niceStep = 2 * magnitude
            else if (normalizedStep <= 5) niceStep = 5 * magnitude
            else niceStep = 10 * magnitude
            
            // Find the starting price (round down to nearest step)
            const startPrice = Math.floor(finalMin / niceStep) * niceStep
            
            // Generate price levels from bottom to top
            for (let price = startPrice; price <= finalMax + niceStep; price += niceStep) {
              // Calculate Y position using the SAME formula as chart candles
              const y = 50 + ((finalMax - price) / stableRange) * chartHeight
              
              // Only show labels that are visible on screen
              if (y >= 10 && y <= (canvasRef?.current?.offsetHeight || 400) - 10) {
                // Check if this is close to the current price
                const isNearCurrentPrice = Math.abs(price - currentPrice) < niceStep * 0.3
                
                priceLabels.push(
                  <div 
                    key={`price-${price.toFixed(2)}`}
                    className={`absolute text-right pr-2 text-xs font-mono transition-colors ${
                      isNearCurrentPrice 
                        ? 'bg-blue-500 text-white px-1 rounded font-bold' 
                        : 'text-gray-300'
                    }`}
                    style={{
                      top: `${y}px`,
                      right: '0px',
                      transform: 'translateY(-50%)',
                      width: '76px',
                      lineHeight: '1.2'
                    }}
                  >
                    {price.toFixed(price >= 1000 ? 0 : 1)}
                    {isNearCurrentPrice && (
                      <div className="inline-flex items-center ml-1">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                )
              }
            }
            
            // ALWAYS add the exact current price - it should never disappear
            const currentPriceY = 50 + ((finalMax - currentPrice) / stableRange) * chartHeight
            
            // Show current price if it's visible on screen
            if (currentPriceY >= 10 && currentPriceY <= (canvasRef?.current?.offsetHeight || 400) - 10) {
              // Determine color based on price direction - NEVER show neutral/yellow
              const getPriceColor = () => {
                if (priceDirection === 'up') {
                  return 'bg-green-500 text-white border-green-400'
                } else if (priceDirection === 'down') {
                  return 'bg-red-500 text-white border-red-400'
                } else {
                  // Default to green for initial state (most markets trend up over time)
                  return 'bg-green-500 text-white border-green-400'
                }
              }
              
              const getPulseColor = () => {
                if (priceDirection === 'up') {
                  return 'bg-green-400'
                } else if (priceDirection === 'down') {
                  return 'bg-red-400'
                } else {
                  // Default to green pulse
                  return 'bg-green-400'
                }
              }
              
              // Always add current price label with dynamic colors
              priceLabels.push(
                <div 
                  key="current-price-live"
                  className={`absolute text-right text-xs font-mono px-1 py-0 rounded font-bold border ${getPriceColor()}`}
                  style={{
                    top: `${currentPriceY}px`,
                    right: '2px',
                    transform: 'translateY(-50%)',
                    width: '72px',
                    lineHeight: '1.1',
                    zIndex: 15, // Higher than other labels
                    fontSize: '11px'
                  }}
                >
                  <span className="font-mono">{currentPrice.toFixed(1)}</span>
                  <div className="inline-flex items-center ml-0.5">
                    <div className={`w-1 h-1 rounded-full animate-pulse ${getPulseColor()}`} />
                  </div>
                </div>
              )
            }
            
            return priceLabels
          })()}
          
          {/* Real-time countdown - positioned relative to current price */}
          <div 
            className={`absolute right-1 border backdrop-blur-sm rounded px-1 py-0 text-xs font-mono text-white shadow-lg ${
              priceDirection === 'down' 
                ? 'bg-red-500/90 border-red-400/50' 
                : 'bg-green-500/90 border-green-400/50'
            }`}
            style={{
              top: (() => {
                if (candleData.length === 0) return '58%';
                
                // Use the SAME calculation as chart candles for perfect alignment
                const { finalMax, finalMin, priceRange: stableRange } = calculateStablePriceRange()
                const chartHeight = canvasRef?.current?.offsetHeight ? canvasRef.current.offsetHeight - 100 : 400
                
                // Calculate Y position using the SAME formula as chart candles, offset by 18px below current price (much closer)
                const currentPriceY = 50 + ((finalMax - currentPrice) / stableRange) * chartHeight
                const countdownY = currentPriceY + 18
                
                return `${countdownY}px`
              })(),
              transform: 'translateY(-50%)',
              fontSize: '11px',
              lineHeight: '1.1'
            }}
          >
            <div className="flex items-center space-x-0.5">
              <svg className="w-1.5 h-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
              </svg>
              <span className="font-mono text-[10px]">{realTimeCountdown}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}, arePropsEqual) 