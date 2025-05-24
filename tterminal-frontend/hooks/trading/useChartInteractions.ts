/**
 * Chart Interactions Hook
 * Manages mouse events, drawing tools, and chart interactions
 */

import { useCallback, useEffect } from 'react'
import { screenToChartCoordinates, isPointInDrawing } from '../../utils/trading/calculations'
import type { CandleData, Drawing, ViewportState, DragState } from '../../types/trading'

interface UseChartInteractionsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  candleData: CandleData[]
  drawingMode: string | null
  drawingTools: Drawing[]
  selectedDrawingIndex: number | null
  viewportState: ViewportState
  dragState: DragState
  setHoveredCandle: (candle: CandleData | null) => void
  setMousePosition: (pos: any) => void
  setDrawingTools: (tools: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void
  setSelectedDrawingIndex: (index: number | null) => void
  setDrawingMode: (mode: string | null) => void
  setSelectedDrawingTool: (tool: string | null) => void
  setDragState: (state: DragState | ((prev: DragState) => DragState)) => void
  setViewportState: (state: ViewportState | ((prev: ViewportState) => ViewportState)) => void
}

export const useChartInteractions = ({
  canvasRef,
  candleData,
  drawingMode,
  drawingTools,
  selectedDrawingIndex,
  viewportState,
  dragState,
  setHoveredCandle,
  setMousePosition,
  setDrawingTools,
  setSelectedDrawingIndex,
  setDrawingMode,
  setSelectedDrawingTool,
  setDragState,
  setViewportState,
}: UseChartInteractionsProps) => {

  /**
   * Handle mouse movement for crosshair and candle hover detection
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Calculate which candle is being hovered
      const candleWidth = 8 * viewportState.timeZoom
      const spacing = 12 * viewportState.timeZoom
      const startX = 50
      const candleIndex = Math.floor((x - startX + viewportState.timeOffset) / spacing)

      if (candleIndex >= 0 && candleIndex < candleData.length) {
        setHoveredCandle(candleData[candleIndex])
      }

      // Calculate price at mouse position
      const chartHeight = canvas.offsetHeight - 100
      const priceRange = (113000 - 107000) / viewportState.priceZoom
      const price = 113000 - ((y - 50 + viewportState.priceOffset) / chartHeight) * priceRange

      setMousePosition({ x, y, price })
    },
    [viewportState, candleData, setHoveredCandle, setMousePosition]
  )

  /**
   * Handle mouse down events for chart interactions
   */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const { timeIndex, price } = screenToChartCoordinates(
      x, y, canvas, 
      viewportState.timeZoom, 
      viewportState.priceZoom,
      viewportState.timeOffset, 
      viewportState.priceOffset
    )

    // Find clicked drawing
    let clickedDrawingIndex = -1
    let closestDistance = Infinity

    drawingTools.forEach((tool, index) => {
      if (isPointInDrawing(timeIndex, price, tool)) {
        if (tool.type === "Horizontal Ray") {
          const distance = Math.abs(price - tool.price1)
          if (distance < closestDistance) {
            closestDistance = distance
            clickedDrawingIndex = index
          }
        } else {
          clickedDrawingIndex = index
        }
      }
    })

    // Right-click to remove drawings
    if (e.button === 2) {
      e.preventDefault()
      if (clickedDrawingIndex !== -1) {
        setDrawingTools((prev) => {
          const updatedTools = [...prev]
          updatedTools.splice(clickedDrawingIndex, 1)
          return updatedTools
        })
        setSelectedDrawingIndex(null)
      }
      return
    }

    // Left-click to select drawing or start new drawing
    if (clickedDrawingIndex !== -1) {
      setSelectedDrawingIndex(clickedDrawingIndex)
      return
    } else {
      setSelectedDrawingIndex(null)
    }

    // Handle drawing mode
    if (!drawingMode) return

    if (drawingMode === "Horizontal Ray") {
      setDrawingTools((prev) => [
        ...prev,
        {
          type: "Horizontal Ray",
          price1: price,
          time1: 0,
          price2: price,
          time2: candleData.length,
          color: "#ffff00",
          lineWidth: 1,
        },
      ])
      setDrawingMode(null)
      setSelectedDrawingTool(null)
    } else if (drawingMode === "Rectangle") {
      setDrawingTools((prev) => [
        ...prev,
        {
          type: "Rectangle",
          price1: price,
          time1: timeIndex,
          price2: price,
          time2: timeIndex,
          color: "#ffff00",
          lineWidth: 1,
        },
      ])
    }
  }, [canvasRef, viewportState, drawingTools, drawingMode, candleData, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool])

  /**
   * Handle keyboard shortcuts for drawing management
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedDrawingIndex !== null) {
          setDrawingTools((prev) => {
            const updatedTools = [...prev]
            updatedTools.splice(selectedDrawingIndex, 1)
            return updatedTools
          })
          setSelectedDrawingIndex(null)
        }
      }
      
      if (event.key === 'Escape') {
        setSelectedDrawingIndex(null)
        setDrawingMode(null)
        setSelectedDrawingTool(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDrawingIndex, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool])

  /**
   * Handle wheel events for ultra-fast zooming (360-style)
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    // Ultra-fast zoom factors for responsive trading
    const fastZoomFactor = e.deltaY > 0 ? 0.7 : 1.4  // Much more aggressive zoom
    const wheelSensitivity = Math.abs(e.deltaY) / 100 // Scale based on wheel speed
    const dynamicZoomFactor = e.deltaY > 0 
      ? Math.max(0.5, 1 - wheelSensitivity * 0.3)  // Faster zoom out
      : Math.min(2.0, 1 + wheelSensitivity * 0.4)  // Faster zoom in

    if (e.ctrlKey || e.metaKey) {
      // Price zoom (vertical) - ultra responsive
      setViewportState(prev => ({
        ...prev,
        priceZoom: Math.max(0.05, Math.min(20, prev.priceZoom * dynamicZoomFactor))
      }))
    } else {
      // Time zoom (horizontal) - ultra responsive  
      setViewportState(prev => ({
        ...prev,
        timeZoom: Math.max(0.05, Math.min(20, prev.timeZoom * dynamicZoomFactor))
      }))
    }
  }, [setViewportState])

  return {
    handleMouseMove,
    handleCanvasMouseDown,
    handleWheel,
  }
} 