/**
 * Top Navigation Component
 * Handles the main navigation tabs and help section
 */

import React from 'react'

interface TopNavigationProps {
  className?: string
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ className = "" }) => {
  return (
    <div className={`h-8 bg-[#181818] flex items-center justify-between px-4 border-b border-gray-700 font-mono text-xs ${className}`}>
      <div className="flex space-x-6">
        <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">DOM</span>
        <span className="text-white cursor-pointer font-mono text-xs">Charts</span>
        <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">Orderbooks</span>
        <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">Trades</span>
        <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">Stats</span>
        <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">Layouts</span>
      </div>
      <span className="text-gray-300 cursor-pointer hover:text-white font-mono text-xs">Help</span>
    </div>
  )
} 