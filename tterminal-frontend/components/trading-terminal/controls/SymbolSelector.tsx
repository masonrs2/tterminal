/**
 * Symbol Selector Component
 * Allows users to search and select from available trading symbols
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface SymbolSelectorProps {
  selectedSymbol: string
  onSymbolChange: (symbol: string) => void
  className?: string
}

// Popular futures symbols available on Binance
const popularSymbols = [
  'BTCUSDT',
  'ETHUSDT', 
  'SOLUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'XRPUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'UNIUSDT',
  'LTCUSDT',
  'BCHUSDT',
  'FILUSDT',
  'ETCUSDT',
  'XLMUSDT',
  'VETUSDT',
  'TRXUSDT',
  'EOSUSDT',
  'ATOMUSDT',
  'TRUMPUSDT',
  'PEPEUSDT',
  'SHIBUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT'
]

export const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  selectedSymbol,
  onSymbolChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredSymbols, setFilteredSymbols] = useState(popularSymbols)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Filter symbols based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSymbols(popularSymbols)
    } else {
      const filtered = popularSymbols.filter(symbol =>
        symbol.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredSymbols(filtered)
    }
  }, [searchTerm])

  // Handle dropdown hover with timeout
  const handleDropdownEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }, [])

  const handleDropdownLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
      setSearchTerm('')
      timeoutRef.current = null
    }, 150)
  }, [])

  // Handle symbol selection
  const handleSymbolSelect = useCallback((symbol: string) => {
    onSymbolChange(symbol)
    setIsOpen(false)
    setSearchTerm('')
  }, [onSymbolChange])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      className={`relative ${className}`}
      ref={dropdownRef}
      onMouseEnter={handleDropdownEnter}
      onMouseLeave={handleDropdownLeave}
    >
      <button
        className={`flex items-center bg-[#0f0f0f] border border-gray-600 rounded px-3 py-1 cursor-pointer transition-colors font-mono text-xs ${
          isOpen 
            ? 'text-blue-300 bg-[#1a1a1a] border-blue-500' 
            : 'text-blue-400 hover:bg-[#1a1a1a] hover:border-blue-400'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedSymbol} <ChevronDown className="w-3 h-3 ml-1" />
      </button>
      
      {isOpen && (
        <div 
          className="absolute top-8 left-0 bg-[#0f0f0f] border border-gray-600 rounded shadow-lg z-50 min-w-48 max-h-64 overflow-hidden"
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-600">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-600 rounded pl-7 pr-7 py-1 text-xs font-mono focus:outline-none focus:border-blue-500 text-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          
          {/* Symbol List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredSymbols.length > 0 ? (
              filteredSymbols.map((symbol) => (
                <div
                  key={symbol}
                  className={`px-3 py-2 cursor-pointer transition-colors font-mono flex items-center justify-between ${
                    symbol === selectedSymbol
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-[#1a2a3a] hover:text-blue-300'
                  }`}
                  onClick={() => handleSymbolSelect(symbol)}
                  style={{ fontSize: '11px' }}
                >
                  <span>{symbol}</span>
                  {symbol === selectedSymbol && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-400 text-xs">
                No symbols found
              </div>
            )}
          </div>
          
          {/* Custom Symbol Input */}
          {searchTerm && !popularSymbols.includes(searchTerm.toUpperCase()) && (
            <div className="border-t border-gray-600 p-2">
              <div
                className="px-2 py-1 cursor-pointer hover:bg-[#1a2a3a] hover:text-blue-300 rounded text-xs font-mono transition-colors"
                onClick={() => handleSymbolSelect(searchTerm.toUpperCase())}
              >
                Try: {searchTerm.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 