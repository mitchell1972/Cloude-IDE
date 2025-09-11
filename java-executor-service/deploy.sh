#!/bin/bash

# Java Executor Service Deployment Script
# This script deploys the Java execution microservice to Railway

set -e

echo "🚀 Deploying Java Executor Service to Railway"
echo "==========================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed"
    echo "📥 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "📝 Please log in to Railway:"
    railway login
fi

# Create new Railway project
echo "📦 Creating Railway project..."
railway init

# Set environment variables
echo "⚙️ Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set MAX_EXECUTION_TIME=30000
railway variables set MAX_MEMORY_MB=512
railway variables set MAX_CONCURRENT_EXECUTIONS=10
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set LOG_LEVEL=info

# Generate secure API key
API_KEY=$(openssl rand -hex 32)
echo "🔑 Generated API key: $API_KEY"
railway variables set API_KEY="$API_KEY"

# Set allowed origins (will be updated after SDET IDE integration)
railway variables set ALLOWED_ORIGINS="*"

echo "📤 Deploying to Railway..."
railway up --detach

echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the deployment URL
DEPLOY_URL=$(railway domain)
if [ -z "$DEPLOY_URL" ]; then
    echo "🌐 Getting deployment URL..."
    railway domain
    DEPLOY_URL=$(railway domain)
fi

echo "✅ Deployment completed!"
echo "🌍 Service URL: $DEPLOY_URL"
echo "🔑 API Key: $API_KEY"
echo ""
echo "🧪 Testing deployment..."

# Test the deployment
if command -v curl &> /dev/null; then
    echo "📊 Health check:"
    curl -f "$DEPLOY_URL/health" || echo "⚠️ Health check failed"
    
    echo -e "\n\n🧪 Testing Java execution:"
    curl -X POST "$DEPLOY_URL/api/execute" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_KEY" \
        -d '{"code":"public class Test { public static void main(String[] args) { System.out.println(\"Hello from Railway!\"); } }","className":"Test"}' \
        || echo "⚠️ Execution test failed"
else
    echo "⚠️ curl not available, skipping tests"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Update SDET IDE to use this service URL: $DEPLOY_URL"
echo "2. Set the API key in SDET IDE configuration: $API_KEY"
echo "3. Update ALLOWED_ORIGINS to restrict access to your SDET IDE domain"
echo "4. Monitor service health at: $DEPLOY_URL/health"
echo ""
echo "🎉 Java Executor Service is ready for production!"

# Save deployment info
echo "DEPLOY_URL=$DEPLOY_URL" > .deployment-info
echo "API_KEY=$API_KEY" >> .deployment-info
echo "DEPLOYMENT_DATE=$(date)" >> .deployment-info

echo "💾 Deployment info saved to .deployment-info"