# Java Executor Service

A production-grade microservice for secure Java code compilation and execution, designed for integration with the SDET IDE platform.

## Features

- **Secure Execution**: Sandboxed Java code execution with resource limits
- **Real-time Output**: WebSocket support for streaming execution output
- **Comprehensive Validation**: Input validation and security checks
- **Production Ready**: Rate limiting, monitoring, and health checks
- **Docker Support**: Containerized deployment with Docker Compose
- **Scalable**: Horizontal scaling support with load balancing

## Quick Start

### Prerequisites

- Node.js 18+
- Java 17+ (OpenJDK recommended)
- Docker (for containerized deployment)

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env
```

### Configuration

Key environment variables:

```env
# Server
PORT=3000
NODE_ENV=production

# Security
API_KEY=your_secure_api_key_here
ALLOWED_ORIGINS=https://your-sdet-ide-domain.com

# Execution Limits
MAX_EXECUTION_TIME=30000
MAX_MEMORY_MB=512
MAX_CONCURRENT_EXECUTIONS=10
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm start

# Docker Compose
docker-compose up -d
```

## API Documentation

### Execute Java Code

```http
POST /api/execute
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "code": "public class Main { public static void main(String[] args) { System.out.println(\"Hello World\"); } }",
  "className": "Main",
  "mainMethod": true
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "uuid-here",
  "result": {
    "success": true,
    "output": "Hello World\n",
    "error": "",
    "executionTime": 150,
    "compilationTime": 80,
    "className": "Main"
  }
}
```

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-11T21:58:38.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "javaCompiler": true,
    "javaRuntime": true,
    "filesystem": true,
    "memory": true
  }
}
```

### System Status

```http
GET /api/status
Authorization: Bearer YOUR_API_KEY
```

## Security Features

- **Input Validation**: Comprehensive code validation and sanitization
- **Dangerous Pattern Detection**: Blocks file I/O, process execution, and system operations
- **Resource Limits**: Memory and execution time constraints
- **Rate Limiting**: Protection against abuse
- **Sandboxed Execution**: Isolated execution environment
- **API Authentication**: Bearer token authentication

## Deployment

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# Scale the service
docker-compose up -d --scale java-executor=3

# View logs
docker-compose logs -f java-executor
```

### Cloud Deployment

Supported platforms:
- Railway
- AWS ECS/Fargate
- Google Cloud Run
- DigitalOcean App Platform
- Heroku

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
API_KEY=secure-random-api-key
ALLOWED_ORIGINS=https://your-sdet-ide.com,https://staging-sdet-ide.com
MAX_EXECUTION_TIME=30000
MAX_MEMORY_MB=512
MAX_CONCURRENT_EXECUTIONS=20
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

## Monitoring

### Health Checks

- `/health` - Basic health status
- `/health/detailed` - Comprehensive diagnostics

### Logging

- Structured JSON logging with Winston
- Request tracking with unique IDs
- Error monitoring and alerting
- Performance metrics

### Metrics

- Execution time tracking
- Memory usage monitoring
- Concurrent execution limits
- Rate limiting statistics

## Integration with SDET IDE

The service is designed to integrate seamlessly with the SDET IDE:

1. **Replace Edge Function**: Update SDET IDE to call this service instead of the Supabase edge function
2. **Real-time Output**: Use WebSocket connection for live execution feedback
3. **Error Handling**: Comprehensive error responses with user-friendly messages
4. **Authentication**: Secure API key authentication

## Development

### Project Structure

```
java-executor-service/
├── index.js                 # Main application
├── services/
│   └── javaExecutor.js     # Core Java execution logic
├── middleware/
│   ├── auth.js             # Authentication middleware
│   └── validation.js       # Input validation
├── routes/
│   └── health.js           # Health check endpoints
├── utils/
│   └── logger.js           # Logging configuration
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Multi-container setup
└── package.json            # Dependencies and scripts
```

### Testing

```bash
# Run tests
npm test

# Test compilation
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"code":"public class Test { public static void main(String[] args) { System.out.println(\"Test\"); } }"}'
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the health endpoints for system status
- Review logs for detailed error information
- Ensure proper Java installation and configuration