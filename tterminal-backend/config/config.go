package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the application
type Config struct {
	// Database
	DatabaseURL string

	// Server
	Port    string
	GinMode string

	// CORS
	CorsOrigins []string

	// Binance API
	BinanceAPIKey    string
	BinanceSecretKey string
	BinanceBaseURL   string
	BinanceWSURL     string

	// Rate Limiting
	RateLimitRPS   int
	RateLimitBurst int

	// Logging
	LogLevel string
}

// Load initializes and returns the configuration
func Load() *Config {
	return &Config{
		DatabaseURL:      getEnv("TIMESCALE_DB_URL", "postgres://postgres:password@localhost:5432/tterminal?sslmode=disable"),
		Port:             getEnv("PORT", "8080"),
		GinMode:          getEnv("GIN_MODE", "debug"),
		BinanceAPIKey:    getEnv("BINANCE_API_KEY", ""),
		BinanceSecretKey: getEnv("BINANCE_SECRET_KEY", ""),
		BinanceBaseURL:   getEnv("BINANCE_BASE_URL", "https://fapi.binance.com"),
		BinanceWSURL:     getEnv("BINANCE_WS_URL", "wss://fstream.binance.com"),
		RateLimitRPS:     getEnvAsInt("RATE_LIMIT_REQUESTS_PER_SECOND", 10),
		RateLimitBurst:   getEnvAsInt("RATE_LIMIT_BURST", 20),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
	}
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt gets an environment variable as integer with a default value
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
