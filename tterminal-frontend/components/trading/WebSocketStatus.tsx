/**
 * WebSocket Status Indicator
 * Shows real-time connection status, latency, and update statistics
 */

import React from 'react'
import { tradingWebSocket } from '../../lib/websocket'
import { useWebSocketPrice } from '../../hooks/trading/useWebSocketPrice'

interface WebSocketStatusProps {
  symbol: string
  className?: string
  showDetails?: boolean
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  symbol,
  className = '',
  showDetails = false,
}) => {
  const [isConnected, setIsConnected] = React.useState(false)
  const [connectionCount, setConnectionCount] = React.useState(0)
  const websocketPrice = useWebSocketPrice({ symbol })

  React.useEffect(() => {
    const unsubscribe = tradingWebSocket.onConnectionChange((connected) => {
      setIsConnected(connected)
      if (connected) {
        setConnectionCount(prev => prev + 1)
      }
    })

    return unsubscribe
  }, [])

  const getStatusColor = () => {
    if (!isConnected) return 'text-red-400'
    if (websocketPrice.isStale) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected'
    if (websocketPrice.isStale) return 'Stale'
    return 'Live'
  }

  const getStatusIcon = () => {
    if (!isConnected) return 'OFF'
    if (websocketPrice.isStale) return '!'
    return 'ON'
  }

  const timeSinceUpdate = websocketPrice.lastUpdate > 0 
    ? Date.now() - websocketPrice.lastUpdate 
    : 0

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {/* Connection Status Indicator */}
      <div className="flex items-center space-x-0.5">
        <span className="text-xs">{getStatusIcon()}</span>
        <span className={`text-[10px] font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Detailed Information */}
      {showDetails && isConnected && (
        <div className="flex items-center space-x-1 text-[10px] text-gray-400">
          {/* Current Price */}
          {websocketPrice.price !== null && (
            <div className="flex items-center space-x-0.5">
              <span className="text-xs">$</span>
              <span>${websocketPrice.formattedPrice}</span>
              {websocketPrice.formattedChangePercent && (
                <span className={websocketPrice.isPriceUp ? 'text-green-400' : 'text-red-400'}>
                  {websocketPrice.formattedChangePercent}
                </span>
              )}
            </div>
          )}

          {/* Update Timing */}
          {websocketPrice.lastUpdate > 0 && (
            <div className="flex items-center space-x-0.5">
              <span className="text-xs">T:</span>
              <span>
                {timeSinceUpdate < 1000 
                  ? 'Just now' 
                  : `${Math.floor(timeSinceUpdate / 1000)}s ago`}
              </span>
            </div>
          )}

          {/* Connection Count */}
          {connectionCount > 1 && (
            <div className="flex items-center space-x-0.5">
              <span className="text-xs">R:</span>
              <span>{connectionCount} reconnects</span>
            </div>
          )}
        </div>
      )}

      {/* Fallback to HTTP indicator */}
      {!isConnected && (
        <div className="text-[10px] text-yellow-400">
          HTTP fallback
        </div>
      )}
    </div>
  )
} 