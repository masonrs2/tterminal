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
    <div className={`h-8 bg-[#2a2a2a] flex items-center justify-between px-4 border-b border-gray-700 ${className}`}>
      <div className="flex space-x-6">
        <span className="text-gray-300 cursor-pointer hover:text-white">DOM</span>
        <span className="text-white cursor-pointer">Charts</span>
        <span className="text-gray-300 cursor-pointer hover:text-white">Orderbooks</span>
        <span className="text-gray-300 cursor-pointer hover:text-white">Trades</span>
        <span className="text-gray-300 cursor-pointer hover:text-white">Stats</span>
        <span className="text-gray-300 cursor-pointer hover:text-white">Layouts</span>
      </div>
      <span className="text-gray-300 cursor-pointer hover:text-white">Help</span>
    </div>
  )
} 