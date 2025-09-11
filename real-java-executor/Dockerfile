# Production Java Execution Environment
FROM ubuntu:22.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies and Java JDK
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    nodejs \
    npm \
    curl \
    wget \
    unzip \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Verify Java installation
RUN java -version && javac -version

# Create application directory
WORKDIR /usr/src/app

# Create directories for Java execution
RUN mkdir -p /tmp/java-executions && \
    chmod 755 /tmp/java-executions

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r javaexec && \
    useradd -r -g javaexec -s /bin/bash javaexec && \
    chown -R javaexec:javaexec /usr/src/app /tmp/java-executions

# Switch to non-root user
USER javaexec

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]