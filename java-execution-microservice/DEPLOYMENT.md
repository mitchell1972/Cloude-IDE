# Java Execution Microservice - Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- Docker Desktop or Docker Engine
- npm or yarn

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Docker** (if not already running)
   ```bash
   # On macOS/Windows with Docker Desktop
   # Just start Docker Desktop application
   
   # On Linux
   sudo systemctl start docker
   ```

3. **Start the Service**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Or production mode
   npm start
   ```

4. **Test the Service**
   ```bash
   # Run comprehensive tests
   node test-service.js
   
   # Or test specific endpoint
   curl http://localhost:3001/health
   ```

5. **Prepare Java Runtime** (if needed)
   ```bash
   curl -X POST http://localhost:3001/api/execute/prepare
   ```

## Docker Deployment

### Build and Run with Docker

```bash
# Build the image
docker build -t java-execution-microservice .

# Run the container
docker run -d \
  --name java-executor \
  -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  java-execution-microservice

# Check container logs
docker logs java-executor

# Stop the container
docker stop java-executor
docker rm java-executor
```

### Docker Compose Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Cloud Deployment

### Railway Deployment

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Configure Environment**
   - Ensure Docker socket is available
   - Set PORT environment variable (Railway sets this automatically)
   - Configure resource limits as needed

### AWS ECS/Fargate Deployment

1. **Create ECR Repository**
   ```bash
   aws ecr create-repository --repository-name java-execution-microservice
   ```

2. **Build and Push Image**
   ```bash
   # Get login token
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com
   
   # Build and tag image
   docker build -t java-execution-microservice .
   docker tag java-execution-microservice:latest <account>.dkr.ecr.us-west-2.amazonaws.com/java-execution-microservice:latest
   
   # Push image
   docker push <account>.dkr.ecr.us-west-2.amazonaws.com/java-execution-microservice:latest
   ```

3. **Create ECS Service**
   - Use Fargate launch type
   - Configure task definition with Docker socket access
   - Set appropriate CPU/memory limits
   - Configure load balancer and security groups

### Google Cloud Run Deployment

```bash
# Build and submit to Cloud Build
gcloud builds submit --tag gcr.io/PROJECT-ID/java-execution-microservice

# Deploy to Cloud Run
gcloud run deploy java-execution-microservice \
  --image gcr.io/PROJECT-ID/java-execution-microservice \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=60s
```

## Security Considerations

### Production Security Checklist

- [ ] **API Rate Limiting**: Implement rate limiting to prevent abuse
- [ ] **Authentication**: Add API key or JWT token authentication
- [ ] **Request Validation**: Validate all incoming requests thoroughly
- [ ] **Resource Limits**: Set appropriate CPU/memory/timeout limits
- [ ] **Network Security**: Configure firewall rules and VPC settings
- [ ] **Monitoring**: Set up logging, metrics, and alerting
- [ ] **Container Security**: Regularly update base images and dependencies
- [ ] **Code Scanning**: Implement static code analysis for uploaded Java code

### Environment Variables

```bash
# Optional configuration
PORT=3001                          # Server port
NODE_ENV=production                # Environment mode
MAX_CONCURRENT_EXECUTIONS=10       # Max parallel executions
DEFAULT_TIMEOUT=30000             # Default timeout (ms)
DEFAULT_MEMORY_LIMIT=128m         # Default memory limit
JAVA_IMAGE=openjdk:17-alpine      # Java Docker image
TEMP_DIR=/tmp/java-executions     # Temporary file directory
```

## Troubleshooting

### Common Issues

**1. Docker Connection Failed**
```bash
# Check Docker daemon status
docker info

# Verify Docker socket permissions
ls -la /var/run/docker.sock

# Restart Docker service (Linux)
sudo systemctl restart docker
```

**2. Java Image Pull Failed**
```bash
# Manually pull the image
docker pull openjdk:17-alpine

# Check available disk space
df -h

# Clean up old Docker images
docker system prune
```

**3. Execution Timeout**
```bash
# Check container resource limits
docker stats

# Monitor system resources
top
free -m
```

**4. Permission Denied Errors**
```bash
# Check temp directory permissions
ls -la /tmp/java-executions

# Fix permissions if needed
sudo chmod 755 /tmp/java-executions
```

### Monitoring Commands

```bash
# Service health check
curl http://localhost:3001/health

# Docker status check
curl http://localhost:3001/api/execute/status

# View service logs
docker logs java-executor -f

# Monitor resource usage
docker stats java-executor
```

## Performance Tuning

### Optimization Tips

1. **Container Reuse**: Consider keeping containers warm for better performance
2. **Image Caching**: Use Docker layer caching to speed up builds
3. **Resource Allocation**: Tune CPU and memory limits based on usage patterns
4. **Concurrent Limits**: Adjust `MAX_CONCURRENT_EXECUTIONS` based on server capacity
5. **Timeout Configuration**: Set appropriate timeouts to balance functionality and resource usage

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Simple load test
ab -n 100 -c 10 -H "Content-Type: application/json" \
   -p test-payload.json \
   http://localhost:3001/api/execute
```

---

**Author**: MiniMax Agent  
**Last Updated**: 2025-09-11  
**Version**: 1.0.0
