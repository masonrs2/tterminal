package services

import (
	"context"
	"database/sql"
	"fmt"
	"tterminal-backend/models"
	"tterminal-backend/repositories"
)

// SymbolService handles business logic for symbols
type SymbolService struct {
	symbolRepo *repositories.SymbolRepository
}

// NewSymbolService creates a new symbol service
func NewSymbolService(symbolRepo *repositories.SymbolRepository) *SymbolService {
	return &SymbolService{
		symbolRepo: symbolRepo,
	}
}

// CreateSymbol creates a new symbol
func (s *SymbolService) CreateSymbol(ctx context.Context, req *models.CreateSymbolRequest) (*models.Symbol, error) {
	// Validate request
	if err := s.validateCreateSymbolRequest(req); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	symbol := &models.Symbol{
		Symbol:            req.Symbol,
		BaseAsset:         req.BaseAsset,
		QuoteAsset:        req.QuoteAsset,
		Status:            req.Status,
		IsActive:          true, // Default to active
		PricePrecision:    8,    // Default precision
		QuantityPrecision: 8,    // Default precision
		MinPrice:          sql.NullString{String: "0.00000001", Valid: true},
		MaxPrice:          sql.NullString{String: "1000000", Valid: true},
		MinQty:            sql.NullString{String: "0.00000001", Valid: true},
		MaxQty:            sql.NullString{String: "9000000", Valid: true},
		StepSize:          sql.NullString{String: "0.00000001", Valid: true},
		TickSize:          sql.NullString{String: "0.00000001", Valid: true},
	}

	err := s.symbolRepo.Create(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to create symbol: %w", err)
	}

	return symbol, nil
}

// GetSymbol retrieves a symbol by name
func (s *SymbolService) GetSymbol(ctx context.Context, symbolName string) (*models.Symbol, error) {
	if symbolName == "" {
		return nil, fmt.Errorf("symbol name is required")
	}

	symbol, err := s.symbolRepo.GetBySymbol(ctx, symbolName)
	if err != nil {
		return nil, fmt.Errorf("failed to get symbol: %w", err)
	}

	if symbol == nil {
		return nil, fmt.Errorf("symbol not found")
	}

	return symbol, nil
}

// GetAllSymbols retrieves all symbols
func (s *SymbolService) GetAllSymbols(ctx context.Context) ([]models.Symbol, error) {
	symbols, err := s.symbolRepo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get symbols: %w", err)
	}

	return symbols, nil
}

// GetActiveSymbols retrieves all active symbols
func (s *SymbolService) GetActiveSymbols(ctx context.Context) ([]models.Symbol, error) {
	symbols, err := s.symbolRepo.GetActiveSymbols(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get active symbols: %w", err)
	}

	return symbols, nil
}

// UpdateSymbol updates a symbol
func (s *SymbolService) UpdateSymbol(ctx context.Context, symbolName string, req *models.UpdateSymbolRequest) error {
	if symbolName == "" {
		return fmt.Errorf("symbol name is required")
	}

	// Check if symbol exists
	existingSymbol, err := s.symbolRepo.GetBySymbol(ctx, symbolName)
	if err != nil {
		return fmt.Errorf("failed to check symbol existence: %w", err)
	}
	if existingSymbol == nil {
		return fmt.Errorf("symbol not found")
	}

	// Build update map
	updates := make(map[string]interface{})
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}

	err = s.symbolRepo.Update(ctx, symbolName, updates)
	if err != nil {
		return fmt.Errorf("failed to update symbol: %w", err)
	}

	return nil
}

// DeleteSymbol deletes a symbol
func (s *SymbolService) DeleteSymbol(ctx context.Context, symbolName string) error {
	if symbolName == "" {
		return fmt.Errorf("symbol name is required")
	}

	err := s.symbolRepo.Delete(ctx, symbolName)
	if err != nil {
		return fmt.Errorf("failed to delete symbol: %w", err)
	}

	return nil
}

// validateCreateSymbolRequest validates the create symbol request
func (s *SymbolService) validateCreateSymbolRequest(req *models.CreateSymbolRequest) error {
	if req.Symbol == "" {
		return fmt.Errorf("symbol is required")
	}
	if req.BaseAsset == "" {
		return fmt.Errorf("base asset is required")
	}
	if req.QuoteAsset == "" {
		return fmt.Errorf("quote asset is required")
	}
	if req.Status == "" {
		return fmt.Errorf("status is required")
	}

	// Validate status values
	validStatuses := map[string]bool{
		"TRADING": true,
		"HALT":    true,
		"BREAK":   true,
	}
	if !validStatuses[req.Status] {
		return fmt.Errorf("invalid status: %s", req.Status)
	}

	return nil
}
