package websocket

import (
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// BinanceStream handles real-time data from Binance WebSocket
type BinanceStream struct {
	hub        *Hub
	conn       *websocket.Conn
	symbols    []string
	isRunning  bool
	lastPrices map[string]float64
}

// BinanceTickerData represents Binance 24hr ticker data
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

// NewBinanceStream creates a new Binance WebSocket stream
func NewBinanceStream(hub *Hub, symbols []string) *BinanceStream {
	return &BinanceStream{
		hub:        hub,
		symbols:    symbols,
		lastPrices: make(map[string]float64),
	}
}

// Start connects to Binance WebSocket and begins streaming
func (bs *BinanceStream) Start() error {
	log.Println("🔗 Connecting to Binance WebSocket stream...")

	// Create stream names (lowercase symbols with @ticker suffix)
	var streams []string
	for _, symbol := range bs.symbols {
		streams = append(streams, strings.ToLower(symbol)+"@ticker")
	}
	streamNames := strings.Join(streams, "/")

	// Binance combined stream URL
	url := "wss://stream.binance.com:9443/ws/" + streamNames

	// Connect to Binance WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Printf("❌ Failed to connect to Binance WebSocket: %v", err)
		return err
	}

	bs.conn = conn
	bs.isRunning = true

	log.Printf("✅ Connected to Binance WebSocket - Streaming %d symbols", len(bs.symbols))

	// Start reading messages
	go bs.readMessages()

	return nil
}

// Stop disconnects from Binance WebSocket
func (bs *BinanceStream) Stop() {
	if bs.conn != nil {
		bs.isRunning = false
		bs.conn.Close()
		log.Println("📴 Binance WebSocket stream stopped")
	}
}

// readMessages reads and processes messages from Binance WebSocket
func (bs *BinanceStream) readMessages() {
	defer bs.conn.Close()

	for bs.isRunning {
		_, message, err := bs.conn.ReadMessage()
		if err != nil {
			if bs.isRunning {
				log.Printf("❌ Error reading from Binance WebSocket: %v", err)
				// Attempt reconnection
				bs.reconnect()
			}
			return
		}

		// Parse Binance ticker data
		var tickerData BinanceTickerData
		if err := json.Unmarshal(message, &tickerData); err != nil {
			log.Printf("❌ Error parsing Binance message: %v", err)
			continue
		}

		// Process price update
		bs.processPriceUpdate(tickerData)
	}
}

// processPriceUpdate processes and broadcasts price updates
func (bs *BinanceStream) processPriceUpdate(data BinanceTickerData) {
	// Parse price values
	lastPrice, err := strconv.ParseFloat(data.LastPrice, 64)
	if err != nil {
		log.Printf("❌ Error parsing last price for %s: %v", data.Symbol, err)
		return
	}

	priceChange, err := strconv.ParseFloat(data.PriceChange, 64)
	if err != nil {
		log.Printf("❌ Error parsing price change for %s: %v", data.Symbol, err)
		return
	}

	priceChangePercent, err := strconv.ParseFloat(data.PriceChangePercent, 64)
	if err != nil {
		log.Printf("❌ Error parsing price change percent for %s: %v", data.Symbol, err)
		return
	}

	volume, err := strconv.ParseFloat(data.TotalTradedVolume, 64)
	if err != nil {
		log.Printf("❌ Error parsing volume for %s: %v", data.Symbol, err)
		return
	}

	// Check if price has changed significantly (optimization)
	lastKnownPrice, exists := bs.lastPrices[data.Symbol]
	if exists && lastPrice == lastKnownPrice {
		return // No significant change, skip update
	}

	// Update last known price
	bs.lastPrices[data.Symbol] = lastPrice

	// Create price update message
	update := PriceUpdate{
		Type:          "price_update",
		Symbol:        data.Symbol,
		Price:         lastPrice,
		Change:        priceChange,
		ChangePercent: priceChangePercent,
		Volume:        volume,
		Timestamp:     time.Now().UnixMilli(),
	}

	// Broadcast to all subscribed clients
	bs.hub.BroadcastPriceUpdate(update)
}

// reconnect attempts to reconnect to Binance WebSocket
func (bs *BinanceStream) reconnect() {
	log.Println("🔄 Attempting to reconnect to Binance WebSocket...")

	// Wait before reconnecting
	time.Sleep(5 * time.Second)

	if bs.isRunning {
		if err := bs.Start(); err != nil {
			log.Printf("❌ Reconnection failed: %v", err)
			// Try again after delay
			time.Sleep(10 * time.Second)
			bs.reconnect()
		} else {
			log.Println("✅ Successfully reconnected to Binance WebSocket")
		}
	}
}

// AddSymbol adds a new symbol to the stream (requires reconnection)
func (bs *BinanceStream) AddSymbol(symbol string) {
	// Check if symbol already exists
	for _, existing := range bs.symbols {
		if existing == symbol {
			return
		}
	}

	bs.symbols = append(bs.symbols, symbol)
	log.Printf("📈 Added symbol %s to Binance stream", symbol)

	// Restart stream with new symbols
	if bs.isRunning {
		bs.Stop()
		time.Sleep(1 * time.Second)
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
