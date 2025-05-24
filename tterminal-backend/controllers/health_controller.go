package controllers

import (
	"net/http"
	"tterminal-backend/internal/database"

	"github.com/labstack/echo/v4"
)

// HealthController handles health check endpoints
type HealthController struct {
	db *database.DB
}

// NewHealthController creates a new health controller
func NewHealthController(db *database.DB) *HealthController {
	return &HealthController{
		db: db,
	}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Message  string `json:"message,omitempty"`
}

// HealthCheck performs a health check of the application
func (h *HealthController) HealthCheck(c echo.Context) error {
	response := HealthResponse{
		Status: "healthy",
	}

	// Check database connection
	ctx := c.Request().Context()
	if err := h.db.Health(ctx); err != nil {
		response.Status = "unhealthy"
		response.Database = "unhealthy"
		response.Message = "Database connection failed: " + err.Error()
		return c.JSON(http.StatusServiceUnavailable, response)
	}

	response.Database = "healthy"
	return c.JSON(http.StatusOK, response)
}
