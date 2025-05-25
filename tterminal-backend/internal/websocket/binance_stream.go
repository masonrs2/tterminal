package websocket

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// StreamType represents the type of Binance stream
type StreamType string

const (
	StreamTypeSpot    StreamType = "spot"
	StreamTypeFutures StreamType = "futures"
)

// BinanceStream handles real-time data from Binance WebSocket (Spot + Futures)
type BinanceStream struct {
	hub         *Hub
	spotConn    *websocket.Conn
	futuresConn *websocket.Conn
	symbols     []string
	isRunning   bool
	lastPrices  map[string]float64
	// Enhanced data storage for volume profile
	depthData map[string]*BinanceDepthData
	tradeData map[string][]*BinanceTradeData
	klineData map[string]*BinanceKlineData
	// Futures-specific data
	futuresTickerData map[string]*BinanceFuturesTickerData
	markPriceData     map[string]*BinanceMarkPriceData
	fundingRateData   map[string]*BinanceFundingRateData
	liquidationData   map[string][]*BinanceLiquidationData
}

// BinanceTickerData represents Binance 24hr ticker data (Spot)
type BinanceTickerData struct {
	EventType          string `json:"e"` // Event type
	EventTime          int64  `json:"E"` // Event time
	Symbol             string `json:"s"` // Symbol
	PriceChange        string `json:"p"` // Price change
	PriceChangePercent string `json:"P"` // Price change percent
	WeightedAvgPrice   string `json:"w"` // Weighted average price
	FirstTradePrice    string `json:"x"` // First trade(F)-1 price (first trade before the 24hr rolling window)
	LastPrice          string `json:"c"` // Last price
	LastQuantity       string `json:"Q"` // Last quantity
	BestBidPrice       string `json:"b"` // Best bid price
	BestBidQuantity    string `json:"B"` // Best bid quantity
	BestAskPrice       string `json:"a"` // Best ask price
	BestAskQuantity    string `json:"A"` // Best ask quantity
	OpenPrice          string `json:"o"` // Open price
	HighPrice          string `json:"h"` // High price
	LowPrice           string `json:"l"` // Low price
	TotalTradedVolume  string `json:"v"` // Total traded base asset volume
	TotalTradedValue   string `json:"q"` // Total traded quote asset volume
	OpenTime           int64  `json:"O"` // Statistics open time
	CloseTime          int64  `json:"C"` // Statistics close time
	FirstTradeID       int64  `json:"F"` // First trade ID
	LastTradeID        int64  `json:"L"` // Last trade Id
	TradeCount         int64  `json:"n"` // Total number of trades
}

// BinanceFuturesTickerData represents Binance Futures 24hr ticker data
type BinanceFuturesTickerData struct {
	EventType          string `json:"e"` // Event type
	EventTime          int64  `json:"E"` // Event time
	Symbol             string `json:"s"` // Symbol
	PriceChange        string `json:"p"` // Price change
	PriceChangePercent string `json:"P"` // Price change percent
	WeightedAvgPrice   string `json:"w"` // Weighted average price
	LastPrice          string `json:"c"` // Last price
	LastQuantity       string `json:"Q"` // Last quantity
	BestBidPrice       string `json:"b"` // Best bid price
	BestBidQuantity    string `json:"B"` // Best bid quantity
	BestAskPrice       string `json:"a"` // Best ask price
	BestAskQuantity    string `json:"A"` // Best ask quantity
	OpenPrice          string `json:"o"` // Open price
	HighPrice          string `json:"h"` // High price
	LowPrice           string `json:"l"` // Low price
	TotalTradedVolume  string `json:"v"` // Total traded base asset volume
	TotalTradedValue   string `json:"q"` // Total traded quote asset volume
	OpenTime           int64  `json:"O"` // Statistics open time
	CloseTime          int64  `json:"C"` // Statistics close time
	FirstTradeID       int64  `json:"F"` // First trade ID
	LastTradeID        int64  `json:"L"` // Last trade Id
	TradeCount         int64  `json:"n"` // Total number of trades
}

// BinanceMarkPriceData represents Futures mark price data
type BinanceMarkPriceData struct {
	EventType       string `json:"e"` // Event type
	EventTime       int64  `json:"E"` // Event time
	Symbol          string `json:"s"` // Symbol
	MarkPrice       string `json:"p"` // Mark price
	IndexPrice      string `json:"i"` // Index price
	EstimatedPrice  string `json:"P"` // Estimated settle price, only useful in the last hour before the settlement starts
	FundingRate     string `json:"r"` // Funding rate
	NextFundingTime int64  `json:"T"` // Next funding time
}

// BinanceFundingRateData represents Futures funding rate data
type BinanceFundingRateData struct {
	EventType       string `json:"e"` // Event type
	EventTime       int64  `json:"E"` // Event time
	Symbol          string `json:"s"` // Symbol
	FundingRate     string `json:"r"` // Funding rate
	NextFundingTime int64  `json:"T"` // Next funding time
}

// BinanceLiquidationData represents Futures liquidation order data
type BinanceLiquidationData struct {
	EventType        string `json:"e"` // Event type
	EventTime        int64  `json:"E"` // Event time
	LiquidationOrder struct {
		Symbol           string `json:"s"`  // Symbol
		Side             string `json:"S"`  // Side
		OrderType        string `json:"o"`  // Order Type
		TimeInForce      string `json:"f"`  // Time in Force
		OriginalQuantity string `json:"q"`  // Original Quantity
		Price            string `json:"p"`  // Price
		AveragePrice     string `json:"ap"` // Average Price
		OrderStatus      string `json:"X"`  // Order Status
		LastFilledQty    string `json:"l"`  // Last Filled Quantity
		AccumulatedQty   string `json:"z"`  // Accumulated Filled Quantity
		TradeTime        int64  `json:"T"`  // Trade Time
	} `json:"o"`
}

// BinanceDepthData represents order book depth data
type BinanceDepthData struct {
	EventType     string     `json:"e"` // Event type
	EventTime     int64      `json:"E"` // Event time
	Symbol        string     `json:"s"` // Symbol
	FirstUpdateID int64      `json:"U"` // First update ID in event
	FinalUpdateID int64      `json:"u"` // Final update ID in event
	Bids          [][]string `json:"b"` // Bids to be updated
	Asks          [][]string `json:"a"` // Asks to be updated
}

// BinanceTradeData represents individual trade data
type BinanceTradeData struct {
	EventType     string `json:"e"` // Event type
	EventTime     int64  `json:"E"` // Event time
	Symbol        string `json:"s"` // Symbol
	TradeID       int64  `json:"t"` // Trade ID
	Price         string `json:"p"` // Price
	Quantity      string `json:"q"` // Quantity
	BuyerOrderID  int64  `json:"b"` // Buyer order ID
	SellerOrderID int64  `json:"a"` // Seller order ID
	TradeTime     int64  `json:"T"` // Trade time
	IsBuyerMaker  bool   `json:"m"` // Is the buyer the market maker?
	Ignore        bool   `json:"M"` // Ignore
}

// BinanceKlineData represents kline/candlestick data
type BinanceKlineData struct {
	EventType string `json:"e"` // Event type
	EventTime int64  `json:"E"` // Event time
	Symbol    string `json:"s"` // Symbol
	Kline     struct {
		StartTime           int64  `json:"t"` // Kline start time
		EndTime             int64  `json:"T"` // Kline close time
		Symbol              string `json:"s"` // Symbol
		Interval            string `json:"i"` // Interval
		FirstTradeID        int64  `json:"f"` // First trade ID
		LastTradeID         int64  `json:"L"` // Last trade ID
		Open                string `json:"o"` // Open price
		Close               string `json:"c"` // Close price
		High                string `json:"h"` // High price
		Low                 string `json:"l"` // Low price
		Volume              string `json:"v"` // Base asset volume
		TradeCount          int64  `json:"n"` // Number of trades
		IsClosed            bool   `json:"x"` // Is this kline closed?
		QuoteVolume         string `json:"q"` // Quote asset volume
		TakerBuyBaseVolume  string `json:"V"` // Taker buy base asset volume
		TakerBuyQuoteVolume string `json:"Q"` // Taker buy quote asset volume
		Ignore              string `json:"B"` // Ignore
	} `json:"k"`
}

// BinanceCombinedStreamMessage represents a combined stream message
type BinanceCombinedStreamMessage struct {
	Stream string      `json:"stream"`
	Data   interface{} `json:"data"`
}

// NewBinanceStream creates a new enhanced Binance WebSocket stream (Spot + Futures)
func NewBinanceStream(hub *Hub, symbols []string) *BinanceStream {
	return &BinanceStream{
		hub:               hub,
		symbols:           symbols,
		lastPrices:        make(map[string]float64),
		depthData:         make(map[string]*BinanceDepthData),
		tradeData:         make(map[string][]*BinanceTradeData),
		klineData:         make(map[string]*BinanceKlineData),
		futuresTickerData: make(map[string]*BinanceFuturesTickerData),
		markPriceData:     make(map[string]*BinanceMarkPriceData),
		fundingRateData:   make(map[string]*BinanceFundingRateData),
		liquidationData:   make(map[string][]*BinanceLiquidationData),
	}
}

// Start connects to both Binance Spot and Futures WebSocket streams
func (bs *BinanceStream) Start() error {
	log.Println("Connecting to Enhanced Binance WebSocket streams (Spot + Futures)...")

	// Start Spot stream
	if err := bs.startSpotStream(); err != nil {
		log.Printf("Failed to start Spot stream: %v", err)
	}

	// Start Futures stream
	if err := bs.startFuturesStream(); err != nil {
		log.Printf("Failed to start Futures stream: %v", err)
	}

	bs.isRunning = true
	log.Printf("Connected to Enhanced Binance WebSocket - Streaming %d symbols with Spot + Futures data", len(bs.symbols))

	return nil
}

// startSpotStream connects to Binance Spot WebSocket
func (bs *BinanceStream) startSpotStream() error {
	// Create comprehensive stream names for Spot data
	var streams []string
	for _, symbol := range bs.symbols {
		symbolLower := strings.ToLower(symbol)
		streams = append(streams,
			symbolLower+"@ticker",      // 24hr ticker statistics
			symbolLower+"@depth@100ms", // Order book depth updates (100ms)
			symbolLower+"@trade",       // Individual trade data
			symbolLower+"@kline_1m",    // 1-minute klines
			symbolLower+"@kline_5m",    // 5-minute klines
			symbolLower+"@kline_15m",   // 15-minute klines
		)
	}

	// Use Binance Spot combined stream
	streamNames := strings.Join(streams, "/")
	url := "wss://stream.binance.com:9443/stream?streams=" + streamNames

	log.Printf("Connecting to Spot: %s", url)

	// Connect to Binance Spot WebSocket
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		return err
	}

	bs.spotConn = conn

	// Start reading Spot messages
	go bs.readSpotMessages()

	// Start periodic ping for Spot connection
	go bs.pingSpotPeriodically()

	return nil
}

// startFuturesStream connects to Binance Futures WebSocket
func (bs *BinanceStream) startFuturesStream() error {
	// Create comprehensive stream names for Futures data
	var streams []string
	for _, symbol := range bs.symbols {
		symbolLower := strings.ToLower(symbol)
		streams = append(streams,
			symbolLower+"@ticker",      // 24hr ticker statistics
			symbolLower+"@depth@100ms", // Order book depth updates (100ms)
			symbolLower+"@aggTrade",    // Aggregate trade data
			symbolLower+"@kline_1m",    // 1-minute klines
			symbolLower+"@kline_5m",    // 5-minute klines
			symbolLower+"@kline_15m",   // 15-minute klines
			symbolLower+"@markPrice",   // Mark price updates
		)
	}

	// Add global futures streams
	streams = append(streams,
		"!forceOrder@arr",   // Liquidation orders
		"!markPrice@arr@1s", // All mark prices (1s updates)
	)

	// Use Binance Futures combined stream
	streamNames := strings.Join(streams, "/")
	url := "wss://fstream.binance.com/stream?streams=" + streamNames

	log.Printf("Connecting to Futures: %s", url)

	// Connect to Binance Futures WebSocket
	dialer := websocket.DefaultDialer
	dialer.HandshakeTimeout = 10 * time.Second

	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		return err
	}

	bs.futuresConn = conn

	// Start reading Futures messages
	go bs.readFuturesMessages()

	// Start periodic ping for Futures connection
	go bs.pingFuturesPeriodically()

	return nil
}

// Stop disconnects from both Binance WebSocket streams
func (bs *BinanceStream) Stop() {
	bs.isRunning = false

	if bs.spotConn != nil {
		bs.spotConn.Close()
		log.Println("Binance Spot WebSocket stream stopped")
	}

	if bs.futuresConn != nil {
		bs.futuresConn.Close()
		log.Println("Binance Futures WebSocket stream stopped")
	}
}

// pingSpotPeriodically sends ping messages to keep Spot connection alive
func (bs *BinanceStream) pingSpotPeriodically() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for bs.isRunning {
		select {
		case <-ticker.C:
			if bs.spotConn != nil {
				if err := bs.spotConn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					log.Printf("Failed to send Spot ping: %v", err)
					return
				}
			}
		}
	}
}

// pingFuturesPeriodically sends ping messages to keep Futures connection alive
func (bs *BinanceStream) pingFuturesPeriodically() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for bs.isRunning {
		select {
		case <-ticker.C:
			if bs.futuresConn != nil {
				if err := bs.futuresConn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
					log.Printf("Failed to send Futures ping: %v", err)
					return
				}
			}
		}
	}
}

// readSpotMessages reads and processes messages from Binance Spot WebSocket
func (bs *BinanceStream) readSpotMessages() {
	defer bs.spotConn.Close()

	bs.spotConn.SetPongHandler(func(appData string) error {
		return nil
	})

	for bs.isRunning {
		_, message, err := bs.spotConn.ReadMessage()
		if err != nil {
			if bs.isRunning {
				log.Printf("Error reading from Binance Spot WebSocket: %v", err)
				bs.reconnectSpot()
			}
			return
		}

		bs.processSpotMessage(message)
	}
}

// readFuturesMessages reads and processes messages from Binance Futures WebSocket
func (bs *BinanceStream) readFuturesMessages() {
	defer bs.futuresConn.Close()

	bs.futuresConn.SetPongHandler(func(appData string) error {
		return nil
	})

	for bs.isRunning {
		_, message, err := bs.futuresConn.ReadMessage()
		if err != nil {
			if bs.isRunning {
				log.Printf("Error reading from Binance Futures WebSocket: %v", err)
				bs.reconnectFutures()
			}
			return
		}

		bs.processFuturesMessage(message)
	}
}

// processSpotMessage processes Spot WebSocket messages
func (bs *BinanceStream) processSpotMessage(message []byte) {
	// Parse combined stream message
	var combinedMsg BinanceCombinedStreamMessage
	if err := json.Unmarshal(message, &combinedMsg); err != nil {
		bs.parseDirectMessage(message, StreamTypeSpot)
		return
	}

	bs.processCombinedMessage(combinedMsg, StreamTypeSpot)
}

// processFuturesMessage processes Futures WebSocket messages
func (bs *BinanceStream) processFuturesMessage(message []byte) {
	// Parse combined stream message
	var combinedMsg BinanceCombinedStreamMessage
	if err := json.Unmarshal(message, &combinedMsg); err != nil {
		bs.parseDirectMessage(message, StreamTypeFutures)
		return
	}

	bs.processCombinedMessage(combinedMsg, StreamTypeFutures)
}

// processCombinedMessage processes messages from combined stream
func (bs *BinanceStream) processCombinedMessage(msg BinanceCombinedStreamMessage, streamType StreamType) {
	streamParts := strings.Split(msg.Stream, "@")
	if len(streamParts) < 2 {
		return
	}

	streamName := streamParts[1]

	// Convert data back to JSON for type-specific parsing
	dataBytes, err := json.Marshal(msg.Data)
	if err != nil {
		log.Printf("Error marshaling stream data: %v", err)
		return
	}

	switch {
	case streamName == "ticker":
		if streamType == StreamTypeSpot {
			var tickerData BinanceTickerData
			if err := json.Unmarshal(dataBytes, &tickerData); err == nil {
				bs.processSpotPriceUpdate(tickerData)
			}
		} else {
			var futuresTickerData BinanceFuturesTickerData
			if err := json.Unmarshal(dataBytes, &futuresTickerData); err == nil {
				bs.processFuturesPriceUpdate(futuresTickerData)
			}
		}

	case strings.HasPrefix(streamName, "depth"):
		var depthData BinanceDepthData
		if err := json.Unmarshal(dataBytes, &depthData); err == nil {
			bs.processDepthUpdate(depthData)
		}

	case streamName == "trade" || streamName == "aggTrade":
		var tradeData BinanceTradeData
		if err := json.Unmarshal(dataBytes, &tradeData); err == nil {
			bs.processTradeUpdate(tradeData)
		}

	case strings.HasPrefix(streamName, "kline"):
		var klineData BinanceKlineData
		if err := json.Unmarshal(dataBytes, &klineData); err == nil {
			bs.processKlineUpdate(klineData)
		}

	case streamName == "markPrice":
		var markPriceData BinanceMarkPriceData
		if err := json.Unmarshal(dataBytes, &markPriceData); err == nil {
			bs.processMarkPriceUpdate(markPriceData)
		}

	case msg.Stream == "!forceOrder@arr":
		var liquidationData BinanceLiquidationData
		if err := json.Unmarshal(dataBytes, &liquidationData); err == nil {
			bs.processLiquidationUpdate(liquidationData)
		}

	case msg.Stream == "!markPrice@arr@1s":
		// Handle array of mark prices
		var markPriceArray []BinanceMarkPriceData
		if err := json.Unmarshal(dataBytes, &markPriceArray); err == nil {
			for _, markPrice := range markPriceArray {
				bs.processMarkPriceUpdate(markPrice)
			}
		}
	}
}

// parseDirectMessage handles direct messages (fallback)
func (bs *BinanceStream) parseDirectMessage(message []byte, streamType StreamType) {
	if streamType == StreamTypeSpot {
		// Try parsing as spot ticker data
		var tickerData BinanceTickerData
		if err := json.Unmarshal(message, &tickerData); err == nil && tickerData.EventType == "24hrTicker" {
			bs.processSpotPriceUpdate(tickerData)
			return
		}
	} else {
		// Try parsing as futures ticker data
		var futuresTickerData BinanceFuturesTickerData
		if err := json.Unmarshal(message, &futuresTickerData); err == nil && futuresTickerData.EventType == "24hrTicker" {
			bs.processFuturesPriceUpdate(futuresTickerData)
			return
		}
	}

	// Common parsing for both types
	var depthData BinanceDepthData
	if err := json.Unmarshal(message, &depthData); err == nil && depthData.EventType == "depthUpdate" {
		bs.processDepthUpdate(depthData)
		return
	}

	var tradeData BinanceTradeData
	if err := json.Unmarshal(message, &tradeData); err == nil && (tradeData.EventType == "trade" || tradeData.EventType == "aggTrade") {
		bs.processTradeUpdate(tradeData)
		return
	}

	var klineData BinanceKlineData
	if err := json.Unmarshal(message, &klineData); err == nil && klineData.EventType == "kline" {
		bs.processKlineUpdate(klineData)
		return
	}
}

// processSpotPriceUpdate processes and broadcasts Spot price updates
func (bs *BinanceStream) processSpotPriceUpdate(data BinanceTickerData) {
	bs.processPriceUpdate(data.Symbol, data.LastPrice, data.PriceChange, data.PriceChangePercent, data.TotalTradedVolume, "spot")
}

// processFuturesPriceUpdate processes and broadcasts Futures price updates
func (bs *BinanceStream) processFuturesPriceUpdate(data BinanceFuturesTickerData) {
	// Store futures ticker data
	bs.futuresTickerData[data.Symbol] = &data

	bs.processPriceUpdate(data.Symbol, data.LastPrice, data.PriceChange, data.PriceChangePercent, data.TotalTradedVolume, "futures")
}

// processPriceUpdate processes and broadcasts price updates (unified)
func (bs *BinanceStream) processPriceUpdate(symbol, lastPriceStr, priceChangeStr, priceChangePercentStr, volumeStr, source string) {
	// Parse price values with enhanced error handling
	lastPrice, err := strconv.ParseFloat(lastPriceStr, 64)
	if err != nil {
		log.Printf("Error parsing last price for %s: %v", symbol, err)
		return
	}

	priceChange, err := strconv.ParseFloat(priceChangeStr, 64)
	if err != nil {
		log.Printf("Error parsing price change for %s: %v", symbol, err)
		return
	}

	priceChangePercent, err := strconv.ParseFloat(priceChangePercentStr, 64)
	if err != nil {
		log.Printf("Error parsing price change percent for %s: %v", symbol, err)
		return
	}

	volume, err := strconv.ParseFloat(volumeStr, 64)
	if err != nil {
		log.Printf("Error parsing volume for %s: %v", symbol, err)
		return
	}

	// Enhanced price change detection with smaller threshold for trading
	lastKnownPrice, exists := bs.lastPrices[symbol]
	threshold := 0.01 // Smaller threshold for more sensitive updates
	if exists && lastPrice != 0 && lastKnownPrice != 0 {
		changePercent := ((lastPrice - lastKnownPrice) / lastKnownPrice) * 100
		if changePercent < threshold && changePercent > -threshold {
			return // Skip micro-movements
		}
	}

	// Update last known price
	bs.lastPrices[symbol] = lastPrice

	// Create enhanced price update message
	update := PriceUpdate{
		Type:          "price_update",
		Symbol:        symbol,
		Price:         lastPrice,
		Change:        priceChange,
		ChangePercent: priceChangePercent,
		Volume:        volume,
		Timestamp:     time.Now().UnixMilli(),
	}

	// Broadcast to all subscribed clients
	bs.hub.BroadcastPriceUpdate(update)
}

// processMarkPriceUpdate processes Futures mark price updates
func (bs *BinanceStream) processMarkPriceUpdate(data BinanceMarkPriceData) {
	// Store mark price data
	bs.markPriceData[data.Symbol] = &data

	// Parse mark price
	markPrice, err := strconv.ParseFloat(data.MarkPrice, 64)
	if err != nil {
		return
	}

	fundingRate, err := strconv.ParseFloat(data.FundingRate, 64)
	if err != nil {
		return
	}

	// Create mark price update message
	markPriceUpdate := map[string]interface{}{
		"type":              "mark_price_update",
		"symbol":            data.Symbol,
		"mark_price":        markPrice,
		"funding_rate":      fundingRate,
		"next_funding_time": data.NextFundingTime,
		"timestamp":         time.Now().UnixMilli(),
	}

	// Broadcast mark price update
	bs.hub.BroadcastMarkPriceUpdate(markPriceUpdate)
}

// processLiquidationUpdate processes Futures liquidation updates
func (bs *BinanceStream) processLiquidationUpdate(data BinanceLiquidationData) {
	// Store liquidation data (keep last 1000 per symbol)
	symbol := data.LiquidationOrder.Symbol
	if bs.liquidationData[symbol] == nil {
		bs.liquidationData[symbol] = make([]*BinanceLiquidationData, 0, 1000)
	}

	liquidations := bs.liquidationData[symbol]
	liquidations = append(liquidations, &data)

	// Keep only recent liquidations (last 1000)
	if len(liquidations) > 1000 {
		liquidations = liquidations[len(liquidations)-1000:]
	}
	bs.liquidationData[symbol] = liquidations

	// Parse liquidation data
	price, err := strconv.ParseFloat(data.LiquidationOrder.Price, 64)
	if err != nil {
		return
	}

	quantity, err := strconv.ParseFloat(data.LiquidationOrder.OriginalQuantity, 64)
	if err != nil {
		return
	}

	// Create liquidation update message
	liquidationUpdate := map[string]interface{}{
		"type":       "liquidation_update",
		"symbol":     symbol,
		"side":       data.LiquidationOrder.Side,
		"price":      price,
		"quantity":   quantity,
		"trade_time": data.LiquidationOrder.TradeTime,
		"timestamp":  time.Now().UnixMilli(),
	}

	// Broadcast liquidation update
	bs.hub.BroadcastLiquidationUpdate(liquidationUpdate)
}

// processDepthUpdate processes order book depth updates for volume profile
func (bs *BinanceStream) processDepthUpdate(data BinanceDepthData) {
	// Store depth data for volume profile calculations
	bs.depthData[data.Symbol] = &data

	// Create depth update message for clients
	depthUpdate := map[string]interface{}{
		"type":      "depth_update",
		"symbol":    data.Symbol,
		"bids":      data.Bids,
		"asks":      data.Asks,
		"timestamp": time.Now().UnixMilli(),
	}

	// Broadcast depth update
	bs.hub.BroadcastDepthUpdate(depthUpdate)
}

// processTradeUpdate processes individual trade data for volume profile
func (bs *BinanceStream) processTradeUpdate(data BinanceTradeData) {
	// Store recent trades (keep last 1000 trades per symbol)
	if bs.tradeData[data.Symbol] == nil {
		bs.tradeData[data.Symbol] = make([]*BinanceTradeData, 0, 1000)
	}

	trades := bs.tradeData[data.Symbol]
	trades = append(trades, &data)

	// Keep only recent trades (last 1000)
	if len(trades) > 1000 {
		trades = trades[len(trades)-1000:]
	}
	bs.tradeData[data.Symbol] = trades

	// Parse trade data
	price, err := strconv.ParseFloat(data.Price, 64)
	if err != nil {
		return
	}

	quantity, err := strconv.ParseFloat(data.Quantity, 64)
	if err != nil {
		return
	}

	// Create trade update message
	tradeUpdate := map[string]interface{}{
		"type":           "trade_update",
		"symbol":         data.Symbol,
		"price":          price,
		"quantity":       quantity,
		"is_buyer_maker": data.IsBuyerMaker,
		"trade_time":     data.TradeTime,
		"timestamp":      time.Now().UnixMilli(),
	}

	// Broadcast trade update
	bs.hub.BroadcastTradeUpdate(tradeUpdate)
}

// processKlineUpdate processes kline/candlestick data for real-time charts
func (bs *BinanceStream) processKlineUpdate(data BinanceKlineData) {
	// Store kline data
	bs.klineData[data.Symbol+"_"+data.Kline.Interval] = &data

	// Parse kline data
	open, _ := strconv.ParseFloat(data.Kline.Open, 64)
	high, _ := strconv.ParseFloat(data.Kline.High, 64)
	low, _ := strconv.ParseFloat(data.Kline.Low, 64)
	close, _ := strconv.ParseFloat(data.Kline.Close, 64)
	volume, _ := strconv.ParseFloat(data.Kline.Volume, 64)

	// Create kline update message
	klineUpdate := map[string]interface{}{
		"type":       "kline_update",
		"symbol":     data.Symbol,
		"interval":   data.Kline.Interval,
		"open":       open,
		"high":       high,
		"low":        low,
		"close":      close,
		"volume":     volume,
		"is_closed":  data.Kline.IsClosed,
		"start_time": data.Kline.StartTime,
		"end_time":   data.Kline.EndTime,
		"timestamp":  time.Now().UnixMilli(),
	}

	// Broadcast kline update
	bs.hub.BroadcastKlineUpdate(klineUpdate)
}

// reconnectSpot attempts to reconnect to Binance Spot WebSocket
func (bs *BinanceStream) reconnectSpot() {
	log.Println("Attempting to reconnect to Binance Spot WebSocket...")
	time.Sleep(5 * time.Second)
	if bs.isRunning {
		if err := bs.startSpotStream(); err != nil {
			log.Printf("Spot reconnection failed: %v", err)
			time.Sleep(10 * time.Second)
			bs.reconnectSpot()
		} else {
			log.Println("Successfully reconnected to Binance Spot WebSocket")
		}
	}
}

// reconnectFutures attempts to reconnect to Binance Futures WebSocket
func (bs *BinanceStream) reconnectFutures() {
	log.Println("Attempting to reconnect to Binance Futures WebSocket...")
	time.Sleep(5 * time.Second)
	if bs.isRunning {
		if err := bs.startFuturesStream(); err != nil {
			log.Printf("Futures reconnection failed: %v", err)
			time.Sleep(10 * time.Second)
			bs.reconnectFutures()
		} else {
			log.Println("Successfully reconnected to Binance Futures WebSocket")
		}
	}
}

// AddSymbol adds a new symbol to both streams
func (bs *BinanceStream) AddSymbol(symbol string) {
	// Check if symbol already exists
	for _, existing := range bs.symbols {
		if existing == symbol {
			return
		}
	}

	bs.symbols = append(bs.symbols, symbol)
	log.Printf("Added symbol %s to Enhanced Binance streams (Spot + Futures)", symbol)

	// Initialize data structures for new symbol
	bs.depthData[symbol] = nil
	bs.tradeData[symbol] = make([]*BinanceTradeData, 0, 1000)
	bs.klineData[symbol+"_1m"] = nil
	bs.klineData[symbol+"_5m"] = nil
	bs.klineData[symbol+"_15m"] = nil
	bs.futuresTickerData[symbol] = nil
	bs.markPriceData[symbol] = nil
	bs.liquidationData[symbol] = make([]*BinanceLiquidationData, 0, 1000)

	// Restart streams with new symbols for full data coverage
	if bs.isRunning {
		bs.Stop()
		time.Sleep(2 * time.Second)
		bs.Start()
	}
}

// GetConnectedSymbols returns list of symbols being streamed
func (bs *BinanceStream) GetConnectedSymbols() []string {
	return bs.symbols
}

// GetLastPrice returns the last known price for a symbol
func (bs *BinanceStream) GetLastPrice(symbol string) (float64, bool) {
	price, exists := bs.lastPrices[symbol]
	return price, exists
}

// GetDepthData returns the latest depth data for a symbol
func (bs *BinanceStream) GetDepthData(symbol string) (*BinanceDepthData, bool) {
	depth, exists := bs.depthData[symbol]
	return depth, exists
}

// GetRecentTrades returns recent trades for a symbol
func (bs *BinanceStream) GetRecentTrades(symbol string, limit int) []*BinanceTradeData {
	trades, exists := bs.tradeData[symbol]
	if !exists {
		return nil
	}

	if limit <= 0 || limit > len(trades) {
		return trades
	}

	return trades[len(trades)-limit:]
}

// GetKlineData returns the latest kline data for a symbol and interval
func (bs *BinanceStream) GetKlineData(symbol, interval string) (*BinanceKlineData, bool) {
	kline, exists := bs.klineData[symbol+"_"+interval]
	return kline, exists
}

// GetMarkPriceData returns the latest mark price data for a symbol
func (bs *BinanceStream) GetMarkPriceData(symbol string) (*BinanceMarkPriceData, bool) {
	markPrice, exists := bs.markPriceData[symbol]
	return markPrice, exists
}

// GetRecentLiquidations returns recent liquidations for a symbol
func (bs *BinanceStream) GetRecentLiquidations(symbol string, limit int) []*BinanceLiquidationData {
	liquidations, exists := bs.liquidationData[symbol]
	if !exists {
		return nil
	}

	if limit <= 0 || limit > len(liquidations) {
		return liquidations
	}

	return liquidations[len(liquidations)-limit:]
}

// GetStreamStats returns comprehensive statistics about both streams
func (bs *BinanceStream) GetStreamStats() map[string]interface{} {
	stats := map[string]interface{}{
		"connected_symbols":    len(bs.symbols),
		"symbols":              bs.symbols,
		"price_data_count":     len(bs.lastPrices),
		"depth_data_count":     len(bs.depthData),
		"kline_data_count":     len(bs.klineData),
		"futures_ticker_count": len(bs.futuresTickerData),
		"mark_price_count":     len(bs.markPriceData),
		"funding_rate_count":   len(bs.fundingRateData),
		"is_running":           bs.isRunning,
		"spot_connected":       bs.spotConn != nil,
		"futures_connected":    bs.futuresConn != nil,
		"stream_types": []string{
			"spot_ticker", "futures_ticker", "depth@100ms", "trade", "aggTrade",
			"kline_1m", "kline_5m", "kline_15m", "markPrice", "liquidations",
		},
	}

	// Add trade counts per symbol
	tradeCounts := make(map[string]int)
	for symbol, trades := range bs.tradeData {
		tradeCounts[symbol] = len(trades)
	}
	stats["trade_counts"] = tradeCounts

	// Add liquidation counts per symbol
	liquidationCounts := make(map[string]int)
	for symbol, liquidations := range bs.liquidationData {
		liquidationCounts[symbol] = len(liquidations)
	}
	stats["liquidation_counts"] = liquidationCounts

	return stats
}
