# Trading Terminal Settings & Calculations

## Overview
This document provides comprehensive documentation for all settings, calculations, and configurations available in the trading terminal. Each indicator and feature includes detailed explanations of the underlying mathematics and recommended configurations.

---

## Orderbook Settings

### Anomaly Detection System
Identifies unusually large orders that may indicate significant market activity, whale movements, or institutional trading.

#### Calculation Methods

**1. Average (Mean) Method**
```typescript
baseline = sum(orderSizes) / count(orders)
```
- **Best for**: General anomaly detection
- **Sensitivity**: Moderate (affected by outliers)
- **Use case**: Standard trading environments with mixed order sizes

**2. Median Method**
```typescript
baseline = middleValue(sortedOrderSizes)
```
- **Best for**: Markets with many small orders and occasional large ones
- **Sensitivity**: Low (resistant to outliers)
- **Use case**: Retail-heavy markets, altcoins with mixed trading patterns

**3. 75th Percentile Method**
```typescript
baseline = valueAtPercentile(sortedOrderSizes, 0.75)
```
- **Best for**: Conservative detection of truly exceptional orders
- **Sensitivity**: Very low (only catches the largest anomalies)
- **Use case**: High-frequency trading environments, institutional markets

#### Tiered Anomaly Detection
The system uses three tiers of anomaly detection with customizable thresholds and colors:

**Small Anomalies (Default: 2x baseline)**
```typescript
// Typically 1.5x - 5x baseline
if (orderSize >= baseline * smallThreshold) {
  color = smallAnomalyColor // Default: Yellow (#ffeb3b)
}
```
- **Statistical basis**: 1-2 standard deviations above mean
- **Trading significance**: Above-average retail orders
- **Typical range**: 1.5x - 5x baseline
- **Default color**: Yellow (#ffeb3b)

**Medium Anomalies (Default: 5x baseline)**
```typescript
// Typically 2x - 10x baseline  
if (orderSize >= baseline * mediumThreshold) {
  color = mediumAnomalyColor // Default: Orange (#ff9800)
}
```
- **Statistical basis**: 2-3 standard deviations above mean
- **Trading significance**: Institutional-level orders
- **Typical range**: 2x - 10x baseline
- **Default color**: Orange (#ff9800)

**Large Anomalies (Default: 10x baseline)**
```typescript
// Typically 5x - 20x baseline
if (orderSize >= baseline * largeThreshold) {
  color = largeAnomalyColor // Default: Red (#f44336)
}
```
- **Statistical basis**: 3+ standard deviations above mean
- **Trading significance**: Whale-level orders, market-moving size
- **Typical range**: 5x - 20x baseline
- **Default color**: Red (#f44336)

#### Visual Highlighting
```typescript
// Tiered color assignment based on order size
const getAnomalyColor = (orderSize: number, baseline: number) => {
  const ratio = orderSize / baseline
  
  if (ratio >= largeThreshold) return largeAnomalyColor
  if (ratio >= mediumThreshold) return mediumAnomalyColor  
  if (ratio >= smallThreshold) return smallAnomalyColor
  
  return originalColor
}
```

#### Recommended Configurations
| Market Type | Small | Medium | Large | Reasoning |
|-------------|-------|--------|-------|-----------|
| **BTC/USDT** | 2x | 5x | 12x | High volume, mixed order sizes |
| **ETH/USDT** | 2.5x | 6x | 15x | Balanced institutional/retail |
| **Altcoins** | 1.5x | 3x | 8x | More volatile, fewer large orders |
| **Low Volume** | 1.5x | 2.5x | 5x | Every large order matters |
| **High Frequency** | 3x | 8x | 20x | Only catch truly exceptional |

#### Statistical Basis for Thresholds

**Standard Deviation Approach**
```typescript
// Calculate standard deviation of order sizes
const stdDev = Math.sqrt(
  orderSizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / orderSizes.length
)

// Threshold recommendations based on normal distribution
smallThreshold = mean + (1.5 * stdDev)  // ~93% of orders below this
mediumThreshold = mean + (2.5 * stdDev) // ~99% of orders below this  
largeThreshold = mean + (3.5 * stdDev)  // ~99.9% of orders below this
```

**Percentile Approach**
```typescript
// Alternative percentile-based thresholds
smallThreshold = 85th percentile    // Top 15% of orders
mediumThreshold = 95th percentile   // Top 5% of orders
largeThreshold = 99th percentile    // Top 1% of orders
```

**Volume-Weighted Approach**
```typescript
// Consider both order size and price impact
const volumeWeight = orderSize * price
const baselineVolumeWeight = baseline * currentPrice

// Adjust thresholds based on dollar value impact
const adjustedThreshold = baselineThreshold * (volumeWeight / baselineVolumeWeight)
```

---

## Volume Profile Settings

### Order Flow Volume Profile
Analyzes the distribution of trading volume at different price levels to identify key support/resistance zones.

#### Core Calculations

**1. Volume at Price (VAP)**
```typescript
volumeAtPrice[price] = sum(volume where trade.price === price)
```

**2. Point of Control (POC)**
```typescript
POC = priceLevel with max(volumeAtPrice)
```

**3. Value Area**
```typescript
// 70% of total volume around POC
valueAreaHigh = highest price containing 35% volume above POC
valueAreaLow = lowest price containing 35% volume below POC
```

**4. Volume Weighted Average Price (VWAP)**
```typescript
VWAP = sum(price * volume) / sum(volume)
```

#### Profile Types

**Fixed Range Profile**
- **Period**: User-defined start/end times
- **Use case**: Analyzing specific sessions or events
- **Calculation**: Volume aggregated over fixed time period

**Session Profile**
- **Period**: Trading session boundaries (e.g., 24h, market hours)
- **Use case**: Daily/weekly analysis
- **Calculation**: Reset at session boundaries

**Visible Range Profile**
- **Period**: Currently visible chart timeframe
- **Use case**: Dynamic analysis of current view
- **Calculation**: Real-time updates as chart moves

#### Configuration Options
```typescript
interface VolumeProfileSettings {
  profileType: 'fixed' | 'session' | 'visible'
  numberOfRows: number        // 50-200 (price levels)
  valueAreaPercentage: number // 68-70% (standard)
  showPOC: boolean
  showValueArea: boolean
  showVWAP: boolean
  opacity: number             // 0.1-0.8
  colorScheme: 'volume' | 'delta' | 'trades'
}
```

---

## Heatmap Settings

### Order Flow Heatmap
Visualizes trading intensity and order flow imbalances across price and time dimensions.

#### Core Calculations

**1. Trade Intensity**
```typescript
intensity[price][time] = count(trades) + sum(volume) * volumeWeight
```

**2. Order Flow Delta**
```typescript
delta[price][time] = buyVolume - sellVolume
```

**3. Cumulative Delta**
```typescript
cumulativeDelta[time] = sum(delta[price][0...time])
```

**4. Imbalance Detection**
```typescript
imbalance = abs(buyVolume - sellVolume) / totalVolume
isSignificant = imbalance > threshold // typically 0.6-0.8
```

#### Heatmap Types

**Volume Heatmap**
- **Metric**: Trading volume at each price/time cell
- **Color scale**: Blue (low) → Red (high)
- **Use case**: Identifying high-activity zones

**Delta Heatmap**
- **Metric**: Buy vs sell pressure (delta)
- **Color scale**: Red (selling) → Green (buying)
- **Use case**: Order flow analysis

**Trade Count Heatmap**
- **Metric**: Number of individual trades
- **Color scale**: Grayscale intensity
- **Use case**: Microstructure analysis

#### Configuration Options
```typescript
interface HeatmapSettings {
  type: 'volume' | 'delta' | 'trades' | 'imbalance'
  timeResolution: number      // Minutes per column
  priceResolution: number     // Price levels per row
  colorIntensity: number      // 0.1-1.0
  showImbalances: boolean
  imbalanceThreshold: number  // 0.6-0.8
  smoothing: boolean
  aggregationPeriod: number   // Minutes
}
```

---

## Chart Indicators

### Moving Averages

**Simple Moving Average (SMA)**
```typescript
SMA[n] = sum(close[i-n+1...i]) / n
```

**Exponential Moving Average (EMA)**
```typescript
EMA[0] = close[0]
EMA[i] = (close[i] * multiplier) + (EMA[i-1] * (1 - multiplier))
where multiplier = 2 / (period + 1)
```

**Weighted Moving Average (WMA)**
```typescript
WMA[n] = sum(close[i] * weight[i]) / sum(weight[i])
where weight[i] = i + 1
```

### Oscillators

**Relative Strength Index (RSI)**
```typescript
RS = averageGain / averageLoss
RSI = 100 - (100 / (1 + RS))
```

**MACD (Moving Average Convergence Divergence)**
```typescript
MACD = EMA[12] - EMA[26]
Signal = EMA[9] of MACD
Histogram = MACD - Signal
```

**Stochastic Oscillator**
```typescript
%K = ((close - lowest[n]) / (highest[n] - lowest[n])) * 100
%D = SMA[3] of %K
```

### Volatility Indicators

**Bollinger Bands**
```typescript
middleBand = SMA[20]
upperBand = middleBand + (standardDeviation * 2)
lowerBand = middleBand - (standardDeviation * 2)
```

**Average True Range (ATR)**
```typescript
TR = max(high - low, abs(high - previousClose), abs(low - previousClose))
ATR = SMA[14] of TR
```

---

## Real-Time Data Settings

### WebSocket Configuration

**Connection Settings**
```typescript
interface WebSocketSettings {
  reconnectInterval: number   // 1000-5000ms
  maxReconnectAttempts: number // 5-10
  heartbeatInterval: number   // 30000ms
  bufferSize: number         // 1000-10000 messages
  compressionEnabled: boolean
}
```

**Update Thresholds**
```typescript
interface UpdateThresholds {
  priceChangeThreshold: number    // 0.01-0.1 (minimum change to update)
  volumeChangeThreshold: number   // 0.1-1.0
  orderbookUpdateRate: number     // 100-1000ms
  chartUpdateRate: number         // 250-1000ms
}
```

### Data Aggregation

**Candle Aggregation**
```typescript
interface CandleAggregation {
  open: number    // First trade price in period
  high: number    // Highest trade price in period
  low: number     // Lowest trade price in period
  close: number   // Last trade price in period
  volume: number  // Sum of all trade volumes
  trades: number  // Count of individual trades
}
```

**Tick Aggregation**
```typescript
interface TickAggregation {
  method: 'time' | 'volume' | 'trades' | 'range'
  interval: number           // Based on method
  includeWicks: boolean     // For range-based
  volumeThreshold: number   // For volume-based
}
```

---

## Performance Settings

### Rendering Optimization

**Canvas Settings**
```typescript
interface CanvasSettings {
  maxDataPoints: number       // 1000-10000
  renderingMode: 'canvas' | 'svg' | 'webgl'
  antiAliasing: boolean
  pixelRatio: number         // 1-3 (device pixel ratio)
  bufferSize: number         // Off-screen buffer
}
```

**Update Batching**
```typescript
interface BatchingSettings {
  batchSize: number          // 10-100 updates per batch
  batchInterval: number      // 16-100ms (60fps = 16ms)
  priorityUpdates: string[]  // ['price', 'volume', 'orderbook']
  deferredUpdates: string[]  // ['indicators', 'drawings']
}
```

### Memory Management

**Data Retention**
```typescript
interface DataRetention {
  maxCandleHistory: number   // 5000-50000 candles
  maxTradeHistory: number    // 10000-100000 trades
  maxOrderbookLevels: number // 50-500 levels
  cleanupInterval: number    // 300000ms (5 minutes)
}
```

---

## User Interface Settings

### Theme Configuration

**Color Schemes**
```typescript
interface ColorScheme {
  background: string         // Chart background
  grid: string              // Grid lines
  text: string              // Labels and text
  bullish: string           // Up candles/movements
  bearish: string           // Down candles/movements
  volume: string            // Volume bars
  indicators: string[]      // Indicator line colors
}
```

**Predefined Themes**
- **Dark Professional**: `#000000`, `#1a1a1a`, `#333333`
- **Light Clean**: `#ffffff`, `#f5f5f5`, `#cccccc`
- **Trading View**: `#131722`, `#1e222d`, `#2a2e39`
- **Bloomberg**: `#000000`, `#1a1a1a`, `#ff6600`

### Layout Settings

**Panel Configuration**
```typescript
interface PanelLayout {
  orderbook: { width: number, position: 'left' | 'right' }
  trades: { height: number, position: 'top' | 'bottom' }
  indicators: { height: number, panels: number }
  toolbar: { position: 'top' | 'bottom', compact: boolean }
}
```

---

## Advanced Settings

### Algorithm Trading Interface

**Order Management**
```typescript
interface OrderSettings {
  defaultQuantity: number
  defaultOrderType: 'market' | 'limit' | 'stop'
  slippageTolerance: number  // 0.1-1.0%
  maxOrderSize: number
  riskLimits: {
    maxDailyLoss: number
    maxPositionSize: number
    maxDrawdown: number
  }
}
```

### API Configuration

**Rate Limiting**
```typescript
interface RateLimits {
  ordersPerSecond: number    // 10-100
  requestsPerMinute: number  // 1200 (Binance limit)
  websocketConnections: number // 5-10
  retryBackoff: number       // 1000-5000ms
}
```

---

## Debugging & Monitoring

### Performance Metrics
```typescript
interface PerformanceMetrics {
  renderTime: number         // ms per frame
  updateLatency: number      // ms from data to display
  memoryUsage: number        // MB
  cpuUsage: number          // %
  networkLatency: number     // ms
}
```

### Logging Configuration
```typescript
interface LoggingSettings {
  level: 'debug' | 'info' | 'warn' | 'error'
  categories: string[]       // ['websocket', 'trading', 'ui']
  maxLogSize: number        // MB
  retention: number         // Days
}
```

---

## Configuration Examples

### Day Trading Setup
```typescript
const dayTradingConfig = {
  orderbook: {
    anomalyMethod: 'median',
    anomalyThreshold: 3.0,
    highlightAnomalies: true
  },
  volumeProfile: {
    type: 'session',
    numberOfRows: 100,
    showPOC: true,
    showValueArea: true
  },
  heatmap: {
    type: 'delta',
    timeResolution: 1,
    showImbalances: true,
    imbalanceThreshold: 0.7
  }
}
```

### Scalping Setup
```typescript
const scalpingConfig = {
  orderbook: {
    anomalyMethod: 'percentile',
    anomalyThreshold: 2.0,
    highlightAnomalies: true
  },
  updates: {
    orderbookUpdateRate: 100,
    chartUpdateRate: 250
  },
  heatmap: {
    type: 'trades',
    timeResolution: 0.5,
    priceResolution: 0.1
  }
}
```

### Swing Trading Setup
```typescript
const swingTradingConfig = {
  orderbook: {
    anomalyMethod: 'average',
    anomalyThreshold: 5.0,
    highlightAnomalies: false
  },
  volumeProfile: {
    type: 'fixed',
    numberOfRows: 50,
    valueAreaPercentage: 70
  },
  indicators: {
    movingAverages: [20, 50, 200],
    rsi: { period: 14, overbought: 70, oversold: 30 }
  }
}
``` 