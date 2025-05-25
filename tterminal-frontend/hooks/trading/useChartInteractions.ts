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
  navigationMode: "auto" | "manual"
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
  navigationMode,
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

  // Store the original focal point to prevent drift
  const originalFocalPointRef = useRef<{ normalizedTime: number; normalizedPrice: number } | null>(null)
  const lastMousePositionRef = useRef<{ x: number; y: number } | null>(null)
  const lastZoomTimeRef = useRef<number>(0)
  const isZoomingRef = useRef<boolean>(false)
  
  // PERFORMANCE: Throttling refs to prevent excessive updates
  const lastMouseUpdateRef = useRef<number>(0)
  const mouseUpdateThrottleMs = 16 // ~60fps throttling

  /**
   * Calculate current candle height in pixels for smart zoom threshold detection
   */
  const calculateCandleHeight = useCallback((canvas: HTMLCanvasElement) => {
    if (candleDataRef.current.length === 0) return 0
    
    const chartHeight = canvas.offsetHeight - 100
    const prices = candleDataRef.current.map(c => [c.low, c.high]).flat()
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = (maxPrice - minPrice) / viewportState.priceZoom
    
    // Calculate average candle body height in pixels
    const avgCandleRange = candleDataRef.current.reduce((sum, candle) => {
      return sum + Math.abs(candle.close - candle.open)
    }, 0) / candleDataRef.current.length
    
    const avgCandleHeightPixels = (avgCandleRange / priceRange) * chartHeight
    return avgCandleHeightPixels
  }, [viewportState.priceZoom])

  /**
   * LASER-PRECISE ZOOM SYSTEM with perfect focal point preservation
   * Uses normalized coordinates (0-1) to eliminate floating point drift
   */
  const handleSmartZoom = useCallback((e: WheelEvent, canvas: HTMLCanvasElement, x: number, y: number) => {
    // Prevent infinite loops with debouncing
    if (isZoomingRef.current) {
      return
    }
    
    isZoomingRef.current = true
    
    // Reset after a short delay
    setTimeout(() => {
      isZoomingRef.current = false
    }, 16) // ~60fps
    
    // Ultra-snappy sensitivity for both modes
    const horizontalSensitivity = Math.abs(e.deltaY) / 25 // Snappy horizontal zoom
    const regularSensitivity = Math.abs(e.deltaY) / 34 // Regular sensitivity for 360 zoom
    
    if (navigationMode === 'auto') {
      // AUTO MODE: Horizontal zoom into the candle where vertical crosshair is
      // Ignore Y position - only focus on the candle under the vertical line
      const zoomFactor = e.deltaY > 0 
        ? Math.max(0.2, 1 - horizontalSensitivity * 0.7)  // Ultra-fast horizontal zoom out
        : Math.min(4.0, 1 + horizontalSensitivity * 0.8)  // Ultra-fast horizontal zoom in
        
      setViewportState(prev => {
        const newTimeZoom = Math.max(0.05, Math.min(50, prev.timeZoom * zoomFactor))
        
        // Maintain focal point for horizontal zoom - focus on the candle under vertical crosshair
        const spacing = 12
        const timePositionInChart = x - 50 + prev.timeOffset
        const timeFocalPoint = timePositionInChart / (spacing * prev.timeZoom)
        
        const newTimePosition = timeFocalPoint * spacing * newTimeZoom
        const newTimeOffset = newTimePosition - (x - 50)
        
        return {
          ...prev,
          timeZoom: newTimeZoom,
          timeOffset: newTimeOffset
          // Note: priceZoom and priceOffset remain unchanged in AUTO mode
        }
      })
    } else {
      // MANUAL MODE: Perfect magnifying glass zoom with zero drift
      const zoomDirection = e.deltaY > 0 ? 'out' : 'in'
      const zoomSensitivity = Math.abs(e.deltaY) / 34
      
      setViewportState(prev => {
        // Calculate chart dimensions
        const spacing = 12
        const chartHeight = canvas.offsetHeight - 100
        const chartWidth = canvas.offsetWidth - 100
        
        // Safety check to prevent infinite loops
        if (candleDataRef.current.length === 0) {
          return prev
        }
        
        // CRITICAL: Use a single, consistent price range calculation for both focal point and zoom
        // This MUST match the mouse position calculation exactly
        const calculatePriceRange = (zoom: number) => {
          const prices = candleDataRef.current.map(c => [c.low, c.high]).flat()
          if (prices.length === 0) return null
          
          // Use the EXACT same calculation as mouse position (no padding!)
          const priceMax = Math.max(...candleDataRef.current.map(c => c.high))
          const priceMin = Math.min(...candleDataRef.current.map(c => c.low))
          const priceRange = (priceMax - priceMin) / zoom
          
          return { priceMax, priceMin, priceRange }
        }
        
        // Reset focal point if mouse moved significantly (>5 pixels) or first zoom
        const mouseMovedSignificantly = !lastMousePositionRef.current || 
          Math.abs(x - lastMousePositionRef.current.x) > 5 || 
          Math.abs(y - lastMousePositionRef.current.y) > 5

        if (!originalFocalPointRef.current || mouseMovedSignificantly) {
          // Calculate the actual chart values that the mouse is pointing to
          const candleIndex = (x - 50 + prev.timeOffset) / (spacing * prev.timeZoom)
          
          // Use consistent price range calculation
          const priceInfo = calculatePriceRange(prev.priceZoom)
          if (!priceInfo) {
            return prev
          }
          
          const { priceMax, priceRange } = priceInfo
          
          // Calculate the actual price at the mouse position
          const actualPrice = priceMax - ((y - 50 + prev.priceOffset) / chartHeight) * priceRange
          
          // Store focal point as actual chart values
          originalFocalPointRef.current = {
            normalizedTime: candleIndex,
            normalizedPrice: actualPrice
          }
          lastMousePositionRef.current = { x, y }
        }
        
        // Simple zoom factors
        const zoomFactor = zoomDirection === 'in' 
          ? Math.min(2.5, 1 + zoomSensitivity * 0.6)  // Zoom in
          : Math.max(0.4, 1 - zoomSensitivity * 0.4)  // Zoom out
        
        // Apply zoom to both axes
        const newTimeZoom = Math.max(0.01, Math.min(50, prev.timeZoom * zoomFactor))
        const newPriceZoom = Math.max(0.01, Math.min(100, prev.priceZoom * zoomFactor))
        
        // Use the SAME consistent price range calculation for new zoom
        const newPriceInfo = calculatePriceRange(newPriceZoom)
        if (!newPriceInfo) {
          return prev
        }
        
        const { priceMax: newPriceMax, priceRange: newPriceRange } = newPriceInfo
        
        // Convert focal point back to screen position with new zoom
        const targetTimePosition = originalFocalPointRef.current.normalizedTime * spacing * newTimeZoom
        const targetPricePosition = ((newPriceMax - originalFocalPointRef.current.normalizedPrice) / newPriceRange) * chartHeight
        
        // Calculate exact offsets to keep focal point locked to crosshair position
        const newTimeOffset = targetTimePosition - (x - 50)
        const newPriceOffset = targetPricePosition - (y - 50)
        
        return {
          ...prev,
          timeZoom: newTimeZoom,
          priceZoom: newPriceZoom,
          timeOffset: newTimeOffset,
          priceOffset: newPriceOffset
        }
      })
    }
  }, [navigationMode, setViewportState])

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
   * Handle mouse movement for crosshair and hover effects
   * PERFORMANCE: Optimized to prevent infinite re-renders with throttling
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // PERFORMANCE: Throttle updates to ~60fps
      const now = Date.now()
      if (now - lastMouseUpdateRef.current < mouseUpdateThrottleMs) {
        return
      }
      lastMouseUpdateRef.current = now

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // PERFORMANCE: Use refs to avoid dependency issues
      const currentCandles = candleDataRef.current
      if (currentCandles.length === 0) {
        setMousePosition({ x, y, price: 0 })
        return
      }
      
      // PERFORMANCE: Calculate price using current viewport state from ref
      const chartHeight = canvas.height - 100
      const priceMax = Math.max(...currentCandles.map(c => c.high))
      const priceMin = Math.min(...currentCandles.map(c => c.low))
      const priceRange = (priceMax - priceMin) / viewportState.priceZoom
      const price = priceMax - ((y - 50 + viewportState.priceOffset) / chartHeight) * priceRange

      // PERFORMANCE: Only update if position changed significantly (throttling)
      const threshold = 2 // pixels
      if (Math.abs(x - (lastMousePositionRef.current?.x || 0)) > threshold || 
          Math.abs(y - (lastMousePositionRef.current?.y || 0)) > threshold) {
        setMousePosition({ x, y, price })
        lastMousePositionRef.current = { x, y }
      }
    },
    // PERFORMANCE: Minimal dependencies - only viewport state that affects price calculation
    [viewportState.priceZoom, viewportState.priceOffset, setMousePosition]
  )

  /**
   * Handle complex mouse interactions (axis dragging, measuring tool, hover detection)
   * PERFORMANCE: Separated from basic mouse position to prevent re-render issues
   */
  const handleComplexMouseInteractions = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Handle measuring tool creation with minimal state updates
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
        
        // PERFORMANCE: Only update if state actually changed
        if (measuringSelection.endX !== x || measuringSelection.endY !== y || measuringSelection.isActive !== isActive) {
          setMeasuringSelection(prev => ({
            ...prev,
            endX: x,
            endY: y,
            endTimeIndex,
            endPrice,
            isActive,
          }))
        }
        
        return
      }

      // Handle active axis dragging only
      if (dragState.isDraggingPrice) {
        const deltaY = y - dragState.dragStart.y
        const sensitivity = 0.002
        const zoomFactor = 1 + (deltaY * sensitivity)
        
        setViewportState(prev => ({
          ...prev,
          priceZoom: Math.max(0.05, Math.min(50, prev.priceZoom * zoomFactor))
        }))
        
        setDragState(prev => ({ ...prev, dragStart: { x, y } }))
        return
      }

      if (dragState.isDraggingTime) {
        const deltaX = x - dragState.dragStart.x
        const sensitivity = 0.002
        const zoomFactor = 1 + (deltaX * sensitivity)
        
        setViewportState(prev => ({
          ...prev,
          timeZoom: Math.max(0.05, Math.min(50, prev.timeZoom * zoomFactor))
        }))
        
        setDragState(prev => ({ ...prev, dragStart: { x, y } }))
        return
      }

      // PERFORMANCE: Only update cursor and hovered candle if not dragging
      if (!dragState.isDraggingPrice && !dragState.isDraggingTime && !dragState.isDraggingChart) {
        // Detect axis zones and update cursor
        const axisZone = getAxisZone(x, y, canvas)
        if (axisZone === 'price-axis') {
          canvas.style.cursor = 'ns-resize'
        } else if (axisZone === 'time-axis') {
          canvas.style.cursor = 'ew-resize'
        } else {
          canvas.style.cursor = 'move'
        }

        // Calculate which candle is being hovered (throttled)
        const candleWidth = 8 * viewportState.timeZoom
        const spacing = 12 * viewportState.timeZoom
        const startX = 50
        const candleIndex = Math.floor((x - startX + viewportState.timeOffset) / spacing)

        if (candleIndex >= 0 && candleIndex < candleDataRef.current.length) {
          setHoveredCandle(candleDataRef.current[candleIndex])
        }
      }
    },
    [
      // PERFORMANCE: Reduced dependencies - only include essential state
      viewportState.timeZoom, 
      viewportState.priceZoom, 
      viewportState.timeOffset, 
      viewportState.priceOffset, 
      dragState.isDraggingPrice, 
      dragState.isDraggingTime, 
      dragState.isDraggingChart,
      isCreatingMeasurement,
      measuringSelection.startX,
      measuringSelection.startY,
      measuringSelection.endX,
      measuringSelection.endY,
      measuringSelection.isActive,
      setViewportState,
      setDragState,
      setMeasuringSelection,
      setHoveredCandle,
      getAxisZone
    ]
  )

  /**
   * Combined mouse move handler that calls both basic and complex interactions
   * PERFORMANCE: Basic mouse position updates are optimized separately
   */
  const handleCombinedMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      handleMouseMove(e)
      handleComplexMouseInteractions(e)
    },
    [handleMouseMove, handleComplexMouseInteractions]
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
   * Handle wheel events for ultra-fast zooming with smart zoom system
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    // Prevent rapid-fire wheel events
    const now = Date.now()
    if (now - lastZoomTimeRef.current < 16) { // Limit to ~60fps
      return
    }
    lastZoomTimeRef.current = now
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Reset focal point when starting a new zoom sequence (after a pause)
    // This ensures each zoom sequence starts fresh without accumulated drift
    if (!lastZoomTimeRef.current || now - lastZoomTimeRef.current > 100) {
      originalFocalPointRef.current = null
    }
    
    // Detect which axis we're hovering over
    const axisZone = getAxisZone(x, y, canvas)
    
    // Axis-specific zooming with focal point preservation (unchanged)
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
      // SMART ZOOM SYSTEM: Use new intelligent zoom behavior
      handleSmartZoom(e, canvas, x, y)
    }
  }, [canvasRef, setViewportState, getAxisZone, handleSmartZoom])

  return {
    handleCombinedMouseMove,
    handleCanvasMouseDown,
    handleAxisDragEnd,
    handleMeasuringToolMouseUp,
    handleWheel,
  }
} 