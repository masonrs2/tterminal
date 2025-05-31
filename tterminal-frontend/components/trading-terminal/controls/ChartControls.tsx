/**
 * Chart Controls Component
 * Handles timeframes, indicators, drawing tools, and settings controls
 */

import React, { useCallback, useRef } from 'react'
import { ChevronDown, Minus, Square, X, Ruler } from 'lucide-react'
import { SymbolSelector } from './SymbolSelector'

interface ChartControlsProps {
  selectedSymbol: string
  onSymbolChange: (symbol: string) => void
  selectedTimeframe: string
  showTimeframes: boolean
  showIndicators: boolean
  showTools: boolean
  showSettings: boolean
  activeIndicators: string[]
  selectedDrawingTool: string | null
  navigationMode: "auto" | "manual"
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
  onToggleNavigationMode: () => void
  timeframesRef: React.RefObject<HTMLDivElement | null>
  indicatorsRef: React.RefObject<HTMLDivElement | null>
  toolsRef: React.RefObject<HTMLDivElement | null>
  settingsRef: React.RefObject<HTMLButtonElement | null>
  className?: string
  // Debug functions for cache management
  onClearCache?: () => void
  onForceRefresh?: () => void
  onForceCompleteRefresh?: () => void
}

const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]
const indicators = [
  "Heatmap", "Volume", "Trade Counter", "Funding Rate", "Liquidations",
  "CVD", "VWAP", "VPSV", "Orderbook Depth", "VPVR"
]
const drawingToolsList = ["Horizontal Ray", "Rectangle", "Measuring Tool"]

export const ChartControls: React.FC<ChartControlsProps> = ({
  selectedSymbol,
  onSymbolChange,
  selectedTimeframe,
  showTimeframes,
  showIndicators,
  showTools,
  showSettings,
  activeIndicators,
  selectedDrawingTool,
  navigationMode,
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
  onToggleNavigationMode,
  timeframesRef,
  indicatorsRef,
  toolsRef,
  settingsRef,
  className = "",
  // Debug functions for cache management
  onClearCache,
  onForceRefresh,
  onForceCompleteRefresh
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
    <div className={`h-8 bg-[#181818] flex items-center justify-between px-4 border-b border-gray-700 font-mono text-xs ${className}`}>
      <div className="flex items-center space-x-4">
        {/* Symbol Selector */}
        <SymbolSelector
          selectedSymbol={selectedSymbol}
          onSymbolChange={onSymbolChange}
        />

        {/* Timeframe Dropdown */}
        <div 
          className="relative" 
          ref={timeframesRef}
          onMouseEnter={() => handleDropdownEnter(onShowTimeframes, timeframesTimeoutRef)}
          onMouseLeave={() => handleDropdownLeave(onHideTimeframes, timeframesTimeoutRef)}
        >
          <button
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors font-mono text-xs ${
              showTimeframes 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'text-blue-400 hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            {selectedTimeframe} <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTimeframes && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 min-w-20"
              onMouseEnter={() => handleDropdownEnter(onShowTimeframes, timeframesTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideTimeframes, timeframesTimeoutRef)}
            >
              {timeframes.map((tf) => (
                <div
                  key={tf}
                  className={`px-2 py-1 cursor-pointer transition-colors font-mono ${
                    tf === selectedTimeframe
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={() => onSelectTimeframe(tf)}
                  style={{ fontSize: '10px' }}
                >
                  {tf}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="cursor-pointer hover:text-blue-400 transition-colors font-mono text-xs">Candlesticks</span>

        {/* Indicators Dropdown */}
        <div 
          className="relative" 
          ref={indicatorsRef}
          onMouseEnter={() => handleDropdownEnter(onShowIndicators, indicatorsTimeoutRef)}
          onMouseLeave={() => handleDropdownLeave(onHideIndicators, indicatorsTimeoutRef)}
        >
          <button
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors font-mono text-xs ${
              showIndicators 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            Indicators <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showIndicators && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 min-w-48"
              onMouseEnter={() => handleDropdownEnter(onShowIndicators, indicatorsTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideIndicators, indicatorsTimeoutRef)}
            >
              {indicators.map((indicator) => (
                <div
                  key={indicator}
                  className={`flex items-center justify-between px-2 py-1 cursor-pointer transition-colors font-mono ${
                    activeIndicators.includes(indicator)
                      ? 'bg-[#1a2a3a] hover:bg-[#2a3a4a] text-blue-300'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={() => onToggleIndicator(indicator)}
                  style={{ fontSize: '10px' }}
                >
                  <span className="font-mono">{indicator}</span>
                  <div
                    className={`w-2.5 h-2.5 rounded border transition-colors ${
                      activeIndicators.includes(indicator) 
                        ? "bg-blue-500 border-blue-500" 
                        : "border-gray-500"
                    }`}
                  >
                    {activeIndicators.includes(indicator) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-0.5 h-0.5 bg-white rounded-full"></div>
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
            className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors font-mono text-xs ${
              showTools 
                ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
                : 'hover:bg-[#1a1a1a] hover:border-blue-400'
            }`}
          >
            Tools <ChevronDown className="w-3 h-3 ml-1" />
          </button>
          {showTools && (
            <div 
              className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 min-w-48"
              onMouseEnter={() => handleDropdownEnter(onShowTools, toolsTimeoutRef)}
              onMouseLeave={() => handleDropdownLeave(onHideTools, toolsTimeoutRef)}
            >
              {drawingToolsList.map((tool) => (
                <div
                  key={tool}
                  className={`flex items-center justify-between px-2 py-1 cursor-pointer transition-colors font-mono ${
                    selectedDrawingTool === tool
                      ? 'bg-orange-600 text-white'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={() => onSelectDrawingTool(tool)}
                  style={{ fontSize: '10px' }}
                >
                  <span className="font-mono">{tool}</span>
                  {tool === "Horizontal Ray" && <Minus className="w-2.5 h-2.5" />}
                  {tool === "Rectangle" && <Square className="w-2.5 h-2.5" />}
                  {tool === "Measuring Tool" && <Ruler className="w-2.5 h-2.5" />}
                </div>
              ))}
              <div className="border-t border-gray-600 my-1"></div>
              <div
                className="flex items-center justify-between px-2 py-1 cursor-pointer transition-colors font-mono hover:bg-[#1a2a3a] hover:text-red-300"
                onClick={onClearDrawings}
                style={{ fontSize: '10px' }}
              >
                <span className="font-mono">Clear All Drawings</span>
                <X className="w-2.5 h-2.5" />
              </div>
              <div className="px-2 py-1 text-gray-400 text-center border-t border-gray-600 font-mono" style={{ fontSize: '9px' }}>
                Right-click to remove individual drawings
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onToggleSettings}
          className="cursor-pointer hover:text-blue-400 transition-colors font-mono text-xs"
          ref={settingsRef}
        >
          Settings
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <span className="font-mono text-xs">0.1</span>
        
        {/* Navigation Mode Toggle Button */}
        <button
          onClick={onToggleNavigationMode}
          className={`px-2 py-0.5 rounded text-xs font-mono transition-all duration-200 border ${
            navigationMode === 'auto' 
              ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
              : 'bg-orange-600 border-orange-500 text-white shadow-md'
          } hover:scale-105 active:scale-95`}
          title={navigationMode === 'auto' 
            ? 'Auto Mode: Horizontal-only chart navigation (click for manual mode)' 
            : 'Manual Mode: Full directional chart navigation (click for auto mode)'
          }
        >
          {navigationMode === 'auto' ? 'Auto' : 'Manual'}
        </button>
        
        <span 
          className="cursor-pointer hover:text-blue-400 transition-colors font-mono text-xs"
          onClick={onResetViewport}
          title="Reset chart zoom and position"
        >
          Reset
        </span>
        
        {/* Debug cache controls (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <>
            {onClearCache && (
              <span 
                className="cursor-pointer hover:text-yellow-400 transition-colors font-mono text-xs"
                onClick={onClearCache}
                title="Clear API cache"
              >
                Clear Cache
              </span>
            )}
            {onForceRefresh && (
              <span 
                className="cursor-pointer hover:text-green-400 transition-colors font-mono text-xs"
                onClick={onForceRefresh}
                title="Force refresh current timeframe"
              >
                Force Refresh
              </span>
            )}
            {onForceCompleteRefresh && (
              <span 
                className="cursor-pointer hover:text-red-400 transition-colors font-mono text-xs"
                onClick={onForceCompleteRefresh}
                title="Force complete refresh - clears all caches and fetches fresh data"
              >
                Complete Refresh
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
} 