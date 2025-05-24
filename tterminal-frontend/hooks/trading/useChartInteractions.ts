/**
 * Chart Interactions Hook
 * Manages mouse events, drawing tools, and chart interactions with ultra-fast axis-specific zoom
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
   * Detect if mouse is over Y-axis (price axis) or X-axis (time axis)
   */
  const getAxisZone = useCallback((x: number, y: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const priceAxisWidth = 80 // Right side price axis (w-20 = 80px)
    const timeAxisHeight = 32 // Bottom time axis (h-8 = 32px)
    const chartWidth = rect.width - priceAxisWidth
    const chartHeight = rect.height - timeAxisHeight
    
    // Check if in price axis zone (right edge) - expanded detection zone
    if (x >= chartWidth - 10 && x <= rect.width + 100) {
      return 'price-axis'
    }
    
    // Check if in time axis zone (bottom edge) - expanded detection zone
    if (y >= chartHeight - 10 && y <= rect.height + 100) {
      return 'time-axis'
    }
    
    return 'chart'
  }, [])

  /**
   * Handle mouse movement for crosshair, candle hover, and axis detection
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Handle active axis dragging only
      if (dragState.isDraggingPrice) {
        const deltaY = y - dragState.dragStart.y
        const sensitivity = 0.002 // Ultra-sensitive for professional trading
        const zoomFactor = 1 + (deltaY * sensitivity)
        
        setViewportState(prev => ({
          ...prev,
          priceZoom: Math.max(0.05, Math.min(50, prev.priceZoom * zoomFactor))
        }))
        
        // Update drag start for continuous movement
        setDragState(prev => ({ ...prev, dragStart: { x, y } }))
        return
      }

      if (dragState.isDraggingTime) {
        const deltaX = x - dragState.dragStart.x
        const sensitivity = 0.002 // Ultra-sensitive for professional trading
        const zoomFactor = 1 + (deltaX * sensitivity)
        
        setViewportState(prev => ({
          ...prev,
          timeZoom: Math.max(0.05, Math.min(50, prev.timeZoom * zoomFactor))
        }))
        
        // Update drag start for continuous movement
        setDragState(prev => ({ ...prev, dragStart: { x, y } }))
        return
      }

      // Don't interfere with existing chart dragging - let trading terminal handle it
      if (dragState.isDraggingChart) {
        return
      }

      // Detect axis zones and update cursor
      const axisZone = getAxisZone(x, y, canvas)
      if (axisZone === 'price-axis') {
        canvas.style.cursor = 'ns-resize'
      } else if (axisZone === 'time-axis') {
        canvas.style.cursor = 'ew-resize'
      } else {
        canvas.style.cursor = 'move'
      }

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
    [viewportState, candleData, dragState, setHoveredCandle, setMousePosition, setViewportState, setDragState, getAxisZone]
  )

  /**
   * Handle mouse down events for axis dragging only
   */
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check for axis dragging first - this takes priority
    const axisZone = getAxisZone(x, y, canvas)
    
    if (axisZone === 'price-axis') {
      setDragState(prev => ({
        ...prev,
        isDraggingPrice: true,
        dragStart: { x, y }
      }))
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    if (axisZone === 'time-axis') {
      setDragState(prev => ({
        ...prev,
        isDraggingTime: true,
        dragStart: { x, y }
      }))
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // For chart area, let the existing drawing and chart drag system handle it
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

    // Let the trading terminal handle chart panning - don't set isDraggingChart here
  }, [canvasRef, viewportState, drawingTools, drawingMode, candleData, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool, setDragState, getAxisZone])

  /**
   * Handle mouse up events to stop axis dragging
   */
  const handleAxisDragEnd = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDraggingPrice: false,
      isDraggingTime: false,
      isDraggingChart: false,
      isDraggingOrderbook: false,
      isDraggingCvd: false,
      isDraggingLiquidations: false
    }))
  }, [setDragState])

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
        // Stop any dragging
        setDragState(prev => ({
          ...prev,
          isDraggingPrice: false,
          isDraggingTime: false,
          isDraggingChart: false,
          isDraggingOrderbook: false,
          isDraggingCvd: false,
          isDraggingLiquidations: false
        }))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedDrawingIndex, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool, setDragState])

  /**
   * Handle wheel events for ultra-fast zooming with axis detection
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Detect which axis we're hovering over
    const axisZone = getAxisZone(x, y, canvas)
    
    // Ultra-aggressive zoom factors for lightning-fast response
    const wheelSensitivity = Math.abs(e.deltaY) / 50 // Increased sensitivity
    const baseZoomFactor = e.deltaY > 0 ? 0.8 : 1.25 // More aggressive base zoom
    const dynamicZoomFactor = e.deltaY > 0 
      ? Math.max(0.3, 1 - wheelSensitivity * 0.4)  // Ultra-fast zoom out
      : Math.min(3.0, 1 + wheelSensitivity * 0.5)  // Ultra-fast zoom in

    // Axis-specific zooming
    if (axisZone === 'price-axis' || e.ctrlKey || e.metaKey) {
      // Price zoom (vertical) - ultra responsive
      setViewportState(prev => ({
        ...prev,
        priceZoom: Math.max(0.05, Math.min(50, prev.priceZoom * dynamicZoomFactor))
      }))
    } else if (axisZone === 'time-axis') {
      // Time zoom (horizontal) - ultra responsive  
      setViewportState(prev => ({
        ...prev,
        timeZoom: Math.max(0.05, Math.min(50, prev.timeZoom * dynamicZoomFactor))
      }))
    } else {
      // Default behavior - time zoom when no modifier
      setViewportState(prev => ({
        ...prev,
        timeZoom: Math.max(0.05, Math.min(50, prev.timeZoom * dynamicZoomFactor))
      }))
    }
  }, [setViewportState, getAxisZone])

  return {
    handleMouseMove,
    handleCanvasMouseDown,
    handleAxisDragEnd,
    handleWheel,
  }
} 