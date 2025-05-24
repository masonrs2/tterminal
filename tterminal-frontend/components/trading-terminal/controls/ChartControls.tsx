/**
 * Chart Controls Component
 * Handles timeframes, indicators, drawing tools, and settings controls
 */

import React, { useCallback, useRef } from 'react'
import { ChevronDown, Minus, Square, X, Ruler } from 'lucide-react'

interface ChartControlsProps {
  selectedTimeframe: string
  showTimeframes: boolean
  showIndicators: boolean
  showTools: boolean
  showSettings: boolean
  activeIndicators: string[]
  selectedDrawingTool: string | null
  onShowTimeframes: () => void
  onHideTimeframes: () => void
  onShowIndicators: () => void
  onHideIndicators: () => void
  onShowTools: () => void
  onHideTools: () => void
  onToggleSettings: () => void
  onSelectTimeframe: (timeframe: string) => void
  onToggleIndicator: (indicator: string) => void
  onSelectDrawingTool: (tool: string) => void
  onClearDrawings: () => void
  onResetViewport: () => void
  timeframesRef: React.RefObject<HTMLDivElement | null>
  indicatorsRef: React.RefObject<HTMLDivElement | null>
  toolsRef: React.RefObject<HTMLDivElement | null>
  settingsRef: React.RefObject<HTMLButtonElement | null>
  className?: string
}

const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]
const indicators = [
  "Heatmap", "Volumes", "Trade Counter", "Funding Rate", "Liquidations",
  "CVD", "VWAP", "VPSV", "Orderbook Depth", "VPVR"
]
const drawingToolsList = ["Horizontal Ray", "Rectangle", "Measuring Tool"]

export const ChartControls: React.FC<ChartControlsProps> = ({
  selectedTimeframe,
  showTimeframes,
  showIndicators,
  showTools,
  showSettings,
  activeIndicators,
  selectedDrawingTool,
  onShowTimeframes,
  onHideTimeframes,
  onShowIndicators,
  onHideIndicators,
  onShowTools,
  onHideTools,
  onToggleSettings,
  onSelectTimeframe,
  onToggleIndicator,
  onSelectDrawingTool,
  onClearDrawings,
  onResetViewport,
  timeframesRef,
  indicatorsRef,
  toolsRef,
  settingsRef,
  className = ""
}) => {
  // Timeout refs to manage delayed hiding
  const timeframesTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const indicatorsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const toolsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle dropdown hover with proper timeout management
  const handleDropdownEnter = useCallback((showFn: () => void, timeoutRef: React.RefObject<NodeJS.Timeout | null>) => {
    // Clear any pending hide timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    showFn()
  }, [])

  const handleDropdownLeave = useCallback((hideFn: () => void, timeoutRef: React.RefObject<NodeJS.Timeout | null>) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    // Set new timeout to hide dropdown
    timeoutRef.current = setTimeout(() => {
      hideFn()
      timeoutRef.current = null
    }, 150) // Slightly longer delay for better UX
  }, [])

  return (
    <div className={`h-8 bg-[#181818] flex items-center justify-between px-4 border-b border-gray-700 ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Timeframe Dropdown */}
        <div 
          className="relative" 
          ref={timeframesRef}
          onMouseEnter={() => handleDropdownEnter(onShowTimeframes, timeframesTimeoutRef)}
          onMouseLeave={() => handleDropdownLeave(onHideTimeframes, timeframesTimeoutRef)}
        >
          <button
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors ${
              showTimeframes 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'text-blue-400 hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            {selectedTimeframe} <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTimeframes && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-20"
              onMouseEnter={() => handleDropdownEnter(onShowTimeframes, timeframesTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideTimeframes, timeframesTimeoutRef)}
            >
              {timeframes.map((tf) => (
                <div
                  key={tf}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                    tf === selectedTimeframe
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-[#2a2a2a] hover:text-blue-300'
                  }`}
                  onClick={() => onSelectTimeframe(tf)}
                >
                  {tf}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="cursor-pointer hover:text-blue-400 transition-colors">Candlesticks</span>

        {/* Indicators Dropdown */}
        <div 
          className="relative" 
          ref={indicatorsRef}
          onMouseEnter={() => handleDropdownEnter(onShowIndicators, indicatorsTimeoutRef)}
          onMouseLeave={() => handleDropdownLeave(onHideIndicators, indicatorsTimeoutRef)}
        >
          <button
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors ${
              showIndicators 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            Indicators <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showIndicators && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-48"
              onMouseEnter={() => handleDropdownEnter(onShowIndicators, indicatorsTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideIndicators, indicatorsTimeoutRef)}
            >
              {indicators.map((indicator) => (
                <div
                  key={indicator}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                    activeIndicators.includes(indicator)
                      ? 'bg-[#1a2a1a] hover:bg-[#2a3a2a] text-green-300'
                      : 'hover:bg-[#2a2a2a] hover:text-blue-300'
                  }`}
                  onClick={() => onToggleIndicator(indicator)}
                >
                  <span>{indicator}</span>
                  <div
                    className={`w-3 h-3 rounded border transition-colors ${
                      activeIndicators.includes(indicator) 
                        ? "bg-green-500 border-green-500" 
                        : "border-gray-500"
                    }`}
                  >
                    {activeIndicators.includes(indicator) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools Dropdown */}
        <div 
          className="relative" 
          ref={toolsRef}
          onMouseEnter={() => handleDropdownEnter(onShowTools, toolsTimeoutRef)}
          onMouseLeave={() => handleDropdownLeave(onHideTools, toolsTimeoutRef)}
        >
          <button
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors ${
              showTools 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            Tools <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTools && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-48"
              onMouseEnter={() => handleDropdownEnter(onShowTools, toolsTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideTools, toolsTimeoutRef)}
            >
              {drawingToolsList.map((tool) => (
                <div
                  key={tool}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                    selectedDrawingTool === tool
                      ? 'bg-orange-600 text-white'
                      : 'hover:bg-[#2a2a2a] hover:text-blue-300'
                  }`}
                  onClick={() => onSelectDrawingTool(tool)}
                >
                  <span>{tool}</span>
                  {tool === "Horizontal Ray" && <Minus className="w-3 h-3" />}
                  {tool === "Rectangle" && <Square className="w-3 h-3" />}
                  {tool === "Measuring Tool" && <Ruler className="w-3 h-3" />}
                </div>
              ))}
              <div className="border-t border-gray-600 my-1"></div>
              <div
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#2a2a2a] hover:text-red-300 cursor-pointer transition-colors"
                onClick={onClearDrawings}
              >
                <span>Clear All Drawings</span>
                <X className="w-3 h-3" />
              </div>
              <div className="px-3 py-1 text-xs text-gray-400 text-center border-t border-gray-600">
                Right-click to remove individual drawings
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleSettings}
          className="cursor-pointer hover:text-blue-400 transition-colors"
          ref={settingsRef}
        >
          Settings
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <span>0.1</span>
        <span>Auto</span>
        <span 
          className="cursor-pointer hover:text-blue-400 transition-colors"
          onClick={onResetViewport}
          title="Reset chart zoom and position"
        >
          Reset
        </span>
      </div>
    </div>
  )
} 