/**
 * Trading calculation utilities
 * Pure functions for price, time, and coordinate calculations
 */

/**
 * Calculate time remaining for current candle based on timeframe
 * Returns a real-time countdown to candle close
 */
export const getTimeRemaining = (selectedTimeframe: string): string => {
  const now = new Date()
  const currentTimestamp = now.getTime()
  
  // Calculate interval in milliseconds
  let intervalMs: number
  switch (selectedTimeframe) {
    case '1m':
      intervalMs = 60 * 1000
      break
    case '5m':
      intervalMs = 5 * 60 * 1000
      break
    case '15m':
      intervalMs = 15 * 60 * 1000
      break
    case '30m':
      intervalMs = 30 * 60 * 1000
      break
    case '1h':
      intervalMs = 60 * 60 * 1000
      break
    case '4h':
      intervalMs = 4 * 60 * 60 * 1000
      break
    case '1d':
      intervalMs = 24 * 60 * 60 * 1000
      break
    case '1w':
      intervalMs = 7 * 24 * 60 * 60 * 1000
      break
    default:
      intervalMs = 60 * 1000 // Default to 1 minute
  }
  
  // Calculate current candle start time
  const currentCandleStart = Math.floor(currentTimestamp / intervalMs) * intervalMs
  const nextCandleStart = currentCandleStart + intervalMs
  
  // Time remaining until next candle
  const timeRemaining = nextCandleStart - currentTimestamp
  
  // Convert to minutes and seconds
  const totalSeconds = Math.floor(timeRemaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  
  // Format based on timeframe
  if (intervalMs >= 60 * 60 * 1000) { // 1 hour or more
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000))
    const remainingMinutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000))
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

/**
 * Get current candle progress as percentage (0-100)
 * Used for progress bars and animations
 */
export const getCurrentCandleProgress = (selectedTimeframe: string): number => {
  const now = new Date()
  const currentTimestamp = now.getTime()
  
  // Calculate interval in milliseconds
  let intervalMs: number
  switch (selectedTimeframe) {
    case '1m':
      intervalMs = 60 * 1000
      break
    case '5m':
      intervalMs = 5 * 60 * 1000
      break
    case '15m':
      intervalMs = 15 * 60 * 1000
      break
    case '30m':
      intervalMs = 30 * 60 * 1000
      break
    case '1h':
      intervalMs = 60 * 60 * 1000
      break
    case '4h':
      intervalMs = 4 * 60 * 60 * 1000
      break
    case '1d':
      intervalMs = 24 * 60 * 60 * 1000
      break
    case '1w':
      intervalMs = 7 * 24 * 60 * 60 * 1000
      break
    default:
      intervalMs = 60 * 1000
  }
  
  // Calculate current candle start time
  const currentCandleStart = Math.floor(currentTimestamp / intervalMs) * intervalMs
  const timeElapsed = currentTimestamp - currentCandleStart
  
  return (timeElapsed / intervalMs) * 100
}

/**
 * Format timestamp to readable time string
 */
export const formatTime = (timestamp: number, includeSeconds: boolean = false): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  
  if (includeSeconds) {
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }
  
  return `${hours}:${minutes}`
}

/**
 * Format timestamp to readable date string
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear().toString().slice(-2)
  
  return `${month}/${day}/${year}`
}

/**
 * Get current candle timestamp for given timeframe
 */
export const getCurrentCandleTimestamp = (selectedTimeframe: string): number => {
  const now = new Date()
  const currentTimestamp = now.getTime()
  
  // Calculate interval in milliseconds
  let intervalMs: number
  switch (selectedTimeframe) {
    case '1m':
      intervalMs = 60 * 1000
      break
    case '5m':
      intervalMs = 5 * 60 * 1000
      break
    case '15m':
      intervalMs = 15 * 60 * 1000
      break
    case '30m':
      intervalMs = 30 * 60 * 1000
      break
    case '1h':
      intervalMs = 60 * 60 * 1000
      break
    case '4h':
      intervalMs = 4 * 60 * 60 * 1000
      break
    case '1d':
      intervalMs = 24 * 60 * 60 * 1000
      break
    case '1w':
      intervalMs = 7 * 24 * 60 * 60 * 1000
      break
    default:
      intervalMs = 60 * 1000
  }
  
  // Return current candle start time
  return Math.floor(currentTimestamp / intervalMs) * intervalMs
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