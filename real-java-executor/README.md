# Real Java Executor Service

A production-grade microservice for authentic Java code compilation and execution using real `javac` and `java` subprocess execution.

## Features

### Authentic Java Execution
- **Real Compilation**: Uses actual `javac` compiler with full error reporting
- **Real Runtime**: Executes compiled `.class` files with genuine `java` command
- **Complete Output**: Captures authentic stdout/stderr from Java programs
- **Error Handling**: Real compilation errors and runtime exceptions with stack traces

### Production-Ready Architecture
- **Docker Containerization**: Secure execution environment with Ubuntu + OpenJDK 17
- **Resource Management**: CPU and memory limits, execution timeouts
- **Concurrent Processing**: Handles multiple simultaneous Java executions
- **Real-time Streaming**: WebSocket support for live compilation and execution output
- **Comprehensive Monitoring**: Health checks, metrics, and detailed logging

### Security & Isolation
- **Sandboxed Execution**: Each execution runs in isolated filesystem space
- **Input Validation**: Comprehensive code validation and dangerous pattern detection
- **Resource Limits**: Configurable timeouts and memory constraints
- **Authentication**: API key-based access control
- **Rate Limiting**: Protection against abuse and overload

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Java 17+ JDK (included in Docker image)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd real-java-executor

# Copy environment configuration
cp .env.example .env

# Edit configuration as needed
nano .env
```

### Running with Docker

```bash
# Build and start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Running Locally (Development)

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Or start in production mode
npm start
```

## API Documentation

### Compile and Execute Java Code

**Endpoint:** `POST /api/compile-and-run`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**
```json
{
  "code": "public class HelloWorld { public static void main(String[] args) { System.out.println(\"Hello, World!\"); } }",
  "className": "HelloWorld",
  "mainMethod": true,
  "timeout": 30000
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "uuid-here",
  "result": {
    "success": true,
    "output": "Hello, World!\n",
    "stderr": "",
    "error": null,
    "exitCode": 0,
    "compilationTime": 856,
    "executionTime": 42,
    "totalTime": 898,
    "className": "HelloWorld",
    "compilationError": false,
    "runtimeError": false
  }
}
```

### Compile Only (No Execution)

**Endpoint:** `POST /api/compile-only`

**Request Body:**
```json
{
  "code": "public class Test { /* Java code */ }",
  "className": "Test"
}
```

**Response:**
```json
{
  "success": true,
  "compilationId": "uuid-here",
  "result": {
    "success": true,
    "output": "",
    "stderr": "",
    "error": null,
    "compilationTime": 742,
    "className": "Test"
  }
}
```

### Real-time Execution (WebSocket)

**Endpoint:** `ws://localhost:3000/ws/execute`

**Message Format:**
```json
{
  "type": "execute",
  "code": "public class StreamTest { public static void main(String[] args) { for(int i=1; i<=5; i++) { System.out.println(\"Count: \" + i); } } }",
  "className": "StreamTest",
  "mainMethod": true,
  "timeout": 30000
}
```

**Response Messages:**
```json
{"type": "started", "executionId": "uuid"}
{"type": "output", "executionId": "uuid", "data": "Writing Java source to StreamTest.java...\n"}
{"type": "output", "executionId": "uuid", "data": "Compiling StreamTest.java...\n"}
{"type": "output", "executionId": "uuid", "data": "Count: 1\n"}
{"type": "completed", "executionId": "uuid", "result": {...}}
```

### Health Checks

**Basic Health:** `GET /api/health`
**Detailed Health:** `GET /api/health/detailed`
**Java-specific Health:** `GET /api/health/java`

### System Information

**Service Status:** `GET /api/status`
**Statistics:** `GET /api/stats`
**Performance Metrics:** `GET /api/stats/performance`

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `3000` | Server port |
| `API_KEY` | - | Authentication key |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins |
| `JAVA_EXECUTION_TIMEOUT` | `30000` | Max execution time (ms) |
| `JAVA_COMPILE_TIMEOUT` | `15000` | Max compilation time (ms) |
| `MAX_CONCURRENT_EXECUTIONS` | `10` | Concurrent execution limit |
| `MAX_CODE_SIZE_KB` | `500` | Max code size in KB |
| `CLEANUP_INTERVAL_MS` | `300000` | Cleanup interval (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Rate limit per window |
| `LOG_LEVEL` | `info` | Logging level |

### Java Environment

- **Java Version:** OpenJDK 17
- **Java Home:** `/usr/lib/jvm/java-17-openjdk-amd64`
- **Memory Limit:** 512MB per execution
- **Execution Directory:** `/tmp/java-executions`

## Security Features

### Code Validation

The service automatically blocks potentially dangerous operations:

- File I/O operations (`java.io.File`, `FileWriter`, etc.)
- Network operations (`java.net`, `Socket`, `URL`)
- Process execution (`Runtime.getRuntime()`, `ProcessBuilder`)
- System operations (`System.exit()`, environment variables)

### Resource Protection

- Execution timeouts prevent infinite loops
- Memory limits prevent excessive resource usage
- Concurrent execution limits prevent overload
- Automatic cleanup of temporary files
- Process isolation with non-root user

## Deployment

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy the service
railway init
railway up

# Set environment variables
railway variables set API_KEY=your-secure-key
railway variables set ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### Docker Deployment

```bash
# Build the image
docker build -t real-java-executor .

# Run the container
docker run -p 3000:3000 \
  -e API_KEY=your-secure-key \
  -e ALLOWED_ORIGINS=https://your-frontend-domain.com \
  real-java-executor
```

### Cloud Platforms

The service is compatible with:
- Railway (recommended)
- DigitalOcean App Platform
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Instances

## Monitoring

### Health Monitoring

- **Endpoint:** `/api/health`
- **Frequency:** Every 30 seconds
- **Checks:** Java runtime, compiler, filesystem, memory

### Logging

- **Format:** Structured JSON logs
- **Levels:** error, warn, info, debug
- **Storage:** File-based with rotation
- **Request Tracking:** Unique request IDs

### Metrics

- Execution success/failure rates
- Compilation and runtime performance
- Resource usage statistics
- Concurrent execution tracking

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Test compilation and execution
curl -X POST http://localhost:3000/api/compile-and-run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "code": "public class Test { public static void main(String[] args) { System.out.println(\"Hello from Real Java!\"); } }",
    "className": "Test"
  }'
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery quick --count 10 --num 20 http://localhost:3000/api/health
```

## Troubleshooting

### Common Issues

**Java Not Found**
- Verify `JAVA_HOME` environment variable
- Check Java installation: `java -version`
- Ensure PATH includes Java binaries

**Permission Denied**
- Check temp directory permissions: `/tmp/java-executions`
- Verify Docker user permissions
- Ensure non-root user can write to temp directories

**Timeout Errors**
- Increase `JAVA_EXECUTION_TIMEOUT` for complex programs
- Check system resources (CPU, memory)
- Monitor concurrent execution count

**Memory Issues**
- Increase Docker container memory limits
- Adjust `MAX_MEMORY_MB` setting
- Monitor system memory usage

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check detailed health status
curl http://localhost:3000/api/health/detailed

# Monitor Java-specific health
curl http://localhost:3000/api/health/java
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions:
- Check the health endpoints for system status
- Review logs for detailed error information
- Ensure proper Java installation and configuration
- Verify network connectivity and firewall settings