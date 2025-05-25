"use client"

import React, { useEffect, useRef, useMemo, useState } from 'react'
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
  isFlashing,
  showBuys = true,
  showSells = true,
  showDelta = true
}: { 
  entry: OrderbookEntry
  type: 'bid' | 'ask'
  maxTotal: number
  maxSize: number
  isFlashing?: boolean
  showBuys?: boolean
  showSells?: boolean
  showDelta?: boolean
}) => {
  const fillPercentage = maxTotal > 0 ? (entry.total / maxTotal) * 100 : 0
  
  // Calculate depth bar width based on size (volume at this price level)
  const depthPercentage = maxSize > 0 ? (entry.size / maxSize) * 100 : 0
  
  // Calculate mock buy/sell split and delta for display
  const buyRatio = type === 'bid' ? 0.7 : 0.3
  const sellRatio = 1 - buyRatio
  const buyVolume = entry.size * buyRatio
  const sellVolume = entry.size * sellRatio
  const delta = buyVolume - sellVolume
  
  return (
    <div 
      className={`relative flex items-center text-xs font-mono hover:bg-gray-800/20 transition-all duration-150 ${
        isFlashing ? 'bg-yellow-500/10' : ''
      }`}
      style={{ height: '16px', fontSize: '11px' }}
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
          <div className="w-12 text-right text-green-400">
            {type === 'bid' ? buyVolume.toFixed(3) : ''}
          </div>
        )}
        
        {/* Bids column */}
        <div className="w-16 text-right text-gray-300 px-1">
          {type === 'bid' ? entry.size.toFixed(3) : ''}
        </div>
        
        {/* Price column */}
        <div className={`w-20 text-center font-semibold ${
          type === 'bid' ? 'text-green-400' : 'text-red-400'
        }`}>
          {entry.price.toFixed(1)}
        </div>
        
        {/* Asks column */}
        <div className="w-16 text-left text-gray-300 px-1">
          {type === 'ask' ? entry.size.toFixed(3) : ''}
        </div>
        
        {/* Sells column */}
        {showSells && (
          <div className="w-12 text-left text-red-400">
            {type === 'ask' ? sellVolume.toFixed(3) : ''}
          </div>
        )}
        
        {/* Delta column */}
        {showDelta && (
          <div className={`w-12 text-right ${
            delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastUpdateRef = useRef<number>(0)

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

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-[#1a1a1a] border-b border-gray-600 p-2 flex-shrink-0">
          <div className="flex items-center space-x-4 text-xs">
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showBuys}
                onChange={(e) => setShowBuys(e.target.checked)}
                className="w-3 h-3"
              />
              <span>Buys</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showSells}
                onChange={(e) => setShowSells(e.target.checked)}
                className="w-3 h-3"
              />
              <span>Sells</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={showDelta}
                onChange={(e) => setShowDelta(e.target.checked)}
                className="w-3 h-3"
              />
              <span>Delta</span>
            </label>
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
              isFlashing={flashingPrices.has(ask.price)}
              showBuys={showBuys}
              showSells={showSells}
              showDelta={showDelta}
            />
          ))}
        </div>

        {/* Current Price Separator matching screenshot */}
        <div className="bg-[#2a2a2a] px-2 py-1 text-center text-sm font-bold font-mono flex-shrink-0 sticky top-0 z-10 border-y border-gray-600">
          <div className="flex items-center justify-center">
            <span className="text-blue-400">{currentPrice.toFixed(1)}</span>
          </div>
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
              isFlashing={flashingPrices.has(bid.price)}
              showBuys={showBuys}
              showSells={showSells}
              showDelta={showDelta}
            />
          ))}
        </div>
      </div>
    </div>
  )
} 