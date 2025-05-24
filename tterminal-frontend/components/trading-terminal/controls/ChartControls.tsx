/**
 * Chart Controls Component
 * Handles timeframes, indicators, drawing tools, and settings controls
 */

import React from 'react'
import { ChevronDown, Minus, Square, X } from 'lucide-react'

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
const drawingToolsList = ["Horizontal Ray", "Rectangle"]

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
  return (
    <div className={`h-8 bg-[#181818] flex items-center justify-between px-4 border-b border-gray-700 ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Timeframe Dropdown */}
        <div 
          className="relative" 
          ref={timeframesRef}
          onMouseEnter={onShowTimeframes}
          onMouseLeave={onHideTimeframes}
        >
          <button
            className="flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 text-blue-400 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          >
            {selectedTimeframe} <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTimeframes && (
            <div className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-20">
              {timeframes.map((tf) => (
                <div
                  key={tf}
                  className="px-3 py-2 text-xs hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                  onClick={() => onSelectTimeframe(tf)}
                >
                  {tf}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="cursor-pointer hover:text-blue-400">Candlesticks</span>

        {/* Indicators Dropdown */}
        <div 
          className="relative" 
          ref={indicatorsRef}
          onMouseEnter={onShowIndicators}
          onMouseLeave={onHideIndicators}
        >
          <button
            className="flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          >
            Indicators <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showIndicators && (
            <div className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-48">
              {indicators.map((indicator) => (
                <div
                  key={indicator}
                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                  onClick={() => onToggleIndicator(indicator)}
                >
                  <span>{indicator}</span>
                  <div
                    className={`w-3 h-3 rounded border ${
                      activeIndicators.includes(indicator) 
                        ? "bg-blue-500 border-blue-500" 
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
          onMouseEnter={onShowTools}
          onMouseLeave={onHideTools}
        >
          <button
            className="flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
          >
            Tools <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTools && (
            <div className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-20 min-w-48">
              {drawingToolsList.map((tool) => (
                <div
                  key={tool}
                  className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                  onClick={() => onSelectDrawingTool(tool)}
                >
                  <span>{tool}</span>
                  {tool === "Horizontal Ray" && <Minus className="w-3 h-3" />}
                  {tool === "Rectangle" && <Square className="w-3 h-3" />}
                </div>
              ))}
              <div className="border-t border-gray-600 my-1"></div>
              <div
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#1a1a1a] cursor-pointer transition-colors"
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
          className="cursor-pointer hover:text-blue-400"
          ref={settingsRef}
        >
          Settings
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <span>0.1</span>
        <span>Auto</span>
        <span 
          className="cursor-pointer hover:text-blue-400"
          onClick={onResetViewport}
          title="Reset chart zoom and position"
        >
          Reset
        </span>
      </div>
    </div>
  )
} 