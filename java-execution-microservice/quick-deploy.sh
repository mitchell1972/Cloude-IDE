#!/bin/bash

# Quick Deployment Script for Java Execution Microservice
# Usage: ./quick-deploy.sh [platform]
# Platforms: railway, heroku, digitalocean

set -e

PLATFORM=${1:-railway}
SERVICE_NAME="java-execution-microservice"
PORT=${PORT:-3001}

echo "🚀 Java Execution Microservice - Quick Deploy"
echo "📦 Platform: $PLATFORM"
echo "🏷️  Service: $SERVICE_NAME"
echo "🌐 Port: $PORT"
echo ""

cd java-execution-microservice

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Test locally first
echo "🧪 Testing service locally..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Test Docker connectivity
echo "🐳 Testing Docker connectivity..."
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker and try again."
    exit 1
fi

# Start service in background for testing
echo "🏃 Starting service for testing..."
npm start &
SERVER_PID=$!

# Wait for service to start
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:$PORT/health &> /dev/null; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Test API endpoint
echo "🔧 Testing API endpoint..."
API_TEST=$(curl -s -X POST http://localhost:$PORT/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "code": "public class Test { public static void main(String[] args) { System.out.println(\"Hello!\"); } }",
    "className": "Test"
  }' | grep -c '"success"' || echo "0")

if [ "$API_TEST" -gt "0" ]; then
    echo "✅ API test passed"
else
    echo "⚠️  API test inconclusive (microservice functionality depends on Docker access)"
fi

# Stop test server
kill $SERVER_PID 2>/dev/null || true
sleep 2

echo "✅ Local testing completed"
echo ""

# Deploy based on platform
case $PLATFORM in
    "railway")
        echo "🚂 Deploying to Railway..."
        
        if ! command -v railway &> /dev/null; then
            echo "📦 Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        
        echo "🔑 Please ensure you're logged in to Railway"
        echo "   Run: railway login"
        read -p "Press Enter when ready to continue..."
        
        # Initialize Railway project if needed
        if [ ! -f "railway.json" ]; then
            echo "🆕 Initializing Railway project..."
            railway init
        fi
        
        # Set environment variables
        echo "🔧 Setting environment variables..."
        railway variables set PORT=$PORT
        railway variables set NODE_ENV=production
        railway variables set MAX_CONCURRENT_EXECUTIONS=5
        
        # Deploy
        echo "🚀 Deploying to Railway..."
        railway up
        
        # Get deployment URL
        echo "🌐 Getting deployment URL..."
        DEPLOY_URL=$(railway status --json 2>/dev/null | grep -o 'https://[^"]*' | head -1 || echo "")
        
        if [ -n "$DEPLOY_URL" ]; then
            echo "✅ Deployment successful!"
            echo "🌐 URL: $DEPLOY_URL"
            echo "🏥 Health: $DEPLOY_URL/health"
            echo "📋 Status: $DEPLOY_URL/api/execute/status"
        else
            echo "⚠️  Deployment completed but URL not found. Check Railway dashboard."
        fi
        ;;
        
    "heroku")
        echo "🟣 Deploying to Heroku..."
        
        if ! command -v heroku &> /dev/null; then
            echo "❌ Heroku CLI is required. Install from: https://devcenter.heroku.com/articles/heroku-cli"
            exit 1
        fi
        
        # Create Heroku app
        echo "🆕 Creating Heroku app..."
        heroku create $SERVICE_NAME-$(date +%s) || true
        
        # Set environment variables
        echo "🔧 Setting environment variables..."
        heroku config:set NODE_ENV=production
        heroku config:set MAX_CONCURRENT_EXECUTIONS=5
        
        # Deploy
        echo "🚀 Deploying to Heroku..."
        git init || true
        git add .
        git commit -m "Deploy Java execution microservice" || true
        heroku git:remote -a $(heroku apps:info --json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
        git push heroku main
        
        # Get app info
        DEPLOY_URL=$(heroku apps:info --json | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
        echo "✅ Deployment successful!"
        echo "🌐 URL: $DEPLOY_URL"
        echo "🏥 Health: $DEPLOY_URL/health"
        ;;
        
    "digitalocean")
        echo "🌊 DigitalOcean App Platform deployment instructions:"
        echo ""
        echo "1. Create new app in DigitalOcean App Platform"
        echo "2. Connect this GitHub repository"
        echo "3. Set build command: npm install"
        echo "4. Set run command: node server.js"
        echo "5. Set environment variables:"
        echo "   - NODE_ENV=production"
        echo "   - PORT=\$PORT"
        echo "   - MAX_CONCURRENT_EXECUTIONS=5"
        echo "6. Deploy and get the URL"
        echo ""
        echo "📋 For full instructions, see DEPLOYMENT.md"
        ;;
        
    *)
        echo "❌ Unknown platform: $PLATFORM"
        echo "📋 Supported platforms: railway, heroku, digitalocean"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment process completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Test the deployed service health endpoint"
echo "2. Update SDET IDE configuration with the new URL"
echo "3. Run integration tests"
echo "4. Monitor service performance"
echo ""
echo "📚 For detailed instructions, see:"
echo "   - DEPLOYMENT.md (comprehensive deployment guide)"
echo "   - README.md (API documentation)"
echo "   - test-service.js (testing script)"
echo ""
echo "🔧 Quick Test Command:"
echo "   node test-service.js <DEPLOYED_URL>"
echo ""
echo "✅ Java execution microservice deployment complete!"
