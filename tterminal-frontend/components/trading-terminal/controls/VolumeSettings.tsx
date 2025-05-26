/**
 * Volume Settings Component - Compact design matching orderflow settings theme
 * Draggable settings panel for volume indicator configuration
 */

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { X, GripVertical, ChevronDown } from 'lucide-react'

interface VolumeSettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    showBuyVolume: boolean
    showSellVolume: boolean
    showDelta: boolean
    showPercentage: boolean
    showTotalVolume: boolean
    barType: 'total' | 'delta'
    buyColor: string
    sellColor: string
    deltaColor: string
    opacity: number
    barHeight: number
    position: 'bottom' | 'top'
  }
  onSettingsChange: (settings: any) => void
  initialPosition?: { x: number; y: number }
}

export const VolumeSettings = forwardRef<HTMLDivElement, VolumeSettingsProps>(({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  initialPosition = { x: 400, y: 100 }
}, ref) => {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showBarTypeDropdown, setShowBarTypeDropdown] = useState(false)
  const [showPositionDropdown, setShowPositionDropdown] = useState(false)

  const updateSetting = useCallback((key: string, value: any) => {
    onSettingsChange({ [key]: value })
  }, [onSettingsChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }, [isDragging, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowBarTypeDropdown(false)
      setShowPositionDropdown(false)
    }
    
    if (showBarTypeDropdown || showPositionDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBarTypeDropdown, showPositionDropdown])

  if (!isOpen) return null

  return (
    <div 
      ref={ref}
      className="fixed bg-[#181818] border border-gray-600 rounded shadow-lg z-50 min-w-64"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        fontSize: '11px'
      }}
    >
      {/* Header with drag handle */}
      <div 
        className="flex items-center justify-between p-2 bg-[#202020] rounded-t cursor-move border-b border-gray-600"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-1">
          <GripVertical className="w-3 h-3 text-gray-400" />
          <span className="font-light text-white" style={{ fontSize: '10px' }}>Volume Settings</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div 
        className="p-3 space-y-3 max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Volume Bar Type Dropdown - Custom styled to match indicators */}
        <div>
          <h4 className="text-xs font-light text-gray-300 mb-1" style={{ fontSize: '10px' }}>Volume Bar Type</h4>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowBarTypeDropdown(!showBarTypeDropdown)
                setShowPositionDropdown(false)
              }}
              className={`w-full flex items-center justify-between bg-[#0f0f0f] border border-gray-600 rounded px-2 py-1 text-white font-light hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors ${
                showBarTypeDropdown ? 'border-blue-500 bg-[#1a1a1a]' : ''
              }`}
              style={{ fontSize: '9px' }}
            >
              <span>{settings.barType === 'total' ? 'Total' : 'Delta'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showBarTypeDropdown && (
              <div className="absolute top-full left-0 right-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 mt-1">
                <div
                  className={`px-2 py-1 text-xs font-light cursor-pointer transition-colors ${
                    settings.barType === 'total'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSetting('barType', 'total')
                    setShowBarTypeDropdown(false)
                  }}
                  style={{ fontSize: '9px' }}
                >
                  Total
                </div>
                <div
                  className={`px-2 py-1 text-xs font-light cursor-pointer transition-colors ${
                    settings.barType === 'delta'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSetting('barType', 'delta')
                    setShowBarTypeDropdown(false)
                  }}
                  style={{ fontSize: '9px' }}
                >
                  Delta
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Display Options */}
        <div>
          <h4 className="text-xs font-light text-gray-300 mb-1" style={{ fontSize: '10px' }}>Display Options</h4>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-1 font-light hover:text-blue-300 transition-colors cursor-pointer" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showBuyVolume}
                onChange={(e) => updateSetting('showBuyVolume', e.target.checked)}
                className="w-2.5 h-2.5 rounded accent-blue-500"
              />
              <span>Show Buy Volume</span>
            </label>
            <label className="flex items-center space-x-1 font-light hover:text-blue-300 transition-colors cursor-pointer" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showSellVolume}
                onChange={(e) => updateSetting('showSellVolume', e.target.checked)}
                className="w-2.5 h-2.5 rounded accent-blue-500"
              />
              <span>Show Sell Volume</span>
            </label>
            <label className="flex items-center space-x-1 font-light hover:text-blue-300 transition-colors cursor-pointer" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showDelta}
                onChange={(e) => updateSetting('showDelta', e.target.checked)}
                className="w-2.5 h-2.5 rounded accent-blue-500"
              />
              <span>Show Delta</span>
            </label>
            <label className="flex items-center space-x-1 font-light hover:text-blue-300 transition-colors cursor-pointer" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showPercentage}
                onChange={(e) => updateSetting('showPercentage', e.target.checked)}
                className="w-2.5 h-2.5 rounded accent-blue-500"
              />
              <span>Show Percentage</span>
            </label>
            <label className="flex items-center space-x-1 font-light hover:text-blue-300 transition-colors cursor-pointer" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showTotalVolume}
                onChange={(e) => updateSetting('showTotalVolume', e.target.checked)}
                className="w-2.5 h-2.5 rounded accent-blue-500"
              />
              <span>Show Total Volume</span>
            </label>
          </div>
        </div>

        {/* Bar Height - Compact slider */}
        <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700 hover:border-blue-400 transition-colors">
          <div className="col-span-3">
            <span className="font-light text-blue-400" style={{ fontSize: '8px' }}>Bar height</span>
          </div>
          <div className="col-span-6">
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={settings.barHeight}
              onChange={(e) => updateSetting('barHeight', parseFloat(e.target.value))}
              className="w-full h-1 accent-blue-500"
            />
          </div>
          <div className="col-span-3">
            <span className="text-gray-400 font-light" style={{ fontSize: '7px' }}>{(settings.barHeight * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Colors - Compact grid */}
        <div>
          <h4 className="text-xs font-light text-gray-300 mb-1" style={{ fontSize: '10px' }}>Colors</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-gray-400 mb-1 font-light hover:text-blue-300 transition-colors" style={{ fontSize: '9px' }}>Buy</label>
              <input
                type="color"
                value={settings.buyColor}
                onChange={(e) => updateSetting('buyColor', e.target.value)}
                className="w-full h-6 rounded border border-gray-600 hover:border-blue-400 transition-colors cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1 font-light hover:text-blue-300 transition-colors" style={{ fontSize: '9px' }}>Sell</label>
              <input
                type="color"
                value={settings.sellColor}
                onChange={(e) => updateSetting('sellColor', e.target.value)}
                className="w-full h-6 rounded border border-gray-600 hover:border-blue-400 transition-colors cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1 font-light hover:text-blue-300 transition-colors" style={{ fontSize: '9px' }}>Delta</label>
              <input
                type="color"
                value={settings.deltaColor}
                onChange={(e) => updateSetting('deltaColor', e.target.value)}
                className="w-full h-6 rounded border border-gray-600 hover:border-blue-400 transition-colors cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Position and Opacity */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-gray-400 mb-1 font-light hover:text-blue-300 transition-colors" style={{ fontSize: '9px' }}>Position</label>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPositionDropdown(!showPositionDropdown)
                  setShowBarTypeDropdown(false)
                }}
                className={`w-full flex items-center justify-between bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-light hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors ${
                  showPositionDropdown ? 'border-blue-500 bg-[#1a1a1a]' : ''
                }`}
                style={{ fontSize: '9px' }}
              >
                <span>{settings.position === 'bottom' ? 'Bottom' : 'Top'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showPositionDropdown && (
                <div className="absolute top-full left-0 right-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 mt-1">
                  <div
                    className={`px-1 py-0.5 text-xs font-light cursor-pointer transition-colors ${
                      settings.position === 'bottom'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateSetting('position', 'bottom')
                      setShowPositionDropdown(false)
                    }}
                    style={{ fontSize: '9px' }}
                  >
                    Bottom
                  </div>
                  <div
                    className={`px-1 py-0.5 text-xs font-light cursor-pointer transition-colors ${
                      settings.position === 'top'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      updateSetting('position', 'top')
                      setShowPositionDropdown(false)
                    }}
                    style={{ fontSize: '9px' }}
                  >
                    Top
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-gray-400 mb-1 font-light hover:text-blue-300 transition-colors" style={{ fontSize: '9px' }}>Opacity</label>
            <input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.opacity}
              onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
              className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-light hover:border-blue-400 focus:border-blue-500 focus:outline-none transition-colors"
              style={{ fontSize: '9px' }}
            />
          </div>
        </div>

        {/* Reset Button */}
        <div className="pt-2 border-t border-gray-600">
          <button
            onClick={() => onSettingsChange({
              showBuyVolume: true,
              showSellVolume: true,
              showDelta: true,
              showPercentage: false,
              showTotalVolume: false,
              barType: "total",
              buyColor: "#00ff88",
              sellColor: "#ff4444",
              deltaColor: "#ffffff",
              opacity: 0.4,
              barHeight: 0.3,
              position: "bottom",
            })}
            className="w-full bg-gray-700 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors font-light"
            style={{ fontSize: '9px' }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}) 