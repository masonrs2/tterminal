## 🚀 How to Run the Application

### Method 1: Quick Start (Recommended)

```bash
# 1. Clone the repository
git clone <repository-url>
cd tterminal-backend

# 2. Install Go dependencies
go mod tidy

# 3. Set up environment variables
cp env.example .env

# 4. Start everything with one command
make dev
```

This will:
- Start TimescaleDB and Redis containers
- Run database migrations
- Start the backend server on port 8080

### Method 2: Manual Step-by-Step

```bash
# 1. Clone and navigate
git clone <repository-url>
cd tterminal-backend

# 2. Install dependencies
go mod tidy

# 3. Configure environment
cp env.example .env
# Edit .env file with your settings (optional for development)

# 4. Start Docker services
make docker-up
# OR: docker-compose up -d

# 5. Wait for database to be ready (important!)
sleep 10

# 6. Run database migrations
go run cmd/server/main.go migrate up
# OR: make migrate-up

# 7. Start the backend server
go run cmd/server/main.go
# OR: make run
```

## ✅ Verify Installation

After starting the application, test these endpoints:

```bash
# 1. Health check - Should return {"status":"healthy","database":"healthy"}
curl http://localhost:8080/api/v1/health

# 2. Get symbols - Should return {"count":0,"symbols":null} initially
curl http://localhost:8080/api/v1/symbols

# 3. Test candle endpoints (returns empty data initially)
curl http://localhost:8080/api/v1/candles/BTCUSDT
curl "http://localhost:8080/api/v1/candles/ETHUSDT?interval=4h&limit=50"

# 4. Test WebSocket placeholder
curl http://localhost:8080/api/v1/ws/candles/BTCUSDT

# 5. Check if database is accessible
make db-shell
# Should connect to PostgreSQL. Type \q to exit.
```

## 🧪 API Testing Results

### ✅ Working Endpoints

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/health` | GET | ✅ Working | Health check with database connectivity |
| `/api/v1/symbols` | GET | ✅ Working | List all symbols (empty initially) |
| `/api/v1/candles/:symbol` | GET | ✅ Working | Get candles for symbol with query params |
| `/api/v1/candles/:symbol/latest` | GET | ✅ Working | Get latest candle for symbol |
| `/api/v1/candles/:symbol/range` | GET | ✅ Working | Get candles in time range |
| `/api/v1/ws/candles/:symbol` | GET | ✅ Working | WebSocket placeholder (501 response) |

### ⚠️ Known Issues

| Endpoint | Method | Status | Issue |
|----------|--------|--------|-------|
| `/api/v1/symbols` | POST | ❌ Error | Symbol creation fails due to numeric field handling |
| `/api/v1/symbols/:symbol` | PUT | ❌ Untested | Depends on symbol creation |
| `/api/v1/symbols/:symbol` | DELETE | ❌ Untested | Depends on symbol creation |

**Symbol Creation Issue**: The POST endpoint for creating symbols currently fails with a database error related to numeric field validation. This is a known issue being investigated.

### 📊 Example API Responses

**Health Check**:
```json
{"status":"healthy","database":"healthy"}
```

**Empty Symbols List**:
```json
{"symbol":"","count":0,"symbols":null}
```

**Candles Response**:
```json
{"candles":null,"interval":"1h","symbol":"BTCUSDT"}
```

## 🔧 Development Status

### ✅ Completed Features

- **Echo Framework Setup**: Professional REST API with middleware
- **TimescaleDB Integration**: Time-series database with hypertables
- **Database Migrations**: Automated schema management
- **MVC Architecture**: Clean separation of concerns
- **Health Monitoring**: Database connectivity checks
- **CORS & Rate Limiting**: Production-ready middleware
- **Docker Containerization**: Easy development setup
- **Candle API Endpoints**: Full CRUD operations (read-only currently)
- **WebSocket Placeholder**: Ready for real-time streaming

### 🚧 In Progress

- **Symbol Management**: POST/PUT/DELETE operations (database schema issue)
- **Binance API Integration**: Data fetching and synchronization
- **Real-time WebSocket**: Live candle streaming

### 📋 Next Steps

1. **Fix Symbol Creation**: Resolve numeric field validation in database
2. **Implement Binance Client**: Complete API integration for live data
3. **Add WebSocket Support**: Real-time candle streaming
4. **Data Population**: Fetch and store historical candle data
5. **Authentication**: API key management for production
6. **Monitoring**: Logging and metrics collection

### 🏗️ Architecture Overview

```
tterminal-backend/
├── cmd/server/          # Application entry point
├── controllers/         # HTTP request handlers
├── services/           # Business logic layer
├── repositories/       # Data access layer
├── models/            # Data structures
├── internal/          # Internal packages
│   ├── database/      # DB connection & migrations
│   ├── binance/       # Binance API client
│   └── middleware/    # Echo middleware
├── migrations/        # Database schema
└── routes/           # API routing
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
**Error**: `Failed to connect to database`
**Solutions**:
```bash
# Check if Docker containers are running
docker ps

# Restart Docker services
make docker-down && make docker-up

# Wait longer for database to start
sleep 15
```

#### 2. Port Already in Use
**Error**: `bind: address already in use`
**Solutions**:
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process (replace PID)
kill -9 <PID>

# Or use different port in .env
PORT=8081
```

#### 3. Migration Errors
**Solutions**:
```bash
# Reset database completely
make docker-down
docker volume prune -f
make docker-up
make migrate-up
```
```
