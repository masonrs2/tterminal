/**
 * CVD Settings Component - Compact design matching other indicator settings
 * Draggable settings panel for CVD indicator configuration
 */

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { X, GripVertical, ChevronDown } from 'lucide-react'

interface CVDSettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    type: 'histogram' | 'line'
    lineColor: string
    lineWidth: number
    smoothing: boolean
    histogramBullColor: string
    histogramBearColor: string
    showZeroLine: boolean
    zeroLineColor: string
  }
  onSettingsChange: (settings: Partial<CVDSettingsProps['settings']>) => void
  initialPosition?: { x: number; y: number }
}

export const CVDSettings = forwardRef<HTMLDivElement, CVDSettingsProps>(
  ({ isOpen, onClose, settings, onSettingsChange, initialPosition = { x: 500, y: 200 } }, ref) => {
    const [position, setPosition] = useState(initialPosition)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [showTypeDropdown, setShowTypeDropdown] = useState(false)

    // Ensure all settings have default values to prevent controlled/uncontrolled input errors
    const safeSettings = {
      type: settings.type || 'histogram',
      lineColor: settings.lineColor || '#00ff88',
      lineWidth: settings.lineWidth || 2,
      smoothing: settings.smoothing || false,
      histogramBullColor: settings.histogramBullColor || '#00ff88',
      histogramBearColor: settings.histogramBearColor || '#ff4444',
      showZeroLine: settings.showZeroLine !== undefined ? settings.showZeroLine : true,
      zeroLineColor: settings.zeroLineColor || '#666666',
    }

    // Update setting helper
    const updateSetting = useCallback((key: string, value: any) => {
      onSettingsChange({ [key]: value })
    }, [onSettingsChange])

    // Dragging logic
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
        setIsDragging(true)
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y
        })
      }
    }, [position])

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
          setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
          })
        }
      }

      const handleMouseUp = () => {
        setIsDragging(false)
      }

      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isDragging, dragStart])

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = () => {
        setShowTypeDropdown(false)
      }

      if (showTypeDropdown) {
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
      }
    }, [showTypeDropdown])

    if (!isOpen) return null

    return (
      <div
        ref={ref}
        className="fixed bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 min-w-72"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-600 drag-handle cursor-grab">
          <div className="flex items-center space-x-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-light text-white">CVD Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-3 space-y-3">
          {/* CVD Type Dropdown */}
          <div>
            <h4 className="text-xs font-light text-gray-300 mb-1" style={{ fontSize: '10px' }}>Display Type</h4>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTypeDropdown(!showTypeDropdown)
                }}
                className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-2 py-1 text-white font-light hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors flex items-center justify-between"
                style={{ fontSize: '9px' }}
              >
                <span>{safeSettings.type === 'histogram' ? 'Histogram' : 'Line'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showTypeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-10">
                  <div
                    className={`px-2 py-1 cursor-pointer transition-colors font-light ${
                      safeSettings.type === 'histogram'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                    }`}
                    onClick={() => {
                      updateSetting('type', 'histogram')
                      setShowTypeDropdown(false)
                    }}
                    style={{ fontSize: '9px' }}
                  >
                    Histogram
                  </div>
                  <div
                    className={`px-2 py-1 cursor-pointer transition-colors font-light ${
                      safeSettings.type === 'line'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                    }`}
                    onClick={() => {
                      updateSetting('type', 'line')
                      setShowTypeDropdown(false)
                    }}
                    style={{ fontSize: '9px' }}
                  >
                    Line
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditional Settings based on type */}
          {safeSettings.type === 'histogram' ? (
            <>
              {/* Histogram Bull Color */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Bull Color</span>
                <input
                  type="color"
                  value={safeSettings.histogramBullColor}
                  onChange={(e) => updateSetting('histogramBullColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-600 cursor-pointer"
                />
              </div>

              {/* Histogram Bear Color */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Bear Color</span>
                <input
                  type="color"
                  value={safeSettings.histogramBearColor}
                  onChange={(e) => updateSetting('histogramBearColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-600 cursor-pointer"
                />
              </div>
            </>
          ) : (
            <>
              {/* Line Color */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Line Color</span>
                <input
                  type="color"
                  value={safeSettings.lineColor}
                  onChange={(e) => updateSetting('lineColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-600 cursor-pointer"
                />
              </div>

              {/* Line Width */}
              <div>
                <h4 className="text-xs font-light text-gray-300 mb-1" style={{ fontSize: '10px' }}>Line Width</h4>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={safeSettings.lineWidth}
                    onChange={(e) => updateSetting('lineWidth', parseInt(e.target.value))}
                    className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-light text-gray-300 w-6 text-center" style={{ fontSize: '9px' }}>
                    {safeSettings.lineWidth}
                  </span>
                </div>
              </div>

              {/* Smoothing */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Smoothing</span>
                <input
                  type="checkbox"
                  checked={safeSettings.smoothing}
                  onChange={(e) => updateSetting('smoothing', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Zero Line Settings */}
          <div className="border-t border-gray-600 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Show Zero Line</span>
              <input
                type="checkbox"
                checked={safeSettings.showZeroLine}
                onChange={(e) => updateSetting('showZeroLine', e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
            </div>

            {safeSettings.showZeroLine && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-gray-300" style={{ fontSize: '10px' }}>Zero Line Color</span>
                <input
                  type="color"
                  value={safeSettings.zeroLineColor}
                  onChange={(e) => updateSetting('zeroLineColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
)

CVDSettings.displayName = 'CVDSettings' 