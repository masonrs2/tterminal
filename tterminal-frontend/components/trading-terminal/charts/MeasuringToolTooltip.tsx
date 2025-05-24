/**
 * Measuring Tool Tooltip Component
 * Displays statistics for the selected measuring range
 */

import React from 'react'
import { X } from 'lucide-react'
import type { MeasuringSelection, CandleData } from '../../../types/trading'

interface MeasuringToolTooltipProps {
  measuringSelection: MeasuringSelection
  candleData: CandleData[]
  selectedTimeframe: string
  onClose: () => void
}

export const MeasuringToolTooltip: React.FC<MeasuringToolTooltipProps> = ({
  measuringSelection,
  candleData,
  selectedTimeframe,
  onClose,
}) => {
  console.log('MeasuringToolTooltip render check:', { 
    isActive: measuringSelection.isActive,
    startX: measuringSelection.startX,
    endX: measuringSelection.endX,
    startY: measuringSelection.startY,
    endY: measuringSelection.endY
  })
  
  if (!measuringSelection.isActive) return null
  
  console.log('MeasuringToolTooltip is rendering!')

  // Calculate statistics
  const startTimeIndex = Math.min(measuringSelection.startTimeIndex, measuringSelection.endTimeIndex)
  const endTimeIndex = Math.max(measuringSelection.startTimeIndex, measuringSelection.endTimeIndex)
  
  // Get actual price data from the first and last candles in the selection
  const startCandle = candleData[Math.max(0, startTimeIndex)]
  const endCandle = candleData[Math.min(candleData.length - 1, endTimeIndex)]
  
  const barsCount = Math.abs(endTimeIndex - startTimeIndex) + 1
  
  // Use actual candle close prices for more accurate calculation
  const startPrice = startCandle?.close || measuringSelection.startPrice
  const endPrice = endCandle?.close || measuringSelection.endPrice
  const priceChange = endPrice - startPrice
  const percentChange = ((priceChange / startPrice) * 100)
  const isGainSelection = priceChange > 0
  
  // Calculate volume in the range
  let totalVolume = 0
  for (let i = startTimeIndex; i <= endTimeIndex && i < candleData.length; i++) {
    if (candleData[i]) {
      totalVolume += candleData[i].volume
    }
  }

  // Calculate time duration based on timeframe
  const getTimeDuration = (bars: number, timeframe: string) => {
    const timeframeMinutes: { [key: string]: number } = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080,
    }
    
    const totalMinutes = bars * (timeframeMinutes[timeframe] || 15)
    
    if (totalMinutes < 60) {
      return `${totalMinutes}m`
    } else if (totalMinutes < 1440) {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    } else {
      const days = Math.floor(totalMinutes / 1440)
      const hours = Math.floor((totalMinutes % 1440) / 60)
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`
    }
  }

  const duration = getTimeDuration(barsCount, selectedTimeframe)

  // Position the tooltip near the selection
  const tooltipX = Math.max(measuringSelection.startX, measuringSelection.endX) + 10
  const tooltipY = Math.min(measuringSelection.startY, measuringSelection.endY)

  // Dynamic styling based on gain/loss
  const bgColor = isGainSelection ? 'bg-blue-600' : 'bg-red-600'
  const borderColor = isGainSelection ? 'border-blue-500' : 'border-red-500'
  const textSecondaryColor = isGainSelection ? 'text-blue-200' : 'text-red-200'
  const textPrimaryColor = isGainSelection ? 'text-blue-100' : 'text-red-100'

  return (
    <div
      className={`absolute z-50 ${bgColor} text-white text-xs rounded p-3 shadow-lg ${borderColor} border`}
      style={{
        left: `${tooltipX}px`,
        top: `${tooltipY}px`,
        minWidth: '180px',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className={`font-medium ${textPrimaryColor} text-sm leading-tight`}>
            {Math.abs(priceChange).toFixed(2)} ({Math.abs(percentChange).toFixed(2)}%) {(totalVolume / 1000000).toFixed(2)}M
          </div>
          <div className={`${textSecondaryColor} text-xs`}>
            {barsCount} bars, {duration}
          </div>
          <div className={`${textSecondaryColor} text-xs`}>
            Vol {(totalVolume / 1000000).toFixed(2)}M
          </div>
        </div>
        <button
          onClick={onClose}
          className={`ml-2 ${textSecondaryColor} hover:text-white transition-colors`}
          title="Remove measurement"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
} 