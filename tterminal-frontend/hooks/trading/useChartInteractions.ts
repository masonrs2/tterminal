/**
 * Chart Interactions Hook
 * Manages mouse events, drawing tools, and chart interactions with ultra-fast axis-specific zoom
 */

import { useCallback, useEffect, useRef } from 'react'
import { screenToChartCoordinates, isPointInDrawing } from '../../utils/trading/calculations'
import type { CandleData, Drawing, ViewportState, DragState, MeasuringSelection } from '../../types/trading'

interface UseChartInteractionsProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  candleData: CandleData[]
  drawingMode: string | null
  drawingTools: Drawing[]
  selectedDrawingIndex: number | null
  viewportState: ViewportState
  dragState: DragState
  measuringSelection: MeasuringSelection
  isCreatingMeasurement: boolean
  setHoveredCandle: (candle: CandleData | null) => void
  setMousePosition: (pos: any) => void
  setDrawingTools: (tools: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void
  setSelectedDrawingIndex: (index: number | null) => void
  setDrawingMode: (mode: string | null) => void
  setSelectedDrawingTool: (tool: string | null) => void
  setDragState: (state: DragState | ((prev: DragState) => DragState)) => void
  setViewportState: (state: ViewportState | ((prev: ViewportState) => ViewportState)) => void
  setMeasuringSelection: (selection: MeasuringSelection | ((prev: MeasuringSelection) => MeasuringSelection)) => void
  setIsCreatingMeasurement: (creating: boolean) => void
}

export const useChartInteractions = ({
  canvasRef,
  candleData,
  drawingMode,
  drawingTools,
  selectedDrawingIndex,
  viewportState,
  dragState,
  measuringSelection,
  isCreatingMeasurement,
  setHoveredCandle,
  setMousePosition,
  setDrawingTools,
  setSelectedDrawingIndex,
  setDrawingMode,
  setSelectedDrawingTool,
  setDragState,
  setViewportState,
  setMeasuringSelection,
  setIsCreatingMeasurement,
}: UseChartInteractionsProps) => {

  // Use ref to avoid stale closure issues with candleData
  const candleDataRef = useRef(candleData)
  candleDataRef.current = candleData

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

      if (isCreatingMeasurement) {
        console.log('Canvas mouse move while creating measurement:', { x, y, isCreatingMeasurement })
      } else {
        // Debug: log when mouse move happens but no measuring tool active
        if (drawingMode === "Measuring Tool") {
          console.log('Mouse move with measuring tool selected but not creating:', { drawingMode, isCreatingMeasurement })
        }
      }

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

      // Handle measuring tool creation
      if (isCreatingMeasurement) {
        const { timeIndex: endTimeIndex, price: endPrice } = screenToChartCoordinates(
          x, y, canvas, 
          viewportState.timeZoom, 
          viewportState.priceZoom,
          viewportState.timeOffset, 
          viewportState.priceOffset
        )
        
        // Calculate distance to see if we should activate the selection
        const distance = Math.sqrt(
          Math.pow(x - measuringSelection.startX, 2) + 
          Math.pow(y - measuringSelection.startY, 2)
        )
        
        // Only activate if user has dragged at least 10 pixels
        const isActive = distance > 10
        
        if (distance > 5) { // Only log when there's some movement to reduce spam
        }

        if (isActive) {
          console.log('Measuring selection is now ACTIVE - rectangle should appear')
        }
        
        setMeasuringSelection(prev => {
          const newSelection = {
            ...prev,
            endX: x,
            endY: y,
            endTimeIndex,
            endPrice,
            isActive,
          }
          console.log('Updating measuring selection:', newSelection)
          return newSelection
        })
        
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

      if (candleIndex >= 0 && candleIndex < candleDataRef.current.length) {
        setHoveredCandle(candleDataRef.current[candleIndex])
      }

      // Calculate price at mouse position with dynamic range
      const chartHeight = canvas.offsetHeight - 100
      const priceMax = Math.max(...candleDataRef.current.map(c => c.high))
      const priceMin = Math.min(...candleDataRef.current.map(c => c.low))
      const priceRange = (priceMax - priceMin) / viewportState.priceZoom
      const price = priceMax - ((y - 50 + viewportState.priceOffset) / chartHeight) * priceRange

      setMousePosition({ x, y, price })
    },
    [viewportState.timeZoom, viewportState.priceZoom, viewportState.timeOffset, viewportState.priceOffset, dragState.isDraggingPrice, dragState.isDraggingTime, dragState.isDraggingChart, measuringSelection.startX, measuringSelection.startY, isCreatingMeasurement, getAxisZone]
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
          time2: candleDataRef.current.length,
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
    } else if (drawingMode === "Measuring Tool") {
      // Start measuring selection (but don't make it active until dragging)
      console.log('Starting measuring tool:', { x, y, timeIndex, price, drawingMode })
      setMeasuringSelection({
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        startTimeIndex: timeIndex,
        endTimeIndex: timeIndex,
        startPrice: price,
        endPrice: price,
        isActive: false, // Don't activate until we start dragging
      })
      setIsCreatingMeasurement(true)
      console.log('Set isCreatingMeasurement to true')
      return // Important: return early to prevent other handlers from interfering
    }

    // Let the trading terminal handle chart panning - don't set isDraggingChart here
  }, [canvasRef, viewportState.timeZoom, viewportState.priceZoom, viewportState.timeOffset, viewportState.priceOffset, drawingTools, drawingMode, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool, setDragState, setMeasuringSelection, setIsCreatingMeasurement, getAxisZone])

  /**
   * Handle mouse up events to stop axis dragging only (measuring tool handled separately)
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
   * Handle mouse up specifically for measuring tool
   */
  const handleMeasuringToolMouseUp = useCallback(() => {
    // Always finish measuring tool when mouse is released
    if (isCreatingMeasurement) {
      if (measuringSelection.isActive) {
        console.log('Finishing measuring tool creation with active selection - keeping measurement')
        // Keep the measurement visible but stop creating mode
        setIsCreatingMeasurement(false)
        setDrawingMode(null)
        setSelectedDrawingTool(null)
      } else {
        console.log('Finishing measuring tool creation without selection - canceling')
        // Cancel the measurement entirely
        setIsCreatingMeasurement(false)
        setDrawingMode(null)
        setSelectedDrawingTool(null)
        setMeasuringSelection(prev => ({ ...prev, isActive: false }))
      }
    }
  }, [isCreatingMeasurement, measuringSelection.isActive, setIsCreatingMeasurement, setDrawingMode, setSelectedDrawingTool, setMeasuringSelection])

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
        // Clear measuring selection
        setMeasuringSelection(prev => ({ ...prev, isActive: false }))
        setIsCreatingMeasurement(false)
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
  }, [selectedDrawingIndex, setDrawingTools, setSelectedDrawingIndex, setDrawingMode, setSelectedDrawingTool, setDragState, setMeasuringSelection, setIsCreatingMeasurement])

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
    
    // Axis-specific zooming with focal point preservation
    if (axisZone === 'price-axis' || e.ctrlKey || e.metaKey) {
      // Price zoom (vertical) with focal point
      const wheelSensitivity = Math.abs(e.deltaY) / 31
      const zoomFactor = e.deltaY > 0 
        ? Math.max(0.3, 1 - wheelSensitivity * 0.4)  // Controlled zoom out
        : Math.min(3.0, 1 + wheelSensitivity * 0.5)  // Controlled zoom in
        
      setViewportState(prev => {
        const newPriceZoom = Math.max(0.05, Math.min(50, prev.priceZoom * zoomFactor))
        
        // Maintain focal point for price axis
        const chartHeight = canvas.offsetHeight - 100
        const pricePositionInChart = y - 50 + prev.priceOffset
        const priceFocalPoint = pricePositionInChart / (chartHeight * prev.priceZoom)
        
        const newPricePosition = priceFocalPoint * chartHeight * newPriceZoom
        const newPriceOffset = newPricePosition - (y - 50)
        
        return {
          ...prev,
          priceZoom: newPriceZoom,
          priceOffset: newPriceOffset
        }
      })
    } else if (axisZone === 'time-axis') {
      // Time zoom (horizontal) with focal point
      const wheelSensitivity = Math.abs(e.deltaY) / 31
      const zoomFactor = e.deltaY > 0 
        ? Math.max(0.3, 1 - wheelSensitivity * 0.4)  // Controlled zoom out
        : Math.min(3.0, 1 + wheelSensitivity * 0.5)  // Controlled zoom in
        
      setViewportState(prev => {
        const newTimeZoom = Math.max(0.05, Math.min(50, prev.timeZoom * zoomFactor))
        
        // Maintain focal point for time axis
        const spacing = 12
        const timePositionInChart = x - 50 + prev.timeOffset
        const timeFocalPoint = timePositionInChart / (spacing * prev.timeZoom)
        
        const newTimePosition = timeFocalPoint * spacing * newTimeZoom
        const newTimeOffset = newTimePosition - (x - 50)
        
        return {
          ...prev,
          timeZoom: newTimeZoom,
          timeOffset: newTimeOffset
        }
      })
    } else {
      // ⚡ 360 ZOOM - Camera-style focal point zooming ⚡
      const sensitivity = Math.abs(e.deltaY) / 34
      const zoomFactor = e.deltaY > 0 
        ? Math.max(0.4, 1 - sensitivity * 0.4)  // Zoom out
        : Math.min(2.5, 1 + sensitivity * 0.5)  // Zoom in
      
      setViewportState(prev => {
        // Calculate the new zoom levels
        const newTimeZoom = Math.max(0.01, Math.min(100, prev.timeZoom * zoomFactor))
        const newPriceZoom = Math.max(0.01, Math.min(100, prev.priceZoom * zoomFactor))
        
        // Calculate focal point in chart coordinates
        const chartHeight = canvas.offsetHeight - 100
        const spacing = 12 // Base spacing
        
        // Time focal point (horizontal)
        const timePositionInChart = x - 50 + prev.timeOffset // Position relative to chart start
        const timeFocalPoint = timePositionInChart / (spacing * prev.timeZoom) // Normalized position
        
        // Price focal point (vertical) 
        const pricePositionInChart = y - 50 + prev.priceOffset // Position relative to chart start
        const priceFocalPoint = pricePositionInChart / (chartHeight * prev.priceZoom) // Normalized position
        
        // Calculate new offsets to maintain focal point
        const newTimePosition = timeFocalPoint * spacing * newTimeZoom
        const newTimeOffset = newTimePosition - (x - 50)
        
        const newPricePosition = priceFocalPoint * chartHeight * newPriceZoom
        const newPriceOffset = newPricePosition - (y - 50)
        
        return {
          ...prev,
          timeZoom: newTimeZoom,
          priceZoom: newPriceZoom,
          timeOffset: newTimeOffset,
          priceOffset: newPriceOffset
        }
      })
    }
  }, [canvasRef, setViewportState, getAxisZone])

  return {
    handleMouseMove,
    handleCanvasMouseDown,
    handleAxisDragEnd,
    handleMeasuringToolMouseUp,
    handleWheel,
  }
} 