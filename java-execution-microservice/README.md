# Java Execution Microservice

A standalone microservice for executing Java code in a secure, sandboxed environment using Docker containers.

## Features

- **Authentic Java Execution**: Real `javac` compilation and `java` runtime execution
- **Docker Sandboxing**: Each code execution runs in an isolated container
- **RESTful API**: Simple HTTP endpoints for code execution
- **Security**: Configurable timeouts, memory limits, and resource constraints
- **Scalable**: Stateless design suitable for cloud deployment

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- npm or yarn

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Or use Docker Compose**:
   ```bash
   docker-compose up --build
   ```

### Testing the Service

**Health Check**:
```bash
curl http://localhost:3001/health
```

**Execute Java Code**:
```bash
curl -X POST http://localhost:3001/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "public class HelloWorld { public static void main(String[] args) { System.out.println(\"Hello, World!\"); } }",
    "className": "HelloWorld"
  }'
```

## API Documentation

### POST /api/execute

Compile and execute Java code in a sandboxed environment.

**Request Body**:
```json
{
  "code": "public class Main { public static void main(String[] args) { System.out.println(\"Hello!\"); } }",
  "className": "Main",
  "timeout": 30000,
  "memoryLimit": "128m"
}
```

**Response**:
```json
{
  "success": true,
  "compilationOutput": {
    "stdout": "Compilation successful",
    "stderr": "",
    "exitCode": 0
  },
  "executionOutput": {
    "stdout": "Hello!\n",
    "stderr": "",
    "exitCode": 0
  },
  "executionTime": 1250,
  "memoryUsed": "12MB",
  "timestamp": "2025-09-11T22:16:55.000Z"
}
```

### GET /health

Health check endpoint for monitoring and load balancers.

## Architecture

- **Express.js Server**: Handles HTTP requests and routing
- **Docker Integration**: Uses dockerode to manage execution containers
- **Sandbox Security**: Each execution runs in an isolated OpenJDK container
- **Resource Management**: Configurable CPU, memory, and time limits

## Security Features

- Isolated container execution
- Resource limits (CPU, memory, disk)
- Execution timeouts
- No persistent storage access
- Network isolation

## Deployment

### Docker

```bash
# Build image
docker build -t java-execution-microservice .

# Run container
docker run -p 3001:3001 -v /var/run/docker.sock:/var/run/docker.sock java-execution-microservice
```

### Cloud Platforms

- **Railway**: Supports Docker deployments with persistent volumes
- **AWS ECS/Fargate**: Container orchestration with auto-scaling
- **Google Cloud Run**: Serverless container deployment
- **DigitalOcean App Platform**: Simple container deployment

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `MAX_CONCURRENT_EXECUTIONS` | `10` | Maximum parallel executions |
| `DEFAULT_TIMEOUT` | `30000` | Default execution timeout (ms) |
| `DEFAULT_MEMORY_LIMIT` | `128m` | Default memory limit |

## Status

🚧 **In Development** - Core functionality implemented, Docker execution pending

---

**Author**: MiniMax Agent  
**License**: MIT
