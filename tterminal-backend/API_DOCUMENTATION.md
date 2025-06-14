# TTerminal Backend API Documentation

Ultra-fast trading terminal backend API with optimized endpoints for real-time financial data.

## Recent Updates

### v2.1.0 - Enhanced Liquidation Support (Latest)
- **Major Pair Liquidations**: Added support for BTCUSDT, ETHUSDT, and other major trading pairs
- **Dual Stream Architecture**: Implemented both individual symbol streams (`btcusdt@forceOrder`) and global stream (`!forceOrder@arr`)
- **Accurate Liquidation Data**: Now uses Binance average price for actual liquidation prices
- **Enhanced Data Format**: Improved liquidation response format with complete Binance data structure
- **Code Cleanup**: Removed emoji characters from all log statements for cleaner production logs

### v2.0.0 - WebSocket Streaming
- **Real-time WebSocket Streaming**: Sub-100ms price updates with direct Binance integration
- **Enhanced Volume Data**: Real buy/sell volume data from Binance (not estimated)
- **Futures Support**: Mark price, funding rates, and liquidation streaming
- **Ultra-fast Aggregation**: 70% smaller payloads with intelligent caching

## Base URL
```
http://localhost:8080/api/v1
```

## Health Check

### GET /health
Check the health status of the backend services.

**Request:**
```bash
curl http://localhost:8080/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "healthy"
}
```

## Candles Endpoints

### GET /candles/:symbol
Get optimized candle data for a symbol with **real buy/sell volume data**.

**Parameters:**
- `symbol` (path): Trading pair symbol (e.g., BTCUSDT)
- `interval` (query): Time interval (1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (query): Number of candles (default: 100, max: 1500)

**Request:**
```bash
curl "http://localhost:8080/api/v1/candles/BTCUSDT?interval=1m&limit=5"
```

**Response:**
```json
{
  "s": "BTCUSDT",
  "i": "1m", 
  "d": [
    {
      "t": 1748109720000,
      "o": 108903.8,
      "h": 108903.8,
      "l": 108903.7,
      "c": 108903.8,
      "v": 2.107,
      "bv": 1.234,
      "sv": 0.873
    }
  ],
  "n": 5,
  "f": 1748109720000,
  "l": 1748109480000
}
```

**Response Fields:**
- `s`: Symbol
- `i`: Interval
- `d`: Data array of candles
  - `t`: Timestamp (Unix milliseconds)
  - `o`: Open price
  - `h`: High price
  - `l`: Low price
  - `c`: Close price
  - `v`: Total volume
  - `bv`: **Buy volume (taker buy base asset volume)** - Real data from Binance
  - `sv`: **Sell volume (total - buy volume)** - Real data from Binance
- `n`: Number of candles
- `f`: First timestamp
- `l`: Last timestamp

### GET /candles/:symbol/latest
Get the latest candle for a symbol with **real buy/sell volume data**.

**Request:**
```bash
curl "http://localhost:8080/api/v1/candles/BTCUSDT/latest?interval=1m"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "candle": {
    "t": 1748109720000,
    "o": 108903.8,
    "h": 108903.8,
    "l": 108903.7,
    "c": 108903.8,
    "v": 2.107,
    "bv": 1.234,
    "sv": 0.873
  }
}
```

**Candle Fields:**
- `t`: Timestamp (Unix milliseconds)
- `o`: Open price
- `h`: High price
- `l`: Low price
- `c`: Close price
- `v`: Total volume
- `bv`: **Buy volume (taker buy base asset volume)** - Real data from Binance
- `sv`: **Sell volume (total - buy volume)** - Real data from Binance

### GET /candles/:symbol/range
Get candles within a specific time range.

**Parameters:**
- `start_time` (query): Start timestamp (Unix milliseconds)
- `end_time` (query): End timestamp (Unix milliseconds)
- `interval` (query): Time interval

**Request:**
```bash
curl "http://localhost:8080/api/v1/candles/BTCUSDT/range?interval=1m&start_time=1748109000000&end_time=1748110000000"
```

## Ultra-Fast Aggregation Endpoints

### GET /aggregation/stats
Get service statistics and performance metrics.

**Request:**
```bash
curl http://localhost:8080/api/v1/aggregation/stats
```

**Response:**
```json
{
  "service": "aggregation",
  "stats": {
    "aggregations": 0,
    "error_count": 0,
    "last_error": null,
    "last_error_time": "0001-01-01T00:00:00Z",
    "memory_cache_size": 0,
    "workers": 8
  },
  "timestamp": "2025-05-24T13:03:10.493582-05:00"
}
```

### GET /aggregation/candles/:symbol/:interval
Get ultra-optimized candle data (70% smaller payload) with **real buy/sell volume data**.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `interval` (path): Time interval (1m, 5m, 15m, 1h, 4h, 1d)
- `limit` (query): Number of candles (default: 500, max: 5000)

**Request:**
```bash
curl "http://localhost:8080/api/v1/aggregation/candles/BTCUSDT/1m?limit=5"
```

**Response:**
```json
{
  "s": "BTCUSDT",
  "i": "1m",
  "d": [
    {
      "t": 1748109720000,
      "o": 108903.8,
      "h": 108903.8,
      "l": 108903.7,
      "c": 108903.8,
      "v": 2.107,
      "bv": 1.234,
      "sv": 0.873
    }
  ],
  "n": 5,
  "f": 1748109720000,
  "l": 1748109480000
}
```

**Response Fields:**
- `s`: Symbol
- `i`: Interval
- `d`: Data array of candles
  - `t`: Timestamp (Unix milliseconds)
  - `o`: Open price
  - `h`: High price
  - `l`: Low price
  - `c`: Close price
  - `v`: Total volume
  - `bv`: **Buy volume (taker buy base asset volume)** - Real data from Binance
  - `sv`: **Sell volume (total - buy volume)** - Real data from Binance
- `n`: Number of candles
- `f`: First timestamp
- `l`: Last timestamp

### GET /aggregation/volume-profile/:symbol
Get volume profile data showing volume distribution across price levels.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `hours` (query): Time range in hours (default: 24, max: 168)

**Request:**
```bash
curl "http://localhost:8080/api/v1/aggregation/volume-profile/BTCUSDT?hours=1"
```

**Response:**
```json
{
  "s": "BTCUSDT",
  "st": 1748105400000,
  "et": 1748109000000,
  "l": [
    {
      "p": 108894.685,
      "v": 0.20028,
      "pct": 0.07235183191601478
    }
  ],
  "poc": 108894.685,
  "vah": 108903.095,
  "val": 108894.685,
  "vav": 70
}
```

**Response Fields:**
- `s`: Symbol
- `st`: Start time (Unix milliseconds)
- `et`: End time (Unix milliseconds)
- `l`: Volume profile levels array
  - `p`: Price level
  - `v`: Volume at this price
  - `pct`: Percentage of total volume
- `poc`: Point of Control (highest volume price)
- `vah`: Value Area High
- `val`: Value Area Low
- `vav`: Value Area Volume percentage

### GET /aggregation/footprint/:symbol/:interval
Get footprint chart data showing order flow information.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `interval` (path): Time interval
- `limit` (query): Number of candles (default: 100, max: 1000)

**Request:**
```bash
curl "http://localhost:8080/api/v1/aggregation/footprint/BTCUSDT/1m?limit=10"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "data": [
    {
      "t": 1748109720000,
      "l": [],
      "tbv": 1.2642,
      "tsv": 0.8428,
      "td": 0.4214,
      "poc": 108903.8
    }
  ],
  "count": 10
}
```

**Response Fields:**
- `t`: Candle timestamp
- `l`: Price levels with buy/sell volume
- `tbv`: Total buy volume
- `tsv`: Total sell volume
- `td`: Total delta (buy - sell)
- `poc`: Point of Control price

### GET /aggregation/liquidations/:symbol
Get detected liquidation events.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `hours` (query): Time range in hours (default: 1, max: 24)

**Request:**
```bash
curl "http://localhost:8080/api/v1/aggregation/liquidations/BTCUSDT?hours=1"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "timeRange": 1,
  "liquidations": [
    {
      "t": 1748109600000,
      "p": 108904.4,
      "v": 51.853,
      "side": "unknown",
      "type": "single",
      "conf": 0.7
    }
  ],
  "count": 1
}
```

**Response Fields:**
- `t`: Timestamp
- `p`: Price at liquidation
- `v`: Volume
- `side`: "buy" or "sell"
- `type`: "single", "cascade", or "sweep"
- `conf`: Confidence score (0-1)

**Enhanced Liquidation Features:**
- **Major Pair Coverage**: Now includes BTCUSDT, ETHUSDT, and all major trading pairs
- **Accurate Pricing**: Uses average price for actual liquidation price, includes order price for reference
- **Real-time Streaming**: Sub-100ms updates from Binance Futures liquidation streams
- **Correct Side Identification**: "BUY" = liquidated long positions, "SELL" = liquidated short positions

### GET /aggregation/heatmap/:symbol
Get price/volume heatmap data.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `hours` (query): Time range in hours (default: 6, max: 48)
- `resolution` (query): Grid resolution (default: 100, range: 10-500)

**Request:**
```bash
curl "http://localhost:8080/api/v1/aggregation/heatmap/BTCUSDT?hours=6&resolution=100"
```

**Response:**
```json
{
  "s": "BTCUSDT",
  "st": 1748087400000,
  "et": 1748109000000,
  "l": [
    {
      "p": 108904.4,
      "t": 1748109600000,
      "v": 51.853,
      "i": 1.0
    }
  ],
  "max": 51.853
}
```

**Response Fields:**
- `s`: Symbol
- `st`: Start time
- `et`: End time
- `l`: Heatmap cells array
  - `p`: Price
  - `t`: Time
  - `v`: Volume
  - `i`: Intensity (0-1, normalized)
- `max`: Maximum volume for normalization

### POST /aggregation/multi
Get multiple data types in one efficient request.

**Request Body:**
```json
{
  "symbol": "BTCUSDT",
  "intervals": ["1m", "5m", "15m", "1h"],
  "limit": 500,
  "include_volume_profile": true,
  "include_liquidations": true,
  "vp_hours": 24,
  "liq_hours": 1
}
```

**Request:**
```bash
curl -X POST "http://localhost:8080/api/v1/aggregation/multi" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "intervals": ["1m", "5m"],
    "limit": 100,
    "include_volume_profile": true,
    "include_liquidations": true,
    "vp_hours": 24,
    "liq_hours": 1
  }'
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "candles": {
    "1m": {
      "s": "BTCUSDT",
      "i": "1m",
      "d": [...],
      "n": 100
    },
    "5m": {
      "s": "BTCUSDT", 
      "i": "5m",
      "d": [...],
      "n": 100
    }
  },
  "volume_profile": {
    "s": "BTCUSDT",
    "l": [...],
    "poc": 108894.685
  },
  "liquidations": [
    {
      "t": 1748109600000,
      "p": 108904.4,
      "v": 51.853
    }
  ]
}
```

## Symbol Management

### GET /symbols
Get all available trading symbols.

**Request:**
```bash
curl http://localhost:8080/api/v1/symbols
```

### GET /symbols/:symbol
Get information for a specific symbol.

**Request:**
```bash
curl http://localhost:8080/api/v1/symbols/BTCUSDT
```

### POST /symbols
Create a new symbol.

**Request:**
```bash
curl -X POST "http://localhost:8080/api/v1/symbols" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "base_asset": "BTC",
    "quote_asset": "USDT"
  }'
```

## ULTRA-FAST WEBSOCKET STREAMING

**NEW**: Real-time price streaming with sub-100ms latency. The fastest trading terminal backend with direct Binance WebSocket integration.

### Architecture Overview

- **Direct Binance Connection**: Single WebSocket stream to Binance for all symbols
- **Real-time Broadcasting**: Instant price updates to all connected clients
- **Intelligent Caching**: Server-side price caching for ultra-fast responses
- **Automatic Reconnection**: Robust error handling with automatic reconnection
- **Scalable Design**: Supports 1000+ concurrent connections

### Production Performance Goals

- **Latency**: Sub-100ms from Binance to client
- **Throughput**: 1000+ concurrent WebSocket connections
- **Reliability**: 99.9% uptime with automatic failover
- **Efficiency**: 90%+ reduction in database queries vs HTTP polling

### WebSocket Connection

#### WS /websocket/connect
Upgrade HTTP connection to WebSocket for real-time streaming.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/websocket/connect');
```

**Connection Confirmation:**
```json
{
  "type": "connected",
  "message": "WebSocket connection established",
  "clientId": "a1b2c3d4",
  "timestamp": 1748120000000
}
```

#### Client Messages

**Subscribe to Symbol:**
```json
{
  "type": "subscribe",
  "symbol": "BTCUSDT"
}
```

**Unsubscribe from Symbol:**
```json
{
  "type": "unsubscribe", 
  "symbol": "BTCUSDT"
}
```

**Ping (Heartbeat):**
```json
{
  "type": "ping"
}
```

**Get Statistics:**
```json
{
  "type": "getStats"
}
```

#### Server Messages

**Price Update (Real-time):**
```json
{
  "type": "price_update",
  "symbol": "BTCUSDT",
  "price": 108971.79,
  "change": 127.44,
  "changePercent": 0.117,
  "volume": 12845.123,
  "timestamp": 1748120001234
}
```

**Trade Update (Real-time Buy/Sell Volume):**
```json
{
  "type": "trade_update",
  "symbol": "BTCUSDT",
  "price": 108971.79,
  "quantity": 0.1,
  "is_buyer_maker": false,
  "trade_time": 1748120001234,
  "timestamp": 1748120001234
}
```

**Kline Update (Real-time Candle with Buy/Sell Volume):**
```json
{
  "type": "kline_update",
  "symbol": "BTCUSDT",
  "interval": "1m",
  "open": 108900.0,
  "high": 108980.0,
  "low": 108850.0,
  "close": 108971.79,
  "volume": 12.345,
  "taker_buy_volume": 7.234,
  "taker_sell_volume": 5.111,
  "is_closed": false,
  "start_time": 1748120000000,
  "end_time": 1748120059999,
  "timestamp": 1748120001234
}
```

**Depth Update (Order Book):**
```json
{
  "type": "depth_update",
  "symbol": "BTCUSDT",
  "bids": [
    ["108900.0", "1.234"],
    ["108899.5", "0.567"]
  ],
  "asks": [
    ["108901.0", "0.890"],
    ["108901.5", "2.345"]
  ],
  "timestamp": 1748120001234
}
```

**Mark Price Update (Futures):**
```json
{
  "type": "mark_price_update",
  "symbol": "BTCUSDT",
  "mark_price": 108903.45,
  "funding_rate": 0.0001,
  "next_funding_time": 1748140800000,
  "timestamp": 1748120001234
}
```

**Liquidation Update (Futures):**
```json
{
  "type": "liquidation_update",
  "symbol": "BTCUSDT",
  "side": "BUY",
  "price": 109440.70,
  "order_price": "109862.30",
  "quantity": 0.006,
  "trade_time": 1748304689122,
  "timestamp": 1748304689126,
  "order_status": "FILLED"
}
```

**Subscription Confirmation:**
```json
{
  "type": "subscribed",
  "symbol": "BTCUSDT",
  "message": "Successfully subscribed to BTCUSDT",
  "timestamp": 1748120000000
}
```

**Statistics Response:**
```json
{
  "type": "stats",
  "clientCount": 42,
  "subscriptions": {
    "BTCUSDT": 15,
    "ETHUSDT": 8,
    "BNBUSDT": 3
  },
  "yourSymbols": ["BTCUSDT", "ETHUSDT"],
  "timestamp": 1748120000000
}
```

### HTTP Fallback Endpoints

For compatibility and monitoring when WebSocket is not available.

#### GET /websocket/stats
Get WebSocket service statistics and status.

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/stats"
```

**Response:**
```json
{
  "connected_clients": 0,
  "subscriptions": {},
  "binance_stream": {
    "connected_symbols": 5,
    "symbols": ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT"],
    "price_data_count": 5,
    "depth_data_count": 5,
    "kline_data_count": 15,
    "futures_ticker_count": 5,
    "mark_price_count": 5,
    "is_running": true,
    "spot_connected": true,
    "futures_connected": true,
    "stream_types": [
      "spot_ticker", "futures_ticker", "depth@100ms", "trade", "aggTrade",
      "kline_1m", "kline_5m", "kline_15m", "markPrice", "liquidations"
    ],
    "trade_counts": {
      "BTCUSDT": 1000,
      "ETHUSDT": 856
    },
    "liquidation_counts": {
      "BTCUSDT": 12,
      "ETHUSDT": 8
    }
  },
  "service": "websocket",
  "status": "active"
}
```

#### GET /websocket/price/:symbol
Get the latest cached price from WebSocket stream.

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/price/BTCUSDT"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "price": 108971.79,
  "source": "websocket"
}
```

**Error Response (Symbol not available):**
```json
{
  "error": "Price not available for symbol: INVALIDUSDT"
}
```

#### POST /websocket/symbols/:symbol
Add a new symbol to the Binance WebSocket stream.

**Request:**
```bash
curl -X POST "http://localhost:8080/api/v1/websocket/symbols/SOLUSDT"
```

**Response:**
```json
{
  "message": "Symbol added to stream",
  "symbol": "SOLUSDT",
  "symbols": [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT", 
    "ADAUSDT",
    "SOLUSDT"
  ]
}
```

#### GET /websocket/volume/:symbol
Get real-time buy/sell volume data for a symbol with **dynamic interval support**.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `interval` (query): Time interval (1m, 5m, 15m, 1h, 4h, 1d) - defaults to 1m if not provided

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/volume/BTCUSDT?interval=5m"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "current_candle": {
    "interval": "5m",
    "total_volume": 12.345,
    "buy_volume": 7.234,
    "sell_volume": 5.111,
    "delta": 2.123,
    "buy_percentage": 58.6,
    "sell_percentage": 41.4,
    "start_time": 1748120000000,
    "is_closed": false
  },
  "recent_trades": [
    {
      "price": 108971.79,
      "quantity": 0.1,
      "is_buy": true,
      "timestamp": 1748120001234
    }
  ],
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

**Key Features:**
- **Real buy/sell volume data** from Binance (not estimated)
- **Dynamic interval support** - works with any valid timeframe
- **Real-time updates** from WebSocket cache
- **Percentage calculations** for buy/sell distribution

#### GET /websocket/depth/:symbol
Get the latest order book depth data for a symbol.

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/depth/BTCUSDT"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "bids": [
    ["108900.0", "1.234"],
    ["108899.5", "0.567"]
  ],
  "asks": [
    ["108901.0", "0.890"],
    ["108901.5", "2.345"]
  ],
  "first_update_id": 12345678,
  "final_update_id": 12345679,
  "event_time": 1748120000000,
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

#### GET /websocket/trades/:symbol
Get recent trades for a symbol.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `limit` (query): Number of trades to return (default: 100)

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/trades/BTCUSDT?limit=5"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "trades": [
    {
      "id": 123456789,
      "price": "108900.50",
      "qty": "0.001",
      "time": 1748120000000,
      "isBuyerMaker": false
    }
  ],
  "count": 5,
  "limit": 5,
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

#### GET /websocket/kline/:symbol/:interval
Get the latest kline data for a symbol and interval.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `interval` (path): Time interval (1m, 5m, 15m, 1h, 4h, 1d)

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/kline/BTCUSDT/1m"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "kline": {
    "t": 1748120000000,
    "T": 1748120059999,
    "s": "BTCUSDT",
    "i": "1m",
    "o": "108900.00",
    "c": "108905.50",
    "h": "108910.00",
    "l": "108895.00",
    "v": "12.345",
    "V": "7.234",
    "Q": "783456.78",
    "n": 156,
    "x": true
  },
  "buy_volume": 7.234,
  "sell_volume": 5.111,
  "delta": 2.123,
  "event_time": 1748120000000,
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

### Futures-Specific Endpoints

#### GET /websocket/markprice/:symbol
Get the latest Futures mark price data for a symbol.

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/markprice/BTCUSDT"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "mark_price": "108903.45",
  "index_price": "108902.12",
  "estimated_price": "108904.78",
  "funding_rate": "0.0001",
  "next_funding_time": 1748140800000,
  "event_time": 1748120000000,
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

#### GET /websocket/liquidations/:symbol
Get recent Futures liquidations for a symbol with **enhanced major pair support**.

**Parameters:**
- `symbol` (path): Trading pair symbol
- `limit` (query): Number of liquidations to return (default: 100)

**Request:**
```bash
curl "http://localhost:8080/api/v1/websocket/liquidations/BTCUSDT?limit=10"
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "liquidations": [
    {
      "e": "forceOrder",
      "E": 1748304689126,
      "o": {
        "s": "BTCUSDT",
        "S": "BUY",
        "o": "LIMIT",
        "f": "IOC",
        "q": "0.006",
        "p": "109862.30",
        "ap": "109440.70",
        "X": "FILLED",
        "l": "0.006",
        "z": "0.006",
        "T": 1748304689122
      }
    }
  ],
  "count": 10,
  "limit": 10,
  "timestamp": 1748120001234,
  "source": "websocket_cache"
}
```

**Enhanced Features:**
- **Major Pair Support**: Now includes BTCUSDT, ETHUSDT, and other major pairs
- **Dual Stream Architecture**: Uses both individual symbol streams (`btcusdt@forceOrder`) and global stream (`!forceOrder@arr`)
- **Real Binance Data**: Direct from Binance Futures liquidation streams
- **Accurate Pricing**: Uses average price (`ap`) for actual liquidation price
- **Side Accuracy**: Correct "BUY" (liquidated longs) and "SELL" (liquidated shorts) identification

**Response Fields:**
- `e`: Event type ("forceOrder")
- `E`: Event time (Unix milliseconds)
- `o`: Liquidation order details
  - `s`: Symbol
  - `S`: Side ("BUY" = liquidated long, "SELL" = liquidated short)
  - `o`: Order type
  - `f`: Time in force
  - `q`: Original quantity
  - `p`: Order price
  - `ap`: **Average price (actual liquidation price)**
  - `X`: Order status
  - `l`: Last filled quantity
  - `z`: Accumulated filled quantity
  - `T`: Trade time

### Frontend Integration Example

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/api/v1/websocket/connect');

// Handle connection
ws.onopen = () => {
  console.log('Connected to TTerminal WebSocket');
  
  // Subscribe to Bitcoin prices
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbol: 'BTCUSDT'
  }));
};

// Handle real-time price updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'price_update') {
    console.log(`${data.symbol}: $${data.price} (${data.changePercent}%)`);
    // Update your chart/UI with new price
    updatePrice(data.symbol, data.price);
  }
};

// Handle disconnection with auto-reconnect
ws.onclose = () => {
  console.log('WebSocket disconnected, attempting reconnect...');
  setTimeout(() => connectWebSocket(), 5000);
};
```

### Performance Comparison

| Method | Latency | Database Load | Scalability | Cost |
|--------|---------|---------------|-------------|------|
| **HTTP Polling (500ms)** | 500ms-2s | High (2 req/s/user) | Limited | High |
| **WebSocket Streaming** | <100ms | Very Low (cached) | 1000+ users | Low |

### Error Handling

**Connection Errors:**
- Automatic reconnection with exponential backoff
- Graceful degradation to HTTP polling
- Connection status monitoring

**Binance Stream Errors:**
- Automatic Binance WebSocket reconnection
- Price cache maintains last known prices
- Service continues with cached data

**Message Errors:**
- Invalid JSON messages are logged and ignored
- Unknown message types return warning
- Malformed subscriptions are rejected

### Production Deployment Notes

1. **WebSocket URL**: Update to `wss://your-domain.com/api/v1/websocket/connect` for production
2. **Origin Restrictions**: Configure CORS origins in production
3. **Rate Limiting**: WebSocket connections are rate-limited by IP
4. **Monitoring**: Use `/websocket/stats` endpoint for health checks
5. **Load Balancing**: WebSocket sticky sessions required for load balancers

### Binance Stream Status

Currently streaming: **BTCUSDT, ETHUSDT, BNBUSDT, ADAUSDT, SOLUSDT**

**Verified Working (Test Results):**
- WebSocket server running and active
- Connected to Binance WebSocket stream
- Real-time price updates (verified BTC: $108,963.35 → $108,971.79)
- Multiple symbols streaming
- HTTP fallback endpoints working
- Service statistics available

## Performance Features

- **Ultra-fast response times**: < 50ms for aggregation endpoints
- **Optimized payloads**: 70% smaller JSON responses
- **Multi-layer caching**: Memory + Redis caching
- **Parallel processing**: 8 worker goroutines
- **Real-time data**: Direct Binance API integration
- **Connection pooling**: Optimized HTTP client configuration

## Response Headers

All endpoints include performance headers:
- `X-Response-Time`: Actual response time
- `X-Data-Count`: Number of data points returned
- `X-Cache-Key`: Cache key used (for debugging)
- `Cache-Control`: Caching policy

## Error Handling

All endpoints return structured error responses:
```json
{
  "error": "Invalid parameter value",
  "message": "Limit must be between 1 and 5000, got: 999999",
  "code": "INVALID_LIMIT_RANGE",
  "details": {
    "parameter": "limit",
    "value": "999999",
    "min": "1",
    "max": "5000"
  }
}
```

## Rate Limits

- **General endpoints**: 1200 requests per minute
- **Aggregation endpoints**: Optimized with intelligent caching
- **Real-time endpoints**: Real-time updates with WebSocket support 