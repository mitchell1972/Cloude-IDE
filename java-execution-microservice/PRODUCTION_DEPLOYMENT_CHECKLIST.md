# Java Execution Microservice - Production Deployment Checklist

## Pre-Deployment Checklist

### Environment Setup
- [ ] Docker installed and running
- [ ] Node.js 18+ installed
- [ ] Cloud platform CLI installed (Railway/Heroku/etc.)
- [ ] Access to cloud platform account
- [ ] Domain/subdomain configured (if custom domain needed)

### Code Verification
- [ ] All dependencies installed (`npm install`)
- [ ] JavaScript syntax validated (`node -c server.js`)
- [ ] Local testing completed (`npm start` + manual tests)
- [ ] Docker functionality verified
- [ ] Health endpoint responding (`curl localhost:3001/health`)

### Security Review
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly configured
- [ ] CORS settings appropriate for production
- [ ] Resource limits configured
- [ ] Input validation implemented

## Deployment Steps

### Option 1: Quick Deploy Script
```bash
cd java-execution-microservice
chmod +x quick-deploy.sh
./quick-deploy.sh railway  # or heroku, digitalocean
```

### Option 2: Manual Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set MAX_CONCURRENT_EXECUTIONS=5

# Deploy
railway up
```

### Option 3: Manual Heroku Deployment
```bash
# Create Heroku app
heroku create java-execution-service

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MAX_CONCURRENT_EXECUTIONS=5

# Deploy
git init
git add .
git commit -m "Initial deployment"
heroku git:remote -a java-execution-service
git push heroku main
```

## Post-Deployment Verification

### Service Health Checks
- [ ] Health endpoint: `GET <URL>/health`
- [ ] API info endpoint: `GET <URL>/api/execute`
- [ ] Docker status: `GET <URL>/api/execute/status`

### Functional Testing
- [ ] Simple Java execution test
- [ ] Compilation error handling
- [ ] Runtime error handling
- [ ] Timeout protection
- [ ] Concurrent execution limits

### Performance Testing
- [ ] Response time < 10 seconds
- [ ] Memory usage within limits
- [ ] CPU usage acceptable
- [ ] Concurrent request handling

### Integration Testing
- [ ] SDET IDE integration working
- [ ] Java files execute correctly
- [ ] Error messages display properly
- [ ] Status indicators functioning

## SDET IDE Configuration

### Update Microservice URL
```javascript
// Option 1: Environment variable (recommended)
window.JAVA_EXECUTION_SERVICE_URL = '<DEPLOYED_MICROSERVICE_URL>';

// Option 2: Code update in javaExecutionService.ts
// Update detectMicroserviceUrl() function
```

### Deployment Steps
```bash
cd sdet-ide

# Update configuration
# Edit src/lib/javaExecutionService.ts with production URL

# Build and deploy
npm run build
# Deploy dist/ to your hosting platform
```

## Monitoring and Maintenance

### Health Monitoring
- [ ] Set up uptime monitoring for health endpoint
- [ ] Configure alerts for service downtime
- [ ] Monitor response times and error rates
- [ ] Set up log aggregation

### Performance Monitoring
- [ ] Track execution times
- [ ] Monitor resource usage
- [ ] Watch concurrent execution counts
- [ ] Monitor Docker container health

### Security Monitoring
- [ ] Monitor for malicious code patterns
- [ ] Track failed executions
- [ ] Watch for unusual resource usage
- [ ] Monitor network access attempts

## Troubleshooting

### Common Issues

**Service Won't Start**
- Check PORT environment variable
- Verify Docker daemon is running
- Check application logs
- Ensure dependencies are installed

**Java Execution Fails**
- Verify Docker images are available
- Check resource limits
- Examine container logs
- Test Docker functionality manually

**Performance Issues**
- Check concurrent execution limits
- Monitor resource usage
- Verify Docker performance
- Check network latency

**Integration Issues**
- Verify SDET IDE configuration
- Check CORS settings
- Test network connectivity
- Validate API endpoints

### Log Analysis
```bash
# Railway logs
railway logs

# Heroku logs
heroku logs --tail

# Check specific errors
grep -i error <log_file>
grep -i "execution failed" <log_file>
```

## Scaling Considerations

### Horizontal Scaling
- Increase instance count for high load
- Configure load balancer
- Implement session affinity if needed
- Monitor resource distribution

### Vertical Scaling
- Increase memory allocation
- Add CPU cores
- Expand disk space
- Optimize Docker settings

### Optimization
- Container image caching
- Warm container pools
- Request queuing
- Resource pre-allocation

## Backup and Recovery

### Backup Procedures
- [ ] Service configuration backup
- [ ] Environment variables backup
- [ ] Docker image backup
- [ ] Application code versioning

### Recovery Procedures
- [ ] Service restart procedures
- [ ] Rollback procedures
- [ ] Data recovery (if applicable)
- [ ] Emergency contact procedures

## Security Hardening

### Network Security
- [ ] Configure firewall rules
- [ ] Implement rate limiting
- [ ] Set up DDoS protection
- [ ] Enable HTTPS/TLS

### Container Security
- [ ] Regular image updates
- [ ] Security scanning
- [ ] Resource limit enforcement
- [ ] Network isolation

### Application Security
- [ ] Input validation
- [ ] Output sanitization
- [ ] Error message sanitization
- [ ] Audit logging

## Production Readiness Checklist

### Final Verification
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Monitoring configured
- [ ] Backup procedures in place
- [ ] Security measures implemented
- [ ] Performance benchmarks met
- [ ] Integration tests successful
- [ ] Rollback plan prepared

### Go-Live Approval
- [ ] Technical lead approval
- [ ] Security review passed
- [ ] Performance review passed
- [ ] Documentation review complete
- [ ] Operations team briefed
- [ ] Support procedures in place

## Contact Information

**Technical Support**:
- Primary: [Technical Lead]
- Secondary: [DevOps Team]
- Emergency: [On-call Engineer]

**Service Details**:
- Repository: [GitHub/GitLab URL]
- Documentation: [Wiki/Confluence URL]
- Monitoring: [Dashboard URL]
- Logs: [Log Platform URL]

---

**Deployment Status**: [ ] Ready [ ] In Progress [ ] Complete  
**Deployed By**: _______________  
**Deployment Date**: _______________  
**Version**: _______________  
**URL**: _______________
