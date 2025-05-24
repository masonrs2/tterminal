/**
 * Main Chart Component
 * Handles the primary price chart canvas with candlesticks, volume, and overlays
 */

import React, { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import type { 
  CandleData, 
  MousePosition, 
  Drawing, 
  ViewportState, 
  IndicatorSettings,
  VolumeProfileEntry,
  HeatmapData 
} from '../../../types/trading'
import { getTimeRemaining } from '../../../utils/trading/calculations'

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
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onMouseMove: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseDown: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onMouseMoveCapture: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void
  onAxisWheel?: (axisType: 'price', deltaY: number) => void
  className?: string
}

export const MainChart: React.FC<MainChartProps> = ({
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
  canvasRef,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onMouseMoveCapture,
  onContextMenu,
  onAxisWheel,
  className = ""
}) => {

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
      preventDefault: e.preventDefault.bind(e),
      stopPropagation: e.stopPropagation.bind(e)
    } as React.MouseEvent<HTMLCanvasElement>
    
    onMouseDown(mockCanvasEvent)
    e.stopPropagation()
  }, [onMouseDown, canvasRef])

  // Dedicated axis wheel handler for ultra-fast price zooming
  const handleAxisWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Pass wheel event to parent for ultra-fast zooming
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

    // Calculate dynamic price range from data
    const priceMax = Math.max(...candleData.map(c => c.high))
    const priceMin = Math.min(...candleData.map(c => c.low))
    const priceRange = priceMax - priceMin
    const chartHeight = canvas.offsetHeight - 100

    // Draw grid
    ctx.strokeStyle = "#333333"
    ctx.lineWidth = 0.5
    for (let i = 0; i < canvas.offsetWidth; i += 50 * viewportState.timeZoom) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvas.offsetHeight)
      ctx.stroke()
    }
    for (let i = 0; i < canvas.offsetHeight; i += 30 * viewportState.priceZoom) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvas.offsetWidth, i)
      ctx.stroke()
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

    // Draw volume profile (VPVR)
    if (activeIndicators.includes("VPVR")) {
      const maxVolume = Math.max(...volumeProfile.map((v) => v.volume))
      const profileWidth = 150
      const chartWidth = showOrderbook ? canvas.offsetWidth - 200 : canvas.offsetWidth - 80
      const startX = chartWidth - profileWidth - 20

      volumeProfile.forEach((profile) => {
        const y = 50 + ((priceMax - profile.price) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
        const width = (profile.volume / maxVolume) * profileWidth

        if (indicatorSettings.vpvr.deltaMode) {
          const deltaColor = profile.type === "buy" ? indicatorSettings.vpvr.bullColor : indicatorSettings.vpvr.bearColor
          ctx.fillStyle = deltaColor + "B3"
        } else {
          ctx.fillStyle = profile.type === "buy" ? indicatorSettings.vpvr.bullColor + "B3" : indicatorSettings.vpvr.bearColor + "B3"
        }

        if (indicatorSettings.vpvr.origin === "right") {
          ctx.fillRect(startX + profileWidth - width, y - 2, width, 4)
        } else {
          ctx.fillRect(startX, y - 2, width, 4)
        }
      })
    }

    // Draw support/resistance lines (cleaned up, no text labels)
    ctx.strokeStyle = "#4a90e2"
    ctx.lineWidth = 1
    ctx.setLineDash([])
    
    // Only draw if within reasonable bounds
    const supportLevel = 50 + (chartHeight * 0.7)
    const resistanceLevel = 50 + (chartHeight * 0.3)
    
    ctx.beginPath()
    ctx.moveTo(0, supportLevel)
    ctx.lineTo(canvas.offsetWidth - 80, supportLevel)
    ctx.stroke()

    ctx.strokeStyle = "#666666"
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, resistanceLevel)
    ctx.lineTo(canvas.offsetWidth - 80, resistanceLevel)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw candlesticks with dynamic price scaling
    const candleWidth = 8 * viewportState.timeZoom
    candleData.forEach((candle, index) => {
      const x = index * spacing + 50 - viewportState.timeOffset
      if (x < -candleWidth || x > canvas.offsetWidth) return

      // Dynamic price scaling based on actual data range
      const high = 50 + ((priceMax - candle.high) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
      const low = 50 + ((priceMax - candle.low) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
      const open = 50 + ((priceMax - candle.open) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
      const close = 50 + ((priceMax - candle.close) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset

      // Highlight hovered candle
      if (hoveredCandle && hoveredCandle.timestamp === candle.timestamp) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
        ctx.fillRect(x - 2, 0, candleWidth + 4, canvas.offsetHeight)
      }

      // Draw wick
      ctx.strokeStyle = candle.close > candle.open ? bullCandleColor : bearCandleColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + candleWidth / 2, high)
      ctx.lineTo(x + candleWidth / 2, low)
      ctx.stroke()

      // Draw body
      ctx.fillStyle = candle.close > candle.open ? bullCandleColor : bearCandleColor
      const bodyTop = Math.min(open, close)
      const bodyHeight = Math.abs(close - open)
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight)
    })

    // Draw current price line with dynamic scaling
    ctx.strokeStyle = "#ffff00"
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    const currentY = 50 + ((priceMax - currentPrice) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
    ctx.beginPath()
    ctx.moveTo(0, currentY)
    ctx.lineTo(canvas.offsetWidth - 200, currentY)
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
      ctx.lineTo(canvas.offsetWidth - 200, mousePosition.y)
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
      const y1 = 50 + ((priceMax - drawing.price1) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset
      const x2 = drawing.time2 * spacing + 50 - viewportState.timeOffset
      const y2 = 50 + ((priceMax - drawing.price2) / priceRange) * chartHeight * viewportState.priceZoom - viewportState.priceOffset

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
  }, [
    candleData,
    volumeProfile,
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
  ])

  return (
    <div className={`flex-1 relative min-h-0 ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        style={{ width: "100%", height: "100%" }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMoveCapture={onMouseMoveCapture}
        onContextMenu={onContextMenu}
      />

      {/* Interactive Price axis with drag support */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-20 bg-[#2a2a2a] border-l border-gray-700 cursor-ns-resize hover:bg-[#333333] transition-colors select-none"
        onMouseMove={handleAxisMouseMove}
        onMouseDown={handleAxisMouseDown}
        onMouseUp={onMouseUp}
                  onWheel={handleAxisWheel}
          title="Drag or scroll to zoom price axis vertically"
      >
        <div className="flex flex-col justify-between h-full py-2 text-xs">
          {(() => {
            const priceMax = Math.max(...candleData.map(c => c.high))
            const priceMin = Math.min(...candleData.map(c => c.low))
            const priceStep = (priceMax - priceMin) / 8
            return Array.from({ length: 9 }, (_, i) => {
              const price = priceMax - (i * priceStep)
              const isCurrentPrice = Math.abs(price - currentPrice) < priceStep / 2
              return (
                <div key={i} className={`text-right pr-2 ${isCurrentPrice ? 'bg-blue-500 text-white px-1 rounded' : ''}`}>
                  {price.toFixed(1)}
                </div>
              )
            })
          })()}
          <div className="text-right pr-2 bg-red-600 text-white px-1 rounded text-xs" style={{ marginTop: "2px" }} suppressHydrationWarning={true}>
            {getTimeRemaining(selectedTimeframe)}
          </div>
        </div>
      </div>
    </div>
  )
} 