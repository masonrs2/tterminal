"use client"

import React, { useEffect, useRef, useMemo, useState } from 'react'
import { X, GripVertical } from 'lucide-react'

interface OrderbookEntry {
  price: number
  size: number
  total: number
}

interface OrderbookProps {
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  currentPrice: number
  width: number
  onResize: (width: number) => void
  onClose: () => void
}

// Virtualized row component for performance
const OrderbookRow = React.memo(({ 
  entry, 
  type, 
  maxTotal 
}: { 
  entry: OrderbookEntry
  type: 'bid' | 'ask'
  maxTotal: number 
}) => {
  const fillPercentage = (entry.total / maxTotal) * 100
  
  return (
    <div 
      className="relative flex items-center justify-between px-2 py-0.5 text-xs hover:bg-gray-800/50 transition-colors"
      style={{ height: '18px' }} // Fixed height for virtualization
    >
      {/* Background fill */}
      <div 
        className={`absolute inset-0 ${type === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10'}`}
        style={{ width: `${fillPercentage}%`, right: 0 }}
      />
      
      {/* Content */}
      <div className="relative z-10 w-12 text-right">0.006</div>
      <div className={`relative z-10 w-16 text-right ${type === 'bid' ? 'text-green-400' : 'text-red-400'}`}>
        {entry.price.toFixed(1)}
      </div>
      <div className="relative z-10 w-12 text-right">{entry.size.toFixed(3)}</div>
      <div className={`relative z-10 w-16 text-right ${type === 'bid' ? 'text-green-400' : 'text-red-400'}`}>
        0.011
      </div>
      <div className="relative z-10 w-12 text-right">-0.097</div>
    </div>
  )
})

export default function HighPerformanceOrderbook({ 
  bids, 
  asks, 
  currentPrice, 
  width, 
  onResize, 
  onClose 
}: OrderbookProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Calculate max total for fill percentage
  const maxTotal = useMemo(() => 
    Math.max(
      ...bids.map(b => b.total),
      ...asks.map(a => a.total)
    )
  , [bids, asks])

  // Memoize reversed asks for performance
  const reversedAsks = useMemo(() => [...asks].reverse(), [asks])

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

  return (
    <div 
      className="bg-black border-l border-gray-700 relative flex flex-col h-full"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-gray-600 cursor-ew-resize hover:bg-gray-500 z-10"
        onMouseDown={handleResizeStart}
      >
        <GripVertical className="w-3 h-3 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Header */}
      <div className="h-8 bg-[#2a2a2a] flex items-center justify-between px-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-4 text-xs">
          <span>buys</span>
          <span>bids</span>
          <span>price</span>
          <span>asks</span>
          <span>sells</span>
          <span>delta</span>
        </div>
        <button onClick={onClose}>
          <X className="w-3 h-3 cursor-pointer hover:text-red-400" />
        </button>
      </div>

      {/* Orderbook content with virtual scrolling */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-hidden flex flex-col"
      >
        {/* Asks (top half) */}
        <div className="flex-1 flex flex-col-reverse overflow-hidden">
          {reversedAsks.slice(0, 20).map((ask, index) => (
            <OrderbookRow
              key={`ask-${ask.price}`}
              entry={ask}
              type="ask"
              maxTotal={maxTotal}
            />
          ))}
        </div>

        {/* Current Price */}
        <div className="bg-blue-600 px-2 py-1 text-center text-sm font-bold flex-shrink-0">
          {currentPrice.toFixed(1)}
        </div>

        {/* Bids (bottom half) */}
        <div className="flex-1 overflow-hidden">
          {bids.slice(0, 20).map((bid, index) => (
            <OrderbookRow
              key={`bid-${bid.price}`}
              entry={bid}
              type="bid"
              maxTotal={maxTotal}
            />
          ))}
        </div>
      </div>
    </div>
  )
} 