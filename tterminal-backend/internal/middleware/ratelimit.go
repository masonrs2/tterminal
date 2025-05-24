package middleware

import (
	"net/http"
	"tterminal-backend/config"

	"github.com/labstack/echo/v4"
	"golang.org/x/time/rate"
)

// RateLimit applies rate limiting to requests using Echo
func RateLimit(cfg *config.Config) echo.MiddlewareFunc {
	limiter := rate.NewLimiter(rate.Limit(cfg.RateLimitRPS), cfg.RateLimitBurst)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !limiter.Allow() {
				return c.JSON(http.StatusTooManyRequests, map[string]string{
					"error":   "Rate limit exceeded",
					"message": "Too many requests, please try again later",
				})
			}
			return next(c)
		}
	}
}
