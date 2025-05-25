/**
 * VPVR Settings Component - Compact design matching orderflow settings theme
 * Draggable settings panel with instant rendering optimizations
 */

import React, { useState, useEffect, useCallback, forwardRef } from 'react'
import { X, GripVertical } from 'lucide-react'

interface VPVRSettingsProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    enableFixedTicks: boolean
    rowCount: number
    bullColor: string
    bearColor: string
    origin: 'left' | 'right'
    showPOC: boolean
    pocLineColor: string
    valueArea: number
    deltaMode: boolean
    showStatsBox: boolean
    opacity: number
  }
  onSettingsChange: (settings: any) => void
  initialPosition?: { x: number; y: number }
}

export const VPVRSettings = forwardRef<HTMLDivElement, VPVRSettingsProps>(({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  initialPosition = { x: 400, y: 100 }
}, ref) => {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Handle dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    e.preventDefault()
  }, [position])

  // Drag effect
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  // PERFORMANCE: Instant settings update
  const updateSetting = useCallback((key: string, value: any) => {
    onSettingsChange({
      ...settings,
      [key]: value
    })
  }, [settings, onSettingsChange])

  // Prevent panel from closing when clicking inside
  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  if (!isOpen) return null

  return (
    <div 
      className="fixed z-50 bg-[#1a1a1a] border border-gray-600 rounded-lg shadow-2xl min-w-80 max-w-96"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onClick={handlePanelClick}
      ref={ref}
    >
      {/* Draggable header */}
      <div 
        className="flex items-center justify-between p-2 border-b border-gray-600 cursor-grab active:cursor-grabbing bg-[#252525] rounded-t-lg"
        onMouseDown={handleDragStart}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-2">
          <GripVertical className="w-3 h-3 text-gray-400" />
          <h3 className="text-xs font-semibold text-white">VPVR Settings</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Settings content - Compact design */}
      <div 
        className="p-3 space-y-3 max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Display Options */}
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-1" style={{ fontSize: '10px' }}>Display Options</h4>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.enableFixedTicks}
                onChange={(e) => updateSetting('enableFixedTicks', e.target.checked)}
                className="w-2.5 h-2.5 rounded"
              />
              <span>Enable fixed ticks</span>
            </label>
            <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showPOC}
                onChange={(e) => updateSetting('showPOC', e.target.checked)}
                className="w-2.5 h-2.5 rounded"
              />
              <span>Show POC</span>
            </label>
            <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.deltaMode}
                onChange={(e) => updateSetting('deltaMode', e.target.checked)}
                className="w-2.5 h-2.5 rounded"
              />
              <span>Delta Mode</span>
            </label>
            <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
              <input
                type="checkbox"
                checked={settings.showStatsBox}
                onChange={(e) => updateSetting('showStatsBox', e.target.checked)}
                className="w-2.5 h-2.5 rounded"
              />
              <span>Show Stats Box</span>
            </label>
          </div>
        </div>

        {/* Row Count - Compact slider */}
        <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
          <div className="col-span-3">
            <span className="font-medium text-blue-400" style={{ fontSize: '8px' }}>Row count</span>
          </div>
          <div className="col-span-6">
            <input
              type="range"
              min="20"
              max="200"
              step="4"
              value={settings.rowCount}
              onChange={(e) => updateSetting('rowCount', parseInt(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div className="col-span-3">
            <span className="text-gray-400" style={{ fontSize: '7px' }}>{settings.rowCount}</span>
          </div>
        </div>

        {/* Colors - Compact grid */}
        <div>
          <h4 className="text-xs font-medium text-gray-300 mb-1" style={{ fontSize: '10px' }}>Colors</h4>
          <div className="space-y-1">
            {/* Bull Color */}
            <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
              <div className="col-span-2">
                <span className="font-medium text-green-400" style={{ fontSize: '8px' }}>Bull</span>
              </div>
              <div className="col-span-1">
                <input
                  type="color"
                  value={settings.bullColor}
                  onChange={(e) => updateSetting('bullColor', e.target.value)}
                  className="w-3 h-2.5 rounded border-0"
                />
              </div>
              <div className="col-span-9">
                <input
                  type="text"
                  value={settings.bullColor}
                  onChange={(e) => updateSetting('bullColor', e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                  style={{ fontSize: '7px' }}
                />
              </div>
            </div>

            {/* Bear Color */}
            <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
              <div className="col-span-2">
                <span className="font-medium text-red-400" style={{ fontSize: '8px' }}>Bear</span>
              </div>
              <div className="col-span-1">
                <input
                  type="color"
                  value={settings.bearColor}
                  onChange={(e) => updateSetting('bearColor', e.target.value)}
                  className="w-3 h-2.5 rounded border-0"
                />
              </div>
              <div className="col-span-9">
                <input
                  type="text"
                  value={settings.bearColor}
                  onChange={(e) => updateSetting('bearColor', e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                  style={{ fontSize: '7px' }}
                />
              </div>
            </div>

            {/* POC Line Color */}
            <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
              <div className="col-span-2">
                <span className="font-medium text-yellow-400" style={{ fontSize: '8px' }}>POC</span>
              </div>
              <div className="col-span-1">
                <input
                  type="color"
                  value={settings.pocLineColor}
                  onChange={(e) => updateSetting('pocLineColor', e.target.value)}
                  className="w-3 h-2.5 rounded border-0"
                />
              </div>
              <div className="col-span-9">
                <input
                  type="text"
                  value={settings.pocLineColor}
                  onChange={(e) => updateSetting('pocLineColor', e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                  style={{ fontSize: '7px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Origin & Value Area */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-gray-400 mb-1" style={{ fontSize: '9px' }}>Origin</label>
            <select
              value={settings.origin}
              onChange={(e) => updateSetting('origin', e.target.value)}
              className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5"
              style={{ fontSize: '9px' }}
            >
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1" style={{ fontSize: '9px' }}>Value area</label>
            <input
              type="number"
              min="0.5"
              max="0.9"
              step="0.01"
              value={settings.valueArea}
              onChange={(e) => updateSetting('valueArea', parseFloat(e.target.value))}
              className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5"
              style={{ fontSize: '9px' }}
            />
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
          <div className="col-span-3">
            <span className="font-medium text-purple-400" style={{ fontSize: '8px' }}>Opacity</span>
          </div>
          <div className="col-span-6">
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.opacity}
              onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
              className="w-full h-1"
            />
          </div>
          <div className="col-span-3">
            <span className="text-gray-400" style={{ fontSize: '7px' }}>{(settings.opacity * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Reset Button */}
        <div className="pt-2 border-t border-gray-600">
          <button
            onClick={() => onSettingsChange({
              enableFixedTicks: false,
              rowCount: 64,
              bullColor: "#00ff88",
              bearColor: "#ff4444",
              origin: "right",
              showPOC: false,
              pocLineColor: "#888888",
              valueArea: 0.63,
              deltaMode: false,
              showStatsBox: true,
              opacity: 0.7,
            })}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
            style={{ fontSize: '9px' }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
})

VPVRSettings.displayName = 'VPVRSettings' 