/**
 * Volume Profile Component - Professional volume profile visualization
 * Renders horizontal volume bars with delta analysis, POC, and value area
 * Matches industry standards from TradingView, Sierra Chart, etc.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import { useVolumeProfile } from '../../../hooks/trading/useVolumeProfile'
import type { VolumeProfileLevel, ViewportState, CandleData } from '../../../types/trading'

interface VolumeProfileProps {
  symbol: string
  timeRange: number
  rowCount: number
  enableRealTime: boolean
  valueAreaPercentage: number
  viewportState: ViewportState
  chartHeight: number
  chartWidth: number
  priceRange: { min: number; max: number }
  showDelta: boolean
  showPOC: boolean
  showValueArea: boolean
  showStatsBox?: boolean
  showVolumeText?: boolean
  opacity: number
  candleData: CandleData[]
  onPriceClick?: (price: number) => void
}

export const VolumeProfile: React.FC<VolumeProfileProps> = React.memo(({
  symbol,
  timeRange,
  rowCount,
  enableRealTime,
  valueAreaPercentage,
  viewportState,
  chartHeight,
  chartWidth,
  priceRange,
  showDelta = true,
  showPOC = true,
  showValueArea = true,
  showStatsBox = true,
  showVolumeText = false,
  opacity = 0.7,
  candleData,
  onPriceClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const {
    levels,
    poc,
    vah,
    val,
    totalVolume,
    totalDelta,
    isLoading,
    error,
    isRealTimeActive,
    maxVolumeLevel,
  } = useVolumeProfile({
    symbol,
    timeRange,
    rowCount,
    enableRealTime,
    valueAreaPercentage,
    candleData,
    viewportState,
    chartWidth,
    chartHeight,
  })

  // PERFORMANCE: Memoize volume profile configuration
  const volumeProfileConfig = useMemo(() => {
    if (!maxVolumeLevel || levels.length === 0) return null

    const maxBarWidth = chartWidth * 0.25 // 25% of chart width for volume bars
    const volumeScale = maxBarWidth / maxVolumeLevel.totalVolume
    
    // CRITICAL FIX: Calculate bar height to prevent overlapping
    // Only use levels that actually have volume and are visible
    const levelsWithVolume = levels.filter(level => 
      level.totalVolume > 0 && // Only levels with actual volume
      level.price >= priceRange.min && 
      level.price <= priceRange.max
    )
    
    if (levelsWithVolume.length === 0) {
      return null // No volume to display
    }
    
    // CRITICAL FIX: Calculate exact bar height to fill available space with NO overlapping
    // Each bar should take up exactly its portion of the price range
    const priceRangeSpan = priceRange.max - priceRange.min
    const pricePerPixel = priceRangeSpan / chartHeight
    
    // Calculate the price range each level covers
    const sortedLevels = [...levelsWithVolume].sort((a, b) => a.price - b.price)
    let averagePriceStep = 0
    
    if (sortedLevels.length > 1) {
      // Calculate average price step between levels
      let totalSteps = 0
      for (let i = 1; i < sortedLevels.length; i++) {
        totalSteps += sortedLevels[i].price - sortedLevels[i-1].price
      }
      averagePriceStep = totalSteps / (sortedLevels.length - 1)
    } else {
      // Single level - use a reasonable default
      averagePriceStep = priceRangeSpan / 50
    }
    
    // Convert price step to pixels and ensure no overlapping
    const barHeight = Math.max(1, Math.floor(averagePriceStep / pricePerPixel * 0.9)) // 90% to ensure small gap
    
    console.log(`📏 Anti-overlap bar height: ${barHeight}px for ${levelsWithVolume.length} levels (step: ${averagePriceStep.toFixed(2)}, range: ${priceRangeSpan.toFixed(2)})`)
    
    return {
      maxBarWidth,
      volumeScale,
      barHeight, // FIXED: Calculated to prevent overlapping
      startX: chartWidth - 80, // Start from price axis (80px is price axis width)
      levelsWithVolume: levelsWithVolume.length,
      averagePriceStep
    }
  }, [maxVolumeLevel?.totalVolume, levels, chartWidth, chartHeight, priceRange]) // PERFORMANCE: Include priceRange for visible levels

  // Convert price to Y coordinate
  const priceToY = useCallback((price: number): number => {
    const { min, max } = priceRange
    const priceRatio = (price - min) / (max - min)
    return chartHeight - (priceRatio * chartHeight)
  }, [priceRange, chartHeight])

  // Convert Y coordinate to price
  const yToPrice = useCallback((y: number): number => {
    const { min, max } = priceRange
    const ratio = (chartHeight - y) / chartHeight
    return min + (ratio * (max - min))
  }, [priceRange, chartHeight])

  // Render volume profile
  const renderVolumeProfile = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !volumeProfileConfig || levels.length === 0) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // CRITICAL FIX: Use chartWidth and chartHeight directly, not getBoundingClientRect
    const displayWidth = chartWidth
    const displayHeight = chartHeight

    // CRITICAL FIX: Reset canvas context completely
    ctx.save()
    ctx.clearRect(0, 0, displayWidth, displayHeight)
    ctx.globalAlpha = 1.0 // Start with full opacity
    ctx.globalCompositeOperation = 'source-over'

    const { volumeScale, barHeight, startX, levelsWithVolume, averagePriceStep } = volumeProfileConfig

    // CRITICAL FIX: Only render levels that have actual volume
    const levelsToRender = levels.filter(level => 
      level.totalVolume > 0 && // Only levels with actual trading volume
      level.price >= priceRange.min && 
      level.price <= priceRange.max
    )

    // DEBUG: Only log occasionally to avoid console spam
    if (Math.random() < 0.01) { // Log ~1% of renders
      console.log('Volume Profile Render:', {
        canvasSize: { width: displayWidth, height: displayHeight },
        levelsToRender: levelsToRender.length,
        totalLevels: levels.length,
        priceRange,
        volumeConfig: volumeProfileConfig,
        hasVisibleBars: levelsToRender.length > 0,
        startX,
        maxBarWidth: volumeProfileConfig.maxBarWidth,
        barHeight: barHeight, // FIXED: Log the anti-overlap bar height
        averagePriceStep: averagePriceStep
      })
    }

    if (levelsToRender.length === 0) {
      console.log('No volume levels to render in current viewport')
      return // Don't render anything if no volume levels
    }

    // Render value area background first (if enabled)
    if (showValueArea && vah && val) {
      const vahY = priceToY(vah)
      const valY = priceToY(val)
      
      ctx.fillStyle = 'rgba(100, 149, 237, 0.1)' // Light blue
      ctx.fillRect(0, vahY, displayWidth, valY - vahY)
      
      // Value area labels
      ctx.fillStyle = 'rgba(100, 149, 237, 0.8)'
      ctx.font = '10px monospace'
      ctx.fillText(`VAH: ${vah.toFixed(2)}`, 5, vahY - 2)
      ctx.fillText(`VAL: ${val.toFixed(2)}`, 5, valY + 12)
    }

    // Render volume bars
    ctx.globalAlpha = opacity // Apply opacity only to volume bars
    levelsToRender.forEach((level, index) => {
      const y = priceToY(level.price)
      const barWidth = level.totalVolume * volumeScale
      
      // CRITICAL FIX: Ensure bars are visible with minimum width
      const minBarWidth = 3 // Minimum 3px width for visibility
      const actualBarWidth = Math.max(minBarWidth, barWidth)
      
      if (showDelta) {
        // Split bar into buy/sell sections
        const buyWidth = Math.max(1, level.buyVolume * volumeScale)
        const sellWidth = Math.max(1, level.sellVolume * volumeScale)
        
        // CRITICAL FIX: Draw bars from right to left (from price axis towards chart)
        // Buy volume (green) - extends from right edge leftward
        ctx.fillStyle = level.delta > 0 ? 'rgba(34, 197, 94, 1.0)' : 'rgba(34, 197, 94, 0.7)'
        ctx.fillRect(startX - buyWidth, y - barHeight/2, buyWidth, barHeight)
        
        // Sell volume (red) - extends further left from buy volume
        ctx.fillStyle = level.delta < 0 ? 'rgba(239, 68, 68, 1.0)' : 'rgba(239, 68, 68, 0.7)'
        ctx.fillRect(startX - buyWidth - sellWidth, y - barHeight/2, sellWidth, barHeight)
        
        // Delta text - position to the left of the bars
        if (showVolumeText && actualBarWidth > 20) {
          ctx.fillStyle = level.delta > 0 ? '#22c55e' : '#ef4444'
          ctx.font = '9px monospace'
          ctx.textAlign = 'right'
          const deltaText = level.delta > 0 ? `+${level.delta.toFixed(0)}` : level.delta.toFixed(0)
          ctx.fillText(deltaText, startX - actualBarWidth - 5, y + 3)
        }
      } else {
        // Single color bar based on net delta - extends from right to left
        const color = level.delta > 0 ? 'rgba(34, 197, 94, 1.0)' : 
                     level.delta < 0 ? 'rgba(239, 68, 68, 1.0)' : 
                     'rgba(156, 163, 175, 1.0)'
        
        ctx.fillStyle = color
        ctx.fillRect(startX - actualBarWidth, y - barHeight/2, actualBarWidth, barHeight)
      }

      // Volume text - position in center of bar
      if (showVolumeText && actualBarWidth > 25) {
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        const volumeText = level.totalVolume > 1000 ? 
          `${(level.totalVolume / 1000).toFixed(1)}k` : 
          level.totalVolume.toFixed(0)
        ctx.fillText(volumeText, startX - actualBarWidth/2, y + 3)
      }
    })
    ctx.globalAlpha = 1.0 // Reset opacity for other elements

    // Render POC line (if enabled)
    if (showPOC && poc) {
      const pocY = priceToY(poc)
      
      // POC line
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, pocY)
      ctx.lineTo(displayWidth, pocY)
      ctx.stroke()
      ctx.setLineDash([])
      
      // POC label
      ctx.fillStyle = '#fbbf24'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`POC: ${poc.toFixed(2)}`, 5, pocY - 5)
    }

    // Real-time indicator
    if (isRealTimeActive) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.8)'
      ctx.beginPath()
      ctx.arc(displayWidth - 15, 15, 4, 0, 2 * Math.PI)
      ctx.fill()
      
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText('LIVE', displayWidth - 25, 19)
    }

    // CRITICAL FIX: Restore canvas context
    ctx.restore()
  }, [
    levels, volumeProfileConfig, priceRange, chartHeight, chartWidth, opacity,
    showDelta, showPOC, showValueArea, showVolumeText, poc, vah, val, isRealTimeActive, priceToY
  ])

  // Handle canvas click for price selection
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPriceClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const y = event.clientY - rect.top
    const price = yToPrice(y)
    
    onPriceClick(price)
  }, [onPriceClick, yToPrice])

  // Render on data changes
  useEffect(() => {
    renderVolumeProfile()
  }, [renderVolumeProfile])

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas size to match container with high-DPI support
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    // CRITICAL FIX: Set canvas internal size with DPI scaling
    canvas.width = chartWidth * dpr
    canvas.height = chartHeight * dpr
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
    
    // CRITICAL FIX: Set CSS size to match props exactly
    canvas.style.width = `${chartWidth}px`
    canvas.style.height = `${chartHeight}px`
    
    // Re-render after resize
    renderVolumeProfile()
  }, [chartWidth, chartHeight, renderVolumeProfile])

  if (error) {
    return (
      <div className="absolute top-4 right-4 bg-red-900/80 text-red-200 px-3 py-2 rounded text-sm z-50">
        Volume Profile Error: {error}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="absolute top-4 right-4 bg-blue-900/80 text-blue-200 px-3 py-2 rounded text-sm z-50">
        Loading Volume Profile...
      </div>
    )
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ 
          zIndex: 15, // CRITICAL FIX: Higher z-index to ensure canvas is above other elements
          width: `${chartWidth}px`,
          height: `${chartHeight}px`,
          display: 'block', // CRITICAL FIX: Ensure canvas is visible
          opacity: 1.0, // CRITICAL FIX: Full opacity for canvas itself
          position: 'absolute', // CRITICAL FIX: Explicit positioning
          top: 0,
          left: 0
        }}
        width={chartWidth * (window.devicePixelRatio || 1)}
        height={chartHeight * (window.devicePixelRatio || 1)}
      />
      
      {/* Volume Profile Stats - COMPACT VERSION */}
      {showStatsBox && (
        <div 
          className="absolute bg-blue-900/90 text-white px-2 py-1 rounded text-xs space-y-0.5 pointer-events-none border border-blue-500/50 backdrop-blur-sm shadow-lg" 
          style={{ 
            bottom: '10px', // CRITICAL FIX: Move to bottom to avoid test elements
            right: '120px', // Move further left to avoid price axis
            zIndex: 25, // Lower than canvas
            minWidth: '140px',
            display: 'block', // CRITICAL FIX: Ensure stats box is visible
            position: 'absolute', // CRITICAL FIX: Explicit positioning
            backgroundColor: 'rgba(30, 58, 138, 0.95)' // CRITICAL FIX: Explicit background
          }}
        >
          <div className="font-semibold text-blue-300 text-xs">Volume Profile</div>
          <div className="text-xs">Vol: {totalVolume > 1000000 ? 
            `${(totalVolume / 1000000).toFixed(1)}M` : 
            `${(totalVolume / 1000).toFixed(0)}k`}
          </div>
          <div className={`text-xs ${totalDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            Δ: {totalDelta > 0 ? '+' : ''}{totalDelta.toFixed(0)}
          </div>
          {poc && (
            <div className="text-yellow-400 text-xs">
              POC: {poc.toFixed(1)}
            </div>
          )}
          {showValueArea && vah && val && (
            <div className="text-blue-400 text-xs">
              VA: {val.toFixed(1)}-{vah.toFixed(1)}
            </div>
          )}
          <div className="text-xs text-gray-400">
            {timeRange}h • {levels.filter(l => l.price >= priceRange.min && l.price <= priceRange.max).length}/{levels.length}
          </div>
        </div>
      )}
    </>
  )
})

// PERFORMANCE: Add display name for debugging
VolumeProfile.displayName = 'VolumeProfile' 