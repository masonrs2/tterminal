package routes

import (
	"tterminal-backend/config"
	"tterminal-backend/controllers"
	"tterminal-backend/internal/database"
	"tterminal-backend/internal/middleware"
	"tterminal-backend/repositories"
	"tterminal-backend/services"

	"github.com/labstack/echo/v4"
)

// SetupRoutes configures all application routes
func SetupRoutes(e *echo.Echo, db *database.DB, cfg *config.Config) {
	// Initialize repositories
	candleRepo := repositories.NewCandleRepository(db)
	symbolRepo := repositories.NewSymbolRepository(db)

	// Initialize services
	candleService := services.NewCandleService(candleRepo)
	symbolService := services.NewSymbolService(symbolRepo)
	binanceService := services.NewBinanceService(cfg)

	// Initialize controllers
	candleController := controllers.NewCandleController(candleService, binanceService)
	symbolController := controllers.NewSymbolController(symbolService)
	healthController := controllers.NewHealthController(db)

	// Setup middleware
	e.Use(middleware.CORS(cfg))
	e.Use(middleware.RateLimit(cfg))

	// API v1 routes
	v1 := e.Group("/api/v1")

	// Health check
	v1.GET("/health", healthController.HealthCheck)

	// Symbol routes
	symbols := v1.Group("/symbols")
	symbols.GET("", symbolController.GetSymbols)
	symbols.GET("/:symbol", symbolController.GetSymbol)
	symbols.POST("", symbolController.CreateSymbol)
	symbols.PUT("/:symbol", symbolController.UpdateSymbol)
	symbols.DELETE("/:symbol", symbolController.DeleteSymbol)

	// Candle routes
	candles := v1.Group("/candles")
	candles.GET("/:symbol", candleController.GetCandles)
	candles.POST("/fetch", candleController.FetchAndStoreCandles)
	candles.GET("/:symbol/latest", candleController.GetLatestCandle)
	candles.GET("/:symbol/range", candleController.GetCandleRange)

	// WebSocket routes for real-time data
	ws := v1.Group("/ws")
	ws.GET("/candles/:symbol", candleController.StreamCandles)
}
