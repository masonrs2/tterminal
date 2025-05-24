/**
 * Trading calculation utilities
 * Pure functions for price, time, and coordinate calculations
 */

/**
 * Calculate time remaining for current candle based on timeframe
 */
export const getTimeRemaining = (selectedTimeframe: string): string => {
  const now = new Date()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()

  let nextCandle
  if (selectedTimeframe === "15m") {
    const currentQuarter = Math.floor(minutes / 15)
    nextCandle = (currentQuarter + 1) * 15
  } else if (selectedTimeframe === "30m") {
    nextCandle = minutes < 30 ? 30 : 60
  } else {
    nextCandle = 60
  }

  const remainingMinutes = nextCandle === 60 ? 60 - minutes - 1 : nextCandle - minutes - 1
  const remainingSeconds = 60 - seconds

  return `${remainingMinutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

/**
 * Format timestamp for status display
 */
export const formatStatusDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}

/**
 * Convert screen coordinates to price/time coordinates
 */
export const screenToChartCoordinates = (
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  timeZoom: number,
  priceZoom: number,
  timeOffset: number,
  priceOffset: number
) => {
  const spacing = 12 * timeZoom
  const timeIndex = Math.floor((x - 50 + timeOffset) / spacing)
  const chartHeight = canvas.offsetHeight - 100
  const priceRange = (113000 - 107000) / priceZoom
  const price = 113000 - ((y - 50 + priceOffset) / chartHeight) * priceRange

  return { timeIndex, price, spacing, chartHeight, priceRange }
}

/**
 * Check if coordinates are within a drawing's bounds
 */
export const isPointInDrawing = (
  timeIndex: number,
  price: number,
  drawing: any,
  tolerance = 500
): boolean => {
  if (drawing.type === "Horizontal Ray") {
    return Math.abs(price - drawing.price1) < tolerance
  } else if (drawing.type === "Rectangle") {
    const withinTimeRange = timeIndex >= Math.min(drawing.time1, drawing.time2) && 
                           timeIndex <= Math.max(drawing.time1, drawing.time2)
    const withinPriceRange = price >= Math.min(drawing.price1, drawing.price2) && 
                            price <= Math.max(drawing.price1, drawing.price2)
    return withinTimeRange && withinPriceRange
  }
  return false
} 