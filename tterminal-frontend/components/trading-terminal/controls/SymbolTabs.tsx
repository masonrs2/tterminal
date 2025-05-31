/**
 * Symbol Tabs Component
 * Manages trading pair tabs and chart settings access
 */

import React, { useState, useRef } from 'react'
import { X, TrendingUp, Plus, ChevronDown, Search, Filter, Star, Building, Coins, Zap, Globe, BarChart3, Factory, Landmark, Activity, Layers } from 'lucide-react'

interface SymbolTabsProps {
  selectedSymbol: string
  onSymbolChange: (symbol: string) => void
  showChartSettings: boolean
  onToggleChartSettings: () => void
  className?: string
}

// Extended trading pairs with categories and exchanges
const tradingPairs = [
  // Crypto - Major
  { symbol: 'BTCUSDT', exchange: 'binance', category: 'major', type: 'crypto', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', exchange: 'binance', category: 'major', type: 'crypto', name: 'Ethereum' },
  { symbol: 'SOLUSDT', exchange: 'binance', category: 'major', type: 'crypto', name: 'Solana' },
  { symbol: 'ADAUSDT', exchange: 'binance', category: 'major', type: 'crypto', name: 'Cardano' },
  
  // Crypto - DeFi
  { symbol: 'UNIUSDT', exchange: 'binance', category: 'defi', type: 'crypto', name: 'Uniswap' },
  { symbol: 'AAVEUSDT', exchange: 'binance', category: 'defi', type: 'crypto', name: 'Aave' },
  { symbol: 'COMPUSDT', exchange: 'binance', category: 'defi', type: 'crypto', name: 'Compound' },
  { symbol: 'SUSHIUSDT', exchange: 'binance', category: 'defi', type: 'crypto', name: 'SushiSwap' },
  
  // Crypto - Meme
  { symbol: 'DOGEUSDT', exchange: 'binance', category: 'meme', type: 'crypto', name: 'Dogecoin' },
  { symbol: 'SHIBUSDT', exchange: 'binance', category: 'meme', type: 'crypto', name: 'Shiba Inu' },
  { symbol: 'PEPEUSDT', exchange: 'binance', category: 'meme', type: 'crypto', name: 'Pepe' },
  { symbol: 'TRUMPUSDT', exchange: 'binance', category: 'meme', type: 'crypto', name: 'Trump' },
  
  // Crypto - AI
  { symbol: 'FETUSDT', exchange: 'binance', category: 'ai', type: 'crypto', name: 'Fetch.ai' },
  { symbol: 'OCEANUSDT', exchange: 'binance', category: 'ai', type: 'crypto', name: 'Ocean Protocol' },
  { symbol: 'AGIXUSDT', exchange: 'binance', category: 'ai', type: 'crypto', name: 'SingularityNET' },
  
  // Crypto - Layer 1
  { symbol: 'AVAXUSDT', exchange: 'binance', category: 'layer1', type: 'crypto', name: 'Avalanche' },
  { symbol: 'DOTUSDT', exchange: 'binance', category: 'layer1', type: 'crypto', name: 'Polkadot' },
  { symbol: 'ATOMUSDT', exchange: 'binance', category: 'layer1', type: 'crypto', name: 'Cosmos' },
  
  // Other Exchanges (WIP)
  { symbol: 'BTCUSDT', exchange: 'hyperliquid', category: 'major', type: 'crypto', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', exchange: 'hyperliquid', category: 'major', type: 'crypto', name: 'Ethereum' },
  { symbol: 'BTCUSDT', exchange: 'bybit', category: 'major', type: 'crypto', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', exchange: 'bybit', category: 'major', type: 'crypto', name: 'Ethereum' },
  
  // Traditional Futures (WIP)
  { symbol: 'ES', exchange: 'cme', category: 'indices', type: 'futures', name: 'S&P 500 E-mini' },
  { symbol: 'NQ', exchange: 'cme', category: 'indices', type: 'futures', name: 'Nasdaq E-mini' },
  { symbol: 'YM', exchange: 'cme', category: 'indices', type: 'futures', name: 'Dow Jones E-mini' },
  { symbol: 'RTY', exchange: 'cme', category: 'indices', type: 'futures', name: 'Russell 2000 E-mini' },
  { symbol: 'CL', exchange: 'nymex', category: 'commodities', type: 'futures', name: 'Crude Oil' },
  { symbol: 'GC', exchange: 'comex', category: 'commodities', type: 'futures', name: 'Gold' },
]

const categories = [
  { id: 'all', name: 'All', icon: Filter },
  { id: 'major', name: 'Major', icon: Star },
  { id: 'defi', name: 'DeFi', icon: Building },
  { id: 'meme', name: 'Meme', icon: TrendingUp },
  { id: 'ai', name: 'AI', icon: Zap },
  { id: 'layer1', name: 'Layer 1', icon: Layers },
  { id: 'indices', name: 'Indices', icon: BarChart3 },
  { id: 'commodities', name: 'Commodities', icon: Factory },
]

const exchanges = [
  { id: 'all', name: 'All Exchanges', icon: Globe, status: 'active' },
  { id: 'binance', name: 'Binance', icon: Coins, status: 'active' },
  { id: 'hyperliquid', name: 'Hyperliquid', icon: Activity, status: 'wip' },
  { id: 'bybit', name: 'Bybit', icon: TrendingUp, status: 'wip' },
  { id: 'kraken', name: 'Kraken', icon: Activity, status: 'wip' },
  { id: 'cme', name: 'CME', icon: Landmark, status: 'wip' },
  { id: 'nymex', name: 'NYMEX', icon: Zap, status: 'wip' },
  { id: 'comex', name: 'COMEX', icon: Factory, status: 'wip' },
]

const assetTypes = [
  { id: 'all', name: 'All Assets', icon: Filter },
  { id: 'crypto', name: 'Crypto', icon: Coins },
  { id: 'futures', name: 'Futures', icon: BarChart3, status: 'wip' },
]

export const SymbolTabs: React.FC<SymbolTabsProps> = ({ 
  selectedSymbol,
  onSymbolChange,
  showChartSettings, 
  onToggleChartSettings,
  className = "" 
}) => {
  const [openTabs, setOpenTabs] = useState([selectedSymbol])
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedExchange, setSelectedExchange] = useState('all')
  const [selectedAssetType, setSelectedAssetType] = useState('crypto')
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const activeChart = tradingPairs.find(pair => pair.symbol === selectedSymbol) || tradingPairs[0]

  const handlePairClick = (symbol: string) => {
    if (symbol !== selectedSymbol) {
      onSymbolChange(symbol)
      if (!openTabs.includes(symbol)) {
        setOpenTabs(prev => [...prev, symbol])
      }
    }
  }

  const handleCloseTab = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (openTabs.length <= 1) return
    
    const newTabs = openTabs.filter(tab => tab !== symbol)
    setOpenTabs(newTabs)
    
    if (symbol === selectedSymbol && newTabs.length > 0) {
      onSymbolChange(newTabs[newTabs.length - 1])
    }
  }

  const handleAddSymbol = (pair: typeof tradingPairs[0]) => {
    const uniqueKey = `${pair.symbol}_${pair.exchange}`
    if (!openTabs.includes(uniqueKey)) {
      setOpenTabs(prev => [...prev, uniqueKey])
      onSymbolChange(uniqueKey)
    }
    setShowAddDropdown(false)
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedExchange('all')
    setSelectedAssetType('crypto')
  }

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    if (categoryId !== 'all') {
      setSelectedExchange('all')
    }
  }

  const handleAssetTypeClick = (assetTypeId: string) => {
    setSelectedAssetType(assetTypeId)
    // Reset category when changing asset type
    setSelectedCategory('all')
    setSelectedExchange('all')
  }

  // Filter available symbols
  const filteredSymbols = tradingPairs.filter(pair => {
    const matchesCategory = selectedCategory === 'all' || pair.category === selectedCategory
    const matchesExchange = selectedExchange === 'all' || pair.exchange === selectedExchange
    const matchesAssetType = selectedAssetType === 'all' || pair.type === selectedAssetType
    const matchesSearch = !searchQuery || 
      pair.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pair.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const uniqueKey = `${pair.symbol}_${pair.exchange}`
    
    // Fix the notAlreadyOpen logic - check both formats
    const notAlreadyOpen = !openTabs.includes(uniqueKey) && !openTabs.includes(pair.symbol)
    
    return matchesCategory && matchesExchange && matchesAssetType && matchesSearch && notAlreadyOpen
  })

  // Get relevant categories based on selected asset type
  const getRelevantCategories = () => {
    if (selectedAssetType === 'crypto') {
      return categories.filter(cat => 
        cat.id === 'all' || 
        ['major', 'defi', 'meme', 'ai', 'layer1'].includes(cat.id)
      )
    } else if (selectedAssetType === 'futures') {
      return categories.filter(cat => 
        cat.id === 'all' || 
        ['indices', 'commodities'].includes(cat.id)
      )
    }
    return categories // Show all when 'all' asset type is selected
  }

  // Group by exchange for display
  const groupedSymbols = filteredSymbols.reduce((acc, pair) => {
    if (!acc[pair.exchange]) {
      acc[pair.exchange] = []
    }
    acc[pair.exchange].push(pair)
    return acc
  }, {} as Record<string, typeof tradingPairs>)

  React.useEffect(() => {
    if (!openTabs.includes(selectedSymbol)) {
      setOpenTabs(prev => [...prev, selectedSymbol])
    }
  }, [selectedSymbol, openTabs])

  // Fixed click-outside handler
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAddDropdown(false)
      }
    }

    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddDropdown])

  // Force reset to crypto defaults when dropdown opens
  React.useEffect(() => {
    if (showAddDropdown) {
      // Reset to sensible defaults to show symbols immediately
      setSelectedAssetType('crypto')
      setSelectedCategory('all')
      setSelectedExchange('all')
      setSearchQuery('')
    }
  }, [showAddDropdown])

  return (
    <div className={`h-8 bg-[#181818] flex items-center px-2 border-b border-gray-700 font-mono ${className}`}>
      <div className="flex space-x-1 items-center">
        {/* Open Tabs */}
        {openTabs.map((tabKey) => {
          const [symbol, exchange] = tabKey.includes('_') ? tabKey.split('_') : [tabKey, 'binance']
          const pair = tradingPairs.find(p => p.symbol === symbol && p.exchange === exchange) || 
                     { symbol, exchange: 'binance', category: 'major', type: 'crypto', name: symbol }
          
          return (
            <div 
              key={tabKey}
              className={`flex items-center px-2 py-1 rounded cursor-pointer transition-all ${
                tabKey === selectedSymbol
                  ? 'bg-blue-600 text-white shadow-lg border border-blue-400'
                  : 'bg-[#202020] hover:bg-[#2a2a2a] hover:border border-transparent'
              }`}
              onClick={() => handlePairClick(tabKey)}
            >
              {tabKey === selectedSymbol && (
                <TrendingUp className="w-3 h-3 mr-1 text-blue-300" />
              )}
              <span className="text-xs font-mono">{pair.exchange} {symbol}</span>
              {openTabs.length > 1 && (
                <X 
                  className="w-3 h-3 ml-1 cursor-pointer hover:text-red-400 transition-colors opacity-70 hover:opacity-100" 
                  onClick={(e) => handleCloseTab(tabKey, e)}
                  title="Close tab"
                />
              )}
            </div>
          )
        })}
        
        {/* Add New Tab Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center px-2 py-1 rounded cursor-pointer transition-all bg-[#151515] hover:bg-[#252525] border border-gray-600 hover:border-gray-500 opacity-60 hover:opacity-100"
            onClick={() => setShowAddDropdown(!showAddDropdown)}
            title="Add new chart"
          >
            <Plus className="w-3 h-3 text-gray-400" />
            <ChevronDown className="w-2 h-2 ml-1 text-gray-400" />
          </button>
          
          {/* Enhanced Add Symbol Dropdown */}
          {showAddDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-[#181818] border border-gray-600 rounded-lg shadow-2xl z-50 w-96 max-h-[500px] overflow-hidden">
              {/* Header with Search */}
              <div className="p-2 border-b border-gray-700 bg-[#1a1a1a]">
                <div className="flex items-center space-x-2 mb-2">
                  <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search symbols..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-[#0f0f0f] border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                {/* Filter Sections */}
                <div className="space-y-1.5">
                  {/* Asset Type Filter */}
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1">Asset Type</div>
                    <div className="flex space-x-1">
                      {assetTypes.map((type) => {
                        const IconComponent = type.icon
                        return (
                          <button
                            key={type.id}
                            className={`px-1.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 font-medium ${
                              selectedAssetType === type.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#353535] hover:text-white'
                            }`}
                            onClick={() => handleAssetTypeClick(type.id)}
                          >
                            <IconComponent className="w-2.5 h-2.5" />
                            <span>{type.name}</span>
                            {type.status === 'wip' && <span className="text-xs opacity-60 bg-yellow-500/20 px-1 rounded">WIP</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Category Filter */}
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1">Category</div>
                    <div className="flex flex-wrap gap-1">
                      {getRelevantCategories().map((category) => {
                        const IconComponent = category.icon
                        return (
                          <button
                            key={category.id}
                            className={`px-1.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 font-medium ${
                              selectedCategory === category.id
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#353535] hover:text-white'
                            }`}
                            onClick={() => handleCategoryClick(category.id)}
                          >
                            <IconComponent className="w-2.5 h-2.5" />
                            <span>{category.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {/* Exchange Filter */}
                  <div>
                    <div className="text-xs font-medium text-gray-400 mb-1">Exchange</div>
                    <div className="flex flex-wrap gap-1">
                      {exchanges.map((exchange) => {
                        const IconComponent = exchange.icon
                        return (
                          <button
                            key={exchange.id}
                            className={`px-1.5 py-1 rounded text-xs transition-colors flex items-center space-x-1 font-medium ${
                              selectedExchange === exchange.id
                                ? 'bg-orange-600 text-white shadow-sm'
                                : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#353535] hover:text-white'
                            }`}
                            onClick={() => setSelectedExchange(exchange.id)}
                          >
                            <IconComponent className="w-2.5 h-2.5" />
                            <span>{exchange.name}</span>
                            {exchange.status === 'wip' && <span className="text-xs opacity-60 bg-yellow-500/20 px-1 rounded">WIP</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Symbol List */}
              <div className="max-h-96 overflow-y-auto">
                {Object.keys(groupedSymbols).length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">
                    No symbols available with current filters
                  </div>
                ) : (
                  Object.entries(groupedSymbols).map(([exchange, pairs]) => {
                    const exchangeInfo = exchanges.find(e => e.id === exchange)
                    const ExchangeIcon = exchangeInfo?.icon || Globe
                    
                    return (
                      <div key={exchange} className="border-b border-gray-700 last:border-b-0">
                        <div className="px-4 py-2 bg-[#1a1a1a] text-xs font-semibold text-gray-300 flex items-center space-x-2 sticky top-0">
                          <ExchangeIcon className="w-3 h-3" />
                          <span>{exchangeInfo?.name || exchange}</span>
                          {exchangeInfo?.status === 'wip' && (
                            <span className="text-yellow-400 text-xs bg-yellow-500/20 px-1 rounded">WIP</span>
                          )}
                          <span className="text-gray-500">({pairs.length})</span>
                        </div>
                        <div className="py-1">
                          {pairs.map((pair) => (
                            <button
                              key={`${pair.symbol}_${pair.exchange}`}
                              className="w-full px-4 py-2 text-left text-xs hover:bg-[#2a2a2a] transition-colors text-gray-300 hover:text-white flex items-center justify-between group"
                              onClick={() => handleAddSymbol(pair)}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-white">{pair.symbol}</span>
                                <span className="text-gray-500">{pair.name}</span>
                              </div>
                              <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs bg-[#0f0f0f] text-gray-400 px-1.5 py-0.5 rounded font-medium">{pair.category}</span>
                                {pair.type === 'futures' && (
                                  <span className="text-xs text-yellow-400 bg-yellow-500/20 px-1.5 py-0.5 rounded">WIP</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="ml-auto flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live data feed"></div>
          <span
            className={`text-xs font-mono cursor-pointer transition-colors ${
              showChartSettings ? 'text-blue-300' : 'hover:text-blue-400'
            }`}
            onClick={onToggleChartSettings}
          >
            {activeChart?.exchange} {activeChart?.symbol}
          </span>
        </div>
        <X className="w-3 h-3 cursor-pointer hover:text-red-400 transition-colors" />
      </div>
    </div>
  )
} 