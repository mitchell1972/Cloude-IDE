# Production-grade Java execution environment
FROM node:18-alpine

# Install Java and essential tools
RUN apk add --no-cache \
    openjdk17-jdk \
    docker-cli \
    bash \
    curl \
    && rm -rf /var/cache/apk/*

# Set Java environment
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH=$PATH:$JAVA_HOME/bin

# Create application directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create directories for temporary files
RUN mkdir -p /tmp/java-executor && chmod 755 /tmp/java-executor

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S executor -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R executor:nodejs /usr/src/app /tmp/java-executor

# Switch to non-root user
USER executor

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]