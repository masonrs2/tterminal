/**
 * Symbol Tabs Component
 * Manages trading pair tabs and chart settings access
 */

import React from 'react'
import { X } from 'lucide-react'

interface SymbolTabsProps {
  showChartSettings: boolean
  onToggleChartSettings: () => void
  className?: string
}

export const SymbolTabs: React.FC<SymbolTabsProps> = ({ 
  showChartSettings, 
  onToggleChartSettings,
  className = "" 
}) => {
  return (
    <div className={`h-8 bg-[#2a2a2a] flex items-center px-2 border-b border-gray-700 ${className}`}>
      <div className="flex space-x-1">
        <div className="flex items-center bg-[#3a3a3a] px-2 py-1 rounded cursor-pointer hover:bg-[#4a4a4a]">
          <span className="text-xs">binancef solusdt</span>
        </div>
        <div className="flex items-center bg-[#4a4a4a] px-2 py-1 rounded cursor-pointer">
          <span className="text-xs">binancef btcusdt</span>
          <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-400" />
        </div>
        <div className="flex items-center bg-[#3a3a3a] px-2 py-1 rounded cursor-pointer hover:bg-[#4a4a4a]">
          <span className="text-xs">binancef trumpusdt</span>
        </div>
      </div>
      <div className="ml-auto flex items-center space-x-4">
        <span
          className="text-xs cursor-pointer hover:text-blue-400"
          onClick={onToggleChartSettings}
        >
          binancef btcusdt
        </span>
        <X className="w-3 h-3 cursor-pointer hover:text-red-400" />
      </div>
    </div>
  )
} 