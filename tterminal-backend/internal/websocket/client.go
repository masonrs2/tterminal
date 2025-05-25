package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

// ClientMessage represents incoming message from client
type ClientMessage struct {
	Type   string      `json:"type"`
	Symbol string      `json:"symbol,omitempty"`
	Data   interface{} `json:"data,omitempty"`
}

// HandleWebSocket handles WebSocket connection upgrade and client management
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Create new client
	client := &Client{
		conn:    conn,
		send:    make(chan []byte, 256),
		id:      uuid.New().String()[:8], // Short ID for logging
		symbols: make(map[string]bool),
		hub:     h,
	}

	// Register client with hub
	h.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	// Configure connection
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// Read messages from client
	for {
		_, messageBytes, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", c.id, err)
			}
			break
		}

		// Parse client message
		var message ClientMessage
		if err := json.Unmarshal(messageBytes, &message); err != nil {
			log.Printf("Invalid message from client %s: %v", c.id, err)
			continue
		}

		// Handle different message types
		c.handleMessage(message)
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to current message (batch sending for performance)
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming messages from client
func (c *Client) handleMessage(message ClientMessage) {
	switch message.Type {
	case "subscribe":
		if message.Symbol != "" {
			c.hub.SubscribeSymbol(c, message.Symbol)
			// Send confirmation
			response := map[string]interface{}{
				"type":      "subscribed",
				"symbol":    message.Symbol,
				"message":   "Successfully subscribed to " + message.Symbol,
				"timestamp": time.Now().UnixMilli(),
			}
			c.sendMessage(response)
		}

	case "unsubscribe":
		if message.Symbol != "" {
			c.hub.UnsubscribeSymbol(c, message.Symbol)
			// Send confirmation
			response := map[string]interface{}{
				"type":      "unsubscribed",
				"symbol":    message.Symbol,
				"message":   "Successfully unsubscribed from " + message.Symbol,
				"timestamp": time.Now().UnixMilli(),
			}
			c.sendMessage(response)
		}

	case "ping":
		// Respond to ping with pong
		response := map[string]interface{}{
			"type":      "pong",
			"timestamp": time.Now().UnixMilli(),
		}
		c.sendMessage(response)

	case "getStats":
		// Send connection statistics
		response := map[string]interface{}{
			"type":          "stats",
			"clientCount":   c.hub.GetConnectedClients(),
			"subscriptions": c.hub.GetSubscriptionStats(),
			"yourSymbols":   c.getSymbolList(),
			"timestamp":     time.Now().UnixMilli(),
		}
		c.sendMessage(response)

	default:
		log.Printf("Unknown message type from client %s: %s", c.id, message.Type)
	}
}

// sendMessage sends a message to this specific client
func (c *Client) sendMessage(data interface{}) {
	message, err := json.Marshal(data)
	if err != nil {
		log.Printf("Error marshaling message for client %s: %v", c.id, err)
		return
	}

	select {
	case c.send <- message:
	default:
		// Channel is full, client is likely disconnected
		close(c.send)
	}
}

// getSymbolList returns list of symbols this client is subscribed to
func (c *Client) getSymbolList() []string {
	symbols := make([]string, 0, len(c.symbols))
	for symbol := range c.symbols {
		symbols = append(symbols, symbol)
	}
	return symbols
}
