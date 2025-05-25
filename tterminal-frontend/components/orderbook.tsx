"use client"

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { X, GripVertical, RotateCcw, Settings } from 'lucide-react'
import { useWebSocketOrderbook } from '../hooks/trading/useWebSocketOrderbook'

interface OrderbookEntry {
  price: number
  size: number
  total: number
}

interface OrderbookProps {
  symbol: string
  currentPrice: number
  width: number
  onResize: (width: number) => void
  onClose: () => void
}

// Row component matching the screenshot layout
const OrderbookRow = React.memo(({ 
  entry, 
  type, 
  maxTotal,
  maxSize,
  baselineSize,
  isFlashing,
  showBuys = true,
  showSells = true,
  showDelta = true,
  highlightAnomalies = false,
  smallAnomalyThreshold = 2.0,
  mediumAnomalyThreshold = 5.0,
  largeAnomalyThreshold = 10.0,
  smallAnomalyColor = '#ffeb3b',
  mediumAnomalyColor = '#ff9800',
  largeAnomalyColor = '#f44336'
}: { 
  entry: OrderbookEntry
  type: 'bid' | 'ask'
  maxTotal: number 
  maxSize: number
  baselineSize: number
  isFlashing?: boolean
  showBuys?: boolean
  showSells?: boolean
  showDelta?: boolean
  highlightAnomalies?: boolean
  smallAnomalyThreshold?: number
  mediumAnomalyThreshold?: number
  largeAnomalyThreshold?: number
  smallAnomalyColor?: string
  mediumAnomalyColor?: string
  largeAnomalyColor?: string
}) => {
  const fillPercentage = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0
  
  // Calculate depth bar width based on size (volume at this price level)
  const depthPercentage = maxSize > 0 ? (entry.size / maxSize) * 100 : 0
  
  // Calculate anomaly intensity (0 = normal, 1+ = anomaly)
  const anomalyIntensity = highlightAnomalies && baselineSize > 0 
    ? Math.max(0, (entry.size / baselineSize) / mediumAnomalyThreshold)
    : 0
  
  const isAnomaly = anomalyIntensity >= 1
  
  // Calculate mock buy/sell split and delta for display
  const buyRatio = type === 'bid' ? 0.7 : 0.3
  const sellRatio = 1 - buyRatio
  const buyVolume = entry.size * buyRatio
  const sellVolume = entry.size * sellRatio
  const delta = buyVolume - sellVolume
  
  // Get anomaly text color for specific columns
  const getAnomalyTextColor = (originalColor: string, shouldHighlight: boolean) => {
    if (!highlightAnomalies || !shouldHighlight || baselineSize <= 0) {
      return originalColor
    }
    
    const sizeRatio = entry.size / baselineSize
    
    // Determine anomaly tier based on statistical thresholds
    if (sizeRatio >= largeAnomalyThreshold) {
      return largeAnomalyColor // Red for large anomalies
    } else if (sizeRatio >= mediumAnomalyThreshold) {
      return mediumAnomalyColor // Orange for medium anomalies
    } else if (sizeRatio >= smallAnomalyThreshold) {
      return smallAnomalyColor // Yellow for small anomalies
    }
    
    return originalColor // No highlighting if below small threshold
  }
  
  return (
    <div 
      className={`relative flex items-center text-xs font-mono hover:bg-gray-800/20 transition-all duration-150 ${
        isFlashing ? 'bg-yellow-500/10' : ''
      }`}
      style={{ 
        height: '16px', 
        fontSize: '11px'
      }}
    >
      {/* Depth visualization bar - shows volume at this price level */}
      <div 
        className={`absolute inset-0 transition-all duration-300 border-r-2 ${
          type === 'bid' 
            ? 'bg-gradient-to-r from-green-500/30 to-green-500/10 border-green-400/40' 
            : 'bg-gradient-to-r from-red-500/30 to-red-500/10 border-red-400/40'
        }`}
        style={{ 
          width: `${Math.min(depthPercentage, 90)}%`, // Cap at 90% to leave space for text
          right: type === 'ask' ? 0 : 'auto',
          left: type === 'bid' ? 0 : 'auto'
        }}
      />
      
      {/* Additional depth highlight for larger volumes */}
      {depthPercentage > 50 && (
        <div 
          className={`absolute inset-0 transition-all duration-300 ${
            type === 'bid' 
              ? 'bg-gradient-to-r from-green-400/25 to-transparent' 
              : 'bg-gradient-to-r from-red-400/25 to-transparent'
          }`}
          style={{ 
            width: `${Math.min(depthPercentage * 0.6, 60)}%`,
            right: type === 'ask' ? 0 : 'auto',
            left: type === 'bid' ? 0 : 'auto'
          }}
        />
      )}
      
      {/* Content matching screenshot layout */}
      <div className="relative z-10 flex w-full px-1">
        {/* Buys column */}
        {showBuys && (
          <div 
            className="w-12 text-right px-1" 
            style={{ 
              color: getAnomalyTextColor('#d1d5db', false)
            }}
          >
            {type === 'bid' ? buyVolume.toFixed(3) : ''}
          </div>
        )}
        
        {/* Bids column */}
        <div 
          className="w-16 text-right px-1" 
          style={{ 
            color: getAnomalyTextColor('#d1d5db', type === 'bid')
          }}
        >
          {type === 'bid' ? entry.size.toFixed(3) : ''}
        </div>
        
        {/* Price column */}
        <div 
          className={`w-20 text-center px-1`} 
          style={{ 
            color: '#d1d5db'
          }}
        >
        {entry.price.toFixed(1)}
      </div>
        
        {/* Asks column */}
        <div 
          className="w-16 text-left px-1" 
          style={{ 
            color: getAnomalyTextColor('#d1d5db', type === 'ask')
          }}
        >
          {type === 'ask' ? entry.size.toFixed(3) : ''}
        </div>
        
        {/* Sells column */}
        {showSells && (
          <div 
            className="w-12 text-left px-1" 
            style={{ 
              color: getAnomalyTextColor('#d1d5db', false)
            }}
          >
            {type === 'ask' ? sellVolume.toFixed(3) : ''}
          </div>
        )}
        
        {/* Delta column */}
        {showDelta && (
          <div 
            className={`w-12 text-right px-1`} 
            style={{ 
              color: delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#9ca3af'
            }}
          >
            {delta !== 0 ? (delta > 0 ? '+' : '') + delta.toFixed(3) : ''}
          </div>
        )}
      </div>
    </div>
  )
})

export default function HighPerformanceOrderbook({ 
  symbol,
  currentPrice, 
  width, 
  onResize, 
  onClose 
}: OrderbookProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [flashingPrices, setFlashingPrices] = useState<Set<number>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [precision, setPrecision] = useState(0.1)
  const [showBuys, setShowBuys] = useState(true)
  const [showSells, setShowSells] = useState(true)
  const [showDelta, setShowDelta] = useState(true)
  const [highlightAnomalies, setHighlightAnomalies] = useState(false)
  const [anomalyThreshold, setAnomalyThreshold] = useState(5.0) // 5x average size
  const [anomalyColor, setAnomalyColor] = useState('#ff6b35')
  const [anomalyMethod, setAnomalyMethod] = useState<'average' | 'median' | 'percentile'>('average')
  const [settingsPosition, setSettingsPosition] = useState({ x: 0, y: 0 })
  const [isDraggingSettings, setIsDraggingSettings] = useState(false)
  const [settingsDragStart, setSettingsDragStart] = useState({ x: 0, y: 0 })
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastUpdateRef = useRef<number>(0)

  // Tiered anomaly detection settings
  const [smallAnomalyThreshold, setSmallAnomalyThreshold] = useState(2.0)
  const [mediumAnomalyThreshold, setMediumAnomalyThreshold] = useState(5.0)
  const [largeAnomalyThreshold, setLargeAnomalyThreshold] = useState(10.0)
  const [smallAnomalyColor, setSmallAnomalyColor] = useState('#ffeb3b') // Yellow
  const [mediumAnomalyColor, setMediumAnomalyColor] = useState('#ff9800') // Orange
  const [largeAnomalyColor, setLargeAnomalyColor] = useState('#f44336') // Red

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('orderbook-settings')
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings)
          setPrecision(settings.precision ?? 0.1)
          setShowBuys(settings.showBuys ?? true)
          setShowSells(settings.showSells ?? true)
          setShowDelta(settings.showDelta ?? true)
          setHighlightAnomalies(settings.highlightAnomalies ?? false)
          setAnomalyThreshold(settings.anomalyThreshold ?? 5.0)
          setAnomalyColor(settings.anomalyColor ?? '#ff6b35')
          setAnomalyMethod(settings.anomalyMethod ?? 'average')
          setSmallAnomalyThreshold(settings.smallAnomalyThreshold ?? 2.0)
          setMediumAnomalyThreshold(settings.mediumAnomalyThreshold ?? 5.0)
          setLargeAnomalyThreshold(settings.largeAnomalyThreshold ?? 10.0)
          setSmallAnomalyColor(settings.smallAnomalyColor ?? '#ffeb3b')
          setMediumAnomalyColor(settings.mediumAnomalyColor ?? '#ff9800')
          setLargeAnomalyColor(settings.largeAnomalyColor ?? '#f44336')
          if (settings.settingsPosition) {
            setSettingsPosition(settings.settingsPosition)
          }
        } catch (error) {
          console.warn('Failed to load orderbook settings from localStorage:', error)
        }
      }
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const settings = {
        precision,
        showBuys,
        showSells,
        showDelta,
        highlightAnomalies,
        anomalyThreshold,
        anomalyColor,
        anomalyMethod,
        smallAnomalyThreshold,
        mediumAnomalyThreshold,
        largeAnomalyThreshold,
        smallAnomalyColor,
        mediumAnomalyColor,
        largeAnomalyColor,
        settingsPosition
      }
      localStorage.setItem('orderbook-settings', JSON.stringify(settings))
    }
  }, [
    precision,
    showBuys,
    showSells,
    showDelta,
    highlightAnomalies,
    anomalyThreshold,
    anomalyColor,
    anomalyMethod,
    smallAnomalyThreshold,
    mediumAnomalyThreshold,
    largeAnomalyThreshold,
    smallAnomalyColor,
    mediumAnomalyColor,
    largeAnomalyColor,
    settingsPosition
  ])

  // Use WebSocket orderbook hook for real-time data
  const {
    bids,
    asks,
    spread,
    midPrice,
    lastUpdate,
    isConnected,
    getBestBid,
    getBestAsk,
    getTotalBidVolume,
    getTotalAskVolume,
    updateCount,
    isStale
  } = useWebSocketOrderbook({
    symbol,
    enabled: true,
    maxLevels: 50
  })

  // Filter and sort orderbook data around current price
  const { filteredAsks, filteredBids } = useMemo(() => {
    // Filter asks to only show prices above current price
    const asksAbovePrice = asks.filter(ask => ask.price > currentPrice)
      .sort((a, b) => a.price - b.price) // Sort ascending (lowest first)
      .slice(0, 25) // Limit to 25 levels

    // Filter bids to only show prices below current price  
    const bidsBelowPrice = bids.filter(bid => bid.price < currentPrice)
      .sort((a, b) => b.price - a.price) // Sort descending (highest first)
      .slice(0, 25) // Limit to 25 levels

    return {
      filteredAsks: asksAbovePrice,
      filteredBids: bidsBelowPrice
    }
  }, [asks, bids, currentPrice])

  // Memoize reversed asks for display (highest price at top)
  const reversedAsks = useMemo(() => [...filteredAsks].reverse(), [filteredAsks])

  // Flash effect for price changes
  useEffect(() => {
    if (lastUpdate > lastUpdateRef.current) {
      const newFlashingPrices = new Set<number>()
      
      const bestBid = getBestBid()
      const bestAsk = getBestAsk()
      
      if (bestBid) newFlashingPrices.add(bestBid.price)
      if (bestAsk) newFlashingPrices.add(bestAsk.price)
      
      setFlashingPrices(newFlashingPrices)
      lastUpdateRef.current = lastUpdate
      
      const timer = setTimeout(() => {
        setFlashingPrices(new Set())
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [lastUpdate, getBestBid, getBestAsk])

  // Handle resize
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart(e.clientX)
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = dragStart - e.clientX
      const newWidth = Math.max(200, Math.min(600, width + deltaX))
      onResize(newWidth)
      setDragStart(e.clientX)
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
  }, [isDragging, dragStart, width, onResize])

  // Calculate max total for fill percentage using filtered data
  const maxTotal = useMemo(() => {
    const allFilteredEntries = [...(filteredBids || []), ...(filteredAsks || [])]
    return Math.max(
      ...allFilteredEntries.map(entry => entry.total),
      1 // Prevent division by zero
    )
  }, [filteredBids, filteredAsks])

  // Calculate max size for depth bar visualization
  const maxSize = useMemo(() => {
    const allFilteredEntries = [...(filteredBids || []), ...(filteredAsks || [])]
    return Math.max(
      ...allFilteredEntries.map(entry => entry.size),
      1 // Prevent division by zero
    )
  }, [filteredBids, filteredAsks])

  // Calculate baseline size for anomaly detection using different methods
  const averageSize = useMemo(() => {
    const allFilteredEntries = [...(filteredBids || []), ...(filteredAsks || [])]
    if (allFilteredEntries.length === 0) return 1
    
    const sizes = allFilteredEntries.map(entry => entry.size).sort((a, b) => a - b)
    
    switch (anomalyMethod) {
      case 'median':
        // Median is less affected by outliers
        const mid = Math.floor(sizes.length / 2)
        return sizes.length % 2 === 0 
          ? (sizes[mid - 1] + sizes[mid]) / 2 
          : sizes[mid]
      
      case 'percentile':
        // 75th percentile - good for detecting truly large orders
        const p75Index = Math.floor(sizes.length * 0.75)
        return sizes[p75Index] || 1
      
      case 'average':
      default:
        // Traditional average
        const totalSize = allFilteredEntries.reduce((sum, entry) => sum + entry.size, 0)
        return totalSize / allFilteredEntries.length
    }
  }, [filteredBids, filteredAsks, anomalyMethod])

  // Handle settings panel dragging
  const handleSettingsDragStart = useCallback((e: React.MouseEvent) => {
    setIsDraggingSettings(true)
    setSettingsDragStart({
      x: e.clientX - settingsPosition.x,
      y: e.clientY - settingsPosition.y
    })
    e.preventDefault()
  }, [settingsPosition])

  // Settings drag effect
  useEffect(() => {
    if (!isDraggingSettings) return

    const handleMouseMove = (e: MouseEvent) => {
      setSettingsPosition({
        x: e.clientX - settingsDragStart.x,
        y: e.clientY - settingsDragStart.y
      })
    }

    const handleMouseUp = () => {
      setIsDraggingSettings(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSettings, settingsDragStart])

  // Initialize settings position when first opened
  useEffect(() => {
    if (showSettings && settingsPosition.x === 0 && settingsPosition.y === 0) {
      // Position it to the right of the orderbook initially
      setSettingsPosition({ x: width + 10, y: 50 })
    }
  }, [showSettings, settingsPosition, width])

  return (
    <div 
      className="bg-black border-l border-gray-700 relative flex flex-col h-full"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-[#2a2a2a] cursor-ew-resize hover:bg-[#353535] z-10"
        onMouseDown={handleResizeStart}
      >
        <GripVertical className="w-3 h-3 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Header matching screenshot */}
      <div className="h-8 bg-[#181818] flex items-center justify-between px-2 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono">binancef btcusdt</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setPrecision(precision === 0.1 ? 1 : 0.1)}
            className="text-xs font-mono hover:text-blue-400 transition-colors"
            title="Toggle precision"
          >
            {precision}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="hover:text-blue-400 transition-colors"
          >
            <Settings className="w-3 h-3" />
          </button>
          <button className="hover:text-blue-400 transition-colors">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="hover:text-red-400 transition-colors">
            <X className="w-3 h-3" />
        </button>
        </div>
      </div>

      {/* Column headers matching screenshot */}
      <div className="h-6 bg-[#1a1a1a] flex items-center px-1 border-b border-gray-600 flex-shrink-0">
        <div className="flex w-full text-xs font-mono text-gray-400">
          {showBuys && <div className="w-12 text-right">buys</div>}
          <div className="w-16 text-right px-1">bids</div>
          <div className="w-20 text-center">price</div>
          <div className="w-16 text-left px-1">asks</div>
          {showSells && <div className="w-12 text-left">sells</div>}
          {showDelta && <div className="w-12 text-right">delta</div>}
        </div>
      </div>

      {/* Draggable Settings panel */}
      {showSettings && (
        <div 
          className="fixed z-50 bg-[#1a1a1a] border border-gray-600 rounded-lg shadow-2xl min-w-80 max-w-96"
          style={{
            left: `${settingsPosition.x}px`,
            top: `${settingsPosition.y}px`,
            cursor: isDraggingSettings ? 'grabbing' : 'default'
          }}
        >
          {/* Draggable header */}
          <div 
            className="flex items-center justify-between p-2 border-b border-gray-600 cursor-grab active:cursor-grabbing bg-[#252525] rounded-t-lg"
            onMouseDown={handleSettingsDragStart}
          >
            <div className="flex items-center space-x-2">
              <GripVertical className="w-3 h-3 text-gray-400" />
              <h3 className="text-xs font-semibold text-white">Orderbook Settings</h3>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Settings content */}
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {/* Display Options */}
            <div>
              <h4 className="text-xs font-medium text-gray-300 mb-1" style={{ fontSize: '10px' }}>Display Options</h4>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
                  <input
                    type="checkbox"
                    checked={showBuys}
                    onChange={(e) => setShowBuys(e.target.checked)}
                    className="w-2.5 h-2.5 rounded"
                  />
                  <span>Show Buys</span>
                </label>
                <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
                  <input
                    type="checkbox"
                    checked={showSells}
                    onChange={(e) => setShowSells(e.target.checked)}
                    className="w-2.5 h-2.5 rounded"
                  />
                  <span>Show Sells</span>
                </label>
                <label className="flex items-center space-x-1" style={{ fontSize: '9px' }}>
                  <input
                    type="checkbox"
                    checked={showDelta}
                    onChange={(e) => setShowDelta(e.target.checked)}
                    className="w-2.5 h-2.5 rounded"
                  />
                  <span>Show Delta</span>
                </label>
              </div>
            </div>

            {/* Precision Setting */}
            <div>
              <h4 className="text-xs font-medium text-gray-300 mb-1" style={{ fontSize: '10px' }}>Price Precision</h4>
              <select
                value={precision}
                onChange={(e) => setPrecision(parseFloat(e.target.value))}
                className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5"
                style={{ fontSize: '9px' }}
              >
                <option value={0.1}>0.1</option>
                <option value={1}>1.0</option>
                <option value={10}>10.0</option>
              </select>
            </div>

            {/* Anomaly Detection */}
            <div>
              <h4 className="text-xs font-medium text-gray-300 mb-1" style={{ fontSize: '10px' }}>Anomaly Detection</h4>
              <label className="flex items-center space-x-1 mb-2" style={{ fontSize: '9px' }}>
                <input
                  type="checkbox"
                  checked={highlightAnomalies}
                  onChange={(e) => setHighlightAnomalies(e.target.checked)}
                  className="w-2.5 h-2.5 rounded"
                />
                <span>Highlight Large Orders</span>
              </label>
              
              {highlightAnomalies && (
                <div className="space-y-2 pl-3 border-l border-gray-600">
                  <div>
                    <label className="block text-gray-400 mb-1" style={{ fontSize: '9px' }}>Calculation Method</label>
                    <select
                      value={anomalyMethod}
                      onChange={(e) => setAnomalyMethod(e.target.value as 'average' | 'median' | 'percentile')}
                      className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5"
                      style={{ fontSize: '9px' }}
                    >
                      <option value="average">Average (Mean)</option>
                      <option value="median">Median (Less outlier-sensitive)</option>
                      <option value="percentile">75th Percentile (Conservative)</option>
                    </select>
                    <div className="text-gray-500 mt-1" style={{ fontSize: '8px' }}>
                      {anomalyMethod === 'average' && 'Sum of all sizes ÷ count'}
                      {anomalyMethod === 'median' && 'Middle value when sorted'}
                      {anomalyMethod === 'percentile' && '75% of orders are smaller'}
                    </div>
                  </div>
                  
                  {/* Compact Anomaly Tiers */}
                  <div className="space-y-1">
                    {/* Small Anomalies */}
                    <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
                      <div className="col-span-2">
                        <span className="font-medium text-yellow-400" style={{ fontSize: '8px' }}>Small</span>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="range"
                          min="1.5"
                          max="5"
                          step="0.1"
                          value={smallAnomalyThreshold}
                          onChange={(e) => setSmallAnomalyThreshold(parseFloat(e.target.value))}
                          className="w-full h-1"
                        />
                      </div>
                      <div className="col-span-1">
                        <span className="text-gray-400" style={{ fontSize: '7px' }}>{smallAnomalyThreshold}x</span>
                      </div>
                      <div className="col-span-1">
                        <input
                          type="color"
                          value={smallAnomalyColor}
                          onChange={(e) => setSmallAnomalyColor(e.target.value)}
                          className="w-3 h-2.5 rounded border-0"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={smallAnomalyColor}
                          onChange={(e) => setSmallAnomalyColor(e.target.value)}
                          className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                          style={{ fontSize: '7px' }}
                        />
                      </div>
                    </div>

                    {/* Medium Anomalies */}
                    <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
                      <div className="col-span-2">
                        <span className="font-medium text-orange-400" style={{ fontSize: '8px' }}>Medium</span>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="0.5"
                          value={mediumAnomalyThreshold}
                          onChange={(e) => setMediumAnomalyThreshold(parseFloat(e.target.value))}
                          className="w-full h-1"
                        />
                      </div>
                      <div className="col-span-1">
                        <span className="text-gray-400" style={{ fontSize: '7px' }}>{mediumAnomalyThreshold}x</span>
                      </div>
                      <div className="col-span-1">
                        <input
                          type="color"
                          value={mediumAnomalyColor}
                          onChange={(e) => setMediumAnomalyColor(e.target.value)}
                          className="w-3 h-2.5 rounded border-0"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={mediumAnomalyColor}
                          onChange={(e) => setMediumAnomalyColor(e.target.value)}
                          className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                          style={{ fontSize: '7px' }}
                        />
                      </div>
                    </div>

                    {/* Large Anomalies */}
                    <div className="grid grid-cols-12 gap-1 items-center p-1 bg-[#0a0a0a] rounded border border-gray-700">
                      <div className="col-span-2">
                        <span className="font-medium text-red-400" style={{ fontSize: '8px' }}>Large</span>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="range"
                          min="5"
                          max="20"
                          step="1"
                          value={largeAnomalyThreshold}
                          onChange={(e) => setLargeAnomalyThreshold(parseFloat(e.target.value))}
                          className="w-full h-1"
                        />
                      </div>
                      <div className="col-span-1">
                        <span className="text-gray-400" style={{ fontSize: '7px' }}>{largeAnomalyThreshold}x</span>
                      </div>
                      <div className="col-span-1">
                        <input
                          type="color"
                          value={largeAnomalyColor}
                          onChange={(e) => setLargeAnomalyColor(e.target.value)}
                          className="w-3 h-2.5 rounded border-0"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={largeAnomalyColor}
                          onChange={(e) => setLargeAnomalyColor(e.target.value)}
                          className="w-full bg-[#0f0f0f] border border-gray-600 rounded px-1 py-0.5 font-mono"
                          style={{ fontSize: '7px' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-gray-500 mt-1 px-1 py-0.5 bg-[#0a0a0a] rounded border border-gray-700" style={{ fontSize: '8px' }}>
                    <strong>Basis:</strong> {anomalyMethod} × threshold. Highlights bids/asks columns only.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orderbook content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto flex flex-col min-h-0"
      >
        {/* Asks section (sells) - top half */}
        <div className="flex-shrink-0">
          {reversedAsks.slice(0, 25).map((ask, index) => (
            <OrderbookRow
              key={`ask-${ask.price}`}
              entry={ask}
              type="ask"
              maxTotal={maxTotal}
              maxSize={maxSize}
              baselineSize={averageSize}
              isFlashing={flashingPrices.has(ask.price)}
              showBuys={showBuys}
              showSells={showSells}
              showDelta={showDelta}
              highlightAnomalies={highlightAnomalies}
              smallAnomalyThreshold={smallAnomalyThreshold}
              mediumAnomalyThreshold={mediumAnomalyThreshold}
              largeAnomalyThreshold={largeAnomalyThreshold}
              smallAnomalyColor={smallAnomalyColor}
              mediumAnomalyColor={mediumAnomalyColor}
              largeAnomalyColor={largeAnomalyColor}
            />
          ))}
        </div>

        {/* Current Price Separator - Compact design */}
        <div className="relative bg-[#1a1a1a] border-y border-gray-600/30 flex-shrink-0 sticky top-0 z-10">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/10 via-gray-700/5 to-gray-800/10"></div>
          
          {/* Compact price display */}
          <div className="relative z-10 px-2 py-0.5 flex items-center justify-center">
            <span className="text-white font-mono text-xs tracking-wide">
          {currentPrice.toFixed(1)}
            </span>
          </div>
          
          {/* Minimal accent line */}
          <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-blue-400/20"></div>
        </div>

        {/* Bids section (buys) - bottom half */}
        <div className="flex-shrink-0">
          {filteredBids.slice(0, 25).map((bid, index) => (
            <OrderbookRow
              key={`bid-${bid.price}`}
              entry={bid}
              type="bid"
              maxTotal={maxTotal}
              maxSize={maxSize}
              baselineSize={averageSize}
              isFlashing={flashingPrices.has(bid.price)}
              showBuys={showBuys}
              showSells={showSells}
              showDelta={showDelta}
              highlightAnomalies={highlightAnomalies}
              smallAnomalyThreshold={smallAnomalyThreshold}
              mediumAnomalyThreshold={mediumAnomalyThreshold}
              largeAnomalyThreshold={largeAnomalyThreshold}
              smallAnomalyColor={smallAnomalyColor}
              mediumAnomalyColor={mediumAnomalyColor}
              largeAnomalyColor={largeAnomalyColor}
            />
          ))}
        </div>
      </div>
    </div>
  )
} 