/**
 * Symbol Tabs Component
 * Manages trading pair tabs and chart settings access
 */

import React, { useState } from 'react'
import { X, TrendingUp } from 'lucide-react'

interface SymbolTabsProps {
  showChartSettings: boolean
  onToggleChartSettings: () => void
  className?: string
}

const tradingPairs = [
  { symbol: 'solusdt', exchange: 'binancef', active: false },
  { symbol: 'btcusdt', exchange: 'binancef', active: true },
  { symbol: 'trumpusdt', exchange: 'binancef', active: false },
]

export const SymbolTabs: React.FC<SymbolTabsProps> = ({ 
  showChartSettings, 
  onToggleChartSettings,
  className = "" 
}) => {
  const [activePair, setActivePair] = useState('btcusdt')
  const activeChart = tradingPairs.find(pair => pair.symbol === activePair)

  const handlePairClick = (symbol: string) => {
    setActivePair(symbol)
  }

  return (
    <div className={`h-8 bg-[#181818] flex items-center px-2 border-b border-gray-700 ${className}`}>
      <div className="flex space-x-1">
        {tradingPairs.map((pair) => (
          <div 
            key={pair.symbol}
            className={`flex items-center px-2 py-1 rounded cursor-pointer transition-all ${
              pair.symbol === activePair
                ? 'bg-blue-600 text-white shadow-lg border border-blue-400'
                : 'bg-[#202020] hover:bg-[#2a2a2a] hover:border border-transparent'
            }`}
            onClick={() => handlePairClick(pair.symbol)}
          >
            {pair.symbol === activePair && (
              <TrendingUp className="w-3 h-3 mr-1 text-blue-300" />
            )}
            <span className="text-xs">{pair.exchange} {pair.symbol}</span>
            {pair.symbol === activePair ? (
              <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-400 transition-colors" />
            ) : pair.symbol !== 'btcusdt' && ( // Don't show X for non-active tabs except btcusdt
              <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-400 opacity-50 hover:opacity-100 transition-all" />
            )}
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live data feed"></div>
          <span
            className={`text-xs cursor-pointer transition-colors ${
              showChartSettings ? 'text-blue-300' : 'hover:text-blue-400'
            }`}
            onClick={onToggleChartSettings}
          >
            {activeChart?.exchange} {activeChart?.symbol}
          </span>
        </div>
        <X className="w-3 h-3 cursor-pointer hover:text-red-400 transition-colors" />
      </div>
    </div>
  )
} 