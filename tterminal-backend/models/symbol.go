package models

import (
	"database/sql"
	"time"
)

// Symbol represents a cryptocurrency trading symbol
type Symbol struct {
	ID                int64          `json:"id" db:"id"`
	Symbol            string         `json:"symbol" db:"symbol"`
	BaseAsset         string         `json:"base_asset" db:"base_asset"`
	QuoteAsset        string         `json:"quote_asset" db:"quote_asset"`
	Status            string         `json:"status" db:"status"`
	IsActive          bool           `json:"is_active" db:"is_active"`
	PricePrecision    int            `json:"price_precision" db:"price_precision"`
	QuantityPrecision int            `json:"quantity_precision" db:"quantity_precision"`
	MinPrice          sql.NullString `json:"min_price" db:"min_price"`
	MaxPrice          sql.NullString `json:"max_price" db:"max_price"`
	MinQty            sql.NullString `json:"min_qty" db:"min_qty"`
	MaxQty            sql.NullString `json:"max_qty" db:"max_qty"`
	StepSize          sql.NullString `json:"step_size" db:"step_size"`
	TickSize          sql.NullString `json:"tick_size" db:"tick_size"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at" db:"updated_at"`
}

// CreateSymbolRequest represents the request structure for creating symbols
type CreateSymbolRequest struct {
	Symbol     string `json:"symbol" binding:"required"`
	BaseAsset  string `json:"base_asset" binding:"required"`
	QuoteAsset string `json:"quote_asset" binding:"required"`
	Status     string `json:"status" binding:"required"`
}

// UpdateSymbolRequest represents the request structure for updating symbols
type UpdateSymbolRequest struct {
	Status   string `json:"status"`
	IsActive *bool  `json:"is_active"`
}

// SymbolResponse represents the response structure for symbol data
type SymbolResponse struct {
	Symbol  string   `json:"symbol"`
	Count   int      `json:"count"`
	Symbols []Symbol `json:"symbols"`
}
