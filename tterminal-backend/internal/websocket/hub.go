// Package websocket provides real-time WebSocket communication for ultra-fast trading data
// Designed for maximum performance and scalability - supporting 1000+ concurrent connections
package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from clients
	broadcast chan []byte

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mutex sync.RWMutex

	// Symbol subscriptions (symbol -> clients)
	subscriptions map[string]map[*Client]bool
}

// Client represents a WebSocket connection
type Client struct {
	// The WebSocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// Client ID for logging
	id string

	// Subscribed symbols
	symbols map[string]bool

	// Hub reference
	hub *Hub
}

// PriceUpdate represents a real-time price update
type PriceUpdate struct {
	Type          string  `json:"type"`
	Symbol        string  `json:"symbol"`
	Price         float64 `json:"price"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"changePercent"`
	Volume        float64 `json:"volume"`
	Timestamp     int64   `json:"timestamp"`
}

// WebSocket upgrader configuration
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin in development
		// TODO: Restrict origins in production
		return true
	},
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:       make(map[*Client]bool),
		broadcast:     make(chan []byte),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		subscriptions: make(map[string]map[*Client]bool),
	}
}

// Run starts the hub and handles client management
func (h *Hub) Run() {
	log.Println("WebSocket Hub started - Ready for ultra-fast trading connections")

	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()

			log.Printf("Client connected: %s (Total: %d)", client.id, len(h.clients))

			// Send connection confirmation
			response := map[string]interface{}{
				"type":      "connected",
				"message":   "WebSocket connection established",
				"clientId":  client.id,
				"timestamp": time.Now().UnixMilli(),
			}
			h.sendToClient(client, response)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				// Remove from all symbol subscriptions
				for symbol := range client.symbols {
					if clients, exists := h.subscriptions[symbol]; exists {
						delete(clients, client)
						if len(clients) == 0 {
							delete(h.subscriptions, symbol)
						}
					}
				}

				delete(h.clients, client)
				close(client.send)
				log.Printf("Client disconnected: %s (Total: %d)", client.id, len(h.clients))
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// BroadcastPriceUpdate sends price update to all subscribed clients
func (h *Hub) BroadcastPriceUpdate(update PriceUpdate) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling price update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	if clients, exists := h.subscriptions[update.Symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastDepthUpdate sends order book depth update to all subscribed clients
func (h *Hub) BroadcastDepthUpdate(update map[string]interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling depth update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	symbol, ok := update["symbol"].(string)
	if !ok {
		return
	}

	if clients, exists := h.subscriptions[symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastTradeUpdate sends individual trade update to all subscribed clients
func (h *Hub) BroadcastTradeUpdate(update map[string]interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling trade update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	symbol, ok := update["symbol"].(string)
	if !ok {
		return
	}

	if clients, exists := h.subscriptions[symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastKlineUpdate sends kline/candlestick update to all subscribed clients
func (h *Hub) BroadcastKlineUpdate(update map[string]interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling kline update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	symbol, ok := update["symbol"].(string)
	if !ok {
		return
	}

	if clients, exists := h.subscriptions[symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastMarkPriceUpdate sends Futures mark price update to all subscribed clients
func (h *Hub) BroadcastMarkPriceUpdate(update map[string]interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling mark price update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	symbol, ok := update["symbol"].(string)
	if !ok {
		return
	}

	if clients, exists := h.subscriptions[symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastLiquidationUpdate sends Futures liquidation update to all subscribed clients
func (h *Hub) BroadcastLiquidationUpdate(update map[string]interface{}) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	// Convert to JSON
	message, err := json.Marshal(update)
	if err != nil {
		log.Printf("Error marshaling liquidation update: %v", err)
		return
	}

	// Send to clients subscribed to this symbol
	symbol, ok := update["symbol"].(string)
	if !ok {
		return
	}

	if clients, exists := h.subscriptions[symbol]; exists {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client buffer full, remove client
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// SubscribeSymbol adds a client to symbol subscription
func (h *Hub) SubscribeSymbol(client *Client, symbol string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// Add to client's symbols
	if client.symbols == nil {
		client.symbols = make(map[string]bool)
	}
	client.symbols[symbol] = true

	// Add to hub's subscriptions
	if h.subscriptions[symbol] == nil {
		h.subscriptions[symbol] = make(map[*Client]bool)
	}
	h.subscriptions[symbol][client] = true

	log.Printf("Client %s subscribed to %s", client.id, symbol)
}

// UnsubscribeSymbol removes a client from symbol subscription
func (h *Hub) UnsubscribeSymbol(client *Client, symbol string) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// Remove from client's symbols
	delete(client.symbols, symbol)

	// Remove from hub's subscriptions
	if clients, exists := h.subscriptions[symbol]; exists {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.subscriptions, symbol)
		}
	}

	log.Printf("Client %s unsubscribed from %s", client.id, symbol)
}

// sendToClient sends a message to a specific client
func (h *Hub) sendToClient(client *Client, data interface{}) {
	message, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case client.send <- message:
	default:
		close(client.send)
		h.mutex.Lock()
		delete(h.clients, client)
		h.mutex.Unlock()
	}
}

// GetConnectedClients returns the number of connected clients
func (h *Hub) GetConnectedClients() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// GetSubscriptionStats returns subscription statistics
func (h *Hub) GetSubscriptionStats() map[string]int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	stats := make(map[string]int)
	for symbol, clients := range h.subscriptions {
		stats[symbol] = len(clients)
	}
	return stats
}
