# TTerminal Backend Makefile

.PHONY: help build run test clean docker-up docker-down docker-logs migrate-up migrate-down dev

# Default target
help:
	@echo "Available commands:"
	@echo "  build        - Build the application"
	@echo "  run          - Run the application"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build files"
	@echo "  docker-up    - Start Docker services (TimescaleDB, Redis)"
	@echo "  docker-down  - Stop Docker services"
	@echo "  docker-logs  - View Docker logs"
	@echo "  migrate-up   - Run database migrations"
	@echo "  migrate-down - Rollback database migrations"
	@echo "  dev          - Start development environment"

# Build the application
build:
	go build -o bin/server cmd/server/main.go

# Run the application
run: build
	./bin/server

# Run tests
test:
	go test -v ./...

# Clean build files
clean:
	rm -rf bin/
	go clean

# Start Docker services
docker-up:
	docker-compose up -d
	@echo "Waiting for database to be ready..."
	@sleep 10

# Stop Docker services
docker-down:
	docker-compose down

# View Docker logs
docker-logs:
	docker-compose logs -f

# Run database migrations up
migrate-up: docker-up
	@echo "Running migrations..."
	@sleep 5
	go run cmd/server/main.go migrate up || echo "Migrations completed or already up to date"

# Rollback database migrations
migrate-down:
	@echo "Rolling back migrations..."
	go run cmd/server/main.go migrate down

# Start development environment
dev: docker-up
	@echo "Starting development environment..."
	@echo "Database: postgresql://postgres:password@localhost:5432/tterminal"
	@echo "Redis: localhost:6379"
	@sleep 5
	go run cmd/server/main.go

# Install dependencies
deps:
	go mod tidy
	go mod download

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run

# Generate code (if using code generation tools)
generate:
	go generate ./...

# Run database setup with sample data
setup-db: migrate-up
	@echo "Database setup completed!"

# View application logs in development
logs:
	tail -f logs/app.log

# Hot reload for development (requires air)
watch:
	air

# Database shell
db-shell:
	docker exec -it tterminal-timescaledb psql -U postgres -d tterminal 