# SDET IDE - Java Execution Microservice Integration

## Overview

This document describes the integration of the SDET IDE with the standalone Java execution microservice. The integration replaces the limited Supabase Edge Function approach with authentic Java compilation and execution capabilities.

## Architecture Changes

### Before (Original Implementation)
```
SDET IDE Frontend → Supabase Edge Function → Simulated Java Execution
```

### After (New Implementation)
```
SDET IDE Frontend → Java Execution Microservice → Docker + Real javac/java
```

## Key Components

### 1. Java Execution Service Client (`src/lib/javaExecutionService.ts`)

**Purpose**: Handles communication with the standalone Java execution microservice.

**Key Features**:
- Automatic microservice URL detection (dev/prod)
- Request timeout handling (45 seconds)
- Automatic Java class name extraction
- Comprehensive error handling
- Health check capabilities
- Status monitoring

**API Methods**:
- `executeJavaCode()`: Execute Java code with real compilation
- `checkHealth()`: Verify microservice availability
- `getStatus()`: Get detailed Docker and Java runtime status
- `prepareRuntime()`: Pull Java Docker image if needed

### 2. Updated Supabase Integration (`src/lib/supabase.ts`)

**Changes**:
- Imports the new Java execution service
- Modified `executeTest()` function to route Java code to microservice
- Maintains backward compatibility with other languages
- Transforms microservice responses to match expected format

**Language Routing Logic**:
```typescript
if (files[0].language === 'java') {
  // Use Java execution microservice
  const result = await javaExecutionService.executeJavaCode(testCode);
} else {
  // Use original Supabase edge function
  const { data } = await supabase.functions.invoke('sdet-enhanced-executor');
}
```

### 3. Enhanced Test Executor (`src/components/TestExecutor.tsx`)

**New Features**:
- Microservice health monitoring for Java files
- Real-time service status display
- Enhanced error handling with language-specific tips
- Automatic health checks before Java execution
- Visual indicators for service connectivity

**Status Indicators**:
- 🟭 **Online**: Microservice is healthy and ready
- 🚫 **Offline**: Microservice is not accessible
- 🔴 **Checking**: Health check in progress

### 4. Improved Code Editor (`src/components/CodeEditor.tsx`)

**Enhancements**:
- Better Java test file detection
- Priority to main method over test annotations
- More accurate execution button text
- Improved code pattern recognition

## Execution Flow

### Java Code Execution

1. **User clicks "Run Program"** in Code Editor
2. **Health Check**: TestExecutor checks microservice status
3. **Routing**: Supabase.ts routes Java code to microservice
4. **Microservice Processing**:
   - Creates isolated Docker container
   - Writes Java code to temporary file
   - Compiles with `javac`
   - Executes with `java`
   - Captures output and timing
   - Cleans up resources
5. **Response Transformation**: Converts microservice format to IDE format
6. **Display Results**: Shows compilation/execution output to user

### Non-Java Code Execution

1. **User clicks execution button**
2. **Direct Routing**: Code goes to original Supabase edge function
3. **Simulated Processing**: Uses existing simulation logic
4. **Display Results**: Shows output using existing format

## Configuration

### Environment Variables

The microservice URL can be configured via:

```javascript
// Set globally before app initialization
window.JAVA_EXECUTION_SERVICE_URL = 'https://your-microservice-url.com';
```

### Automatic URL Detection

1. **Environment Variable**: `window.JAVA_EXECUTION_SERVICE_URL`
2. **Development**: `http://localhost:3001` (for local testing)
3. **Production**: `https://java-executor-service.railway.app` (default)

## Error Handling

### Network Errors
- Connection timeouts (45 seconds)
- CORS issues
- Service unavailability
- DNS resolution failures

### Java Compilation Errors
- Syntax errors with specific tips
- Missing imports
- Class name mismatches
- Method signature issues

### Java Runtime Errors
- Null pointer exceptions
- Array index out of bounds
- Infinite loops (timeout protection)
- Memory limit exceeded

### Fallback Behavior

When the microservice is unavailable:
1. Service status shows "Offline"
2. Execution proceeds but returns structured error
3. User receives clear explanation and troubleshooting tips
4. No crash or undefined behavior

## Testing

### Manual Testing Checklist

**Java Code Execution**:
- [ ] Simple "Hello World" program
- [ ] Program with compilation errors
- [ ] Program with runtime exceptions
- [ ] Program with infinite loops
- [ ] Program with multiple classes
- [ ] Program with command line arguments

**Microservice Integration**:
- [ ] Health check functionality
- [ ] Status refresh button
- [ ] Network error handling
- [ ] Service timeout handling
- [ ] URL detection logic

**Non-Java Languages**:
- [ ] Python script execution
- [ ] JavaScript execution
- [ ] Test framework execution

### Test Cases

**Test Case 1: Simple Java Program**
```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```
*Expected*: Successful execution with "Hello, World!" output

**Test Case 2: Compilation Error**
```java
public class ErrorTest {
    public static void main(String[] args) {
        System.out.println("Missing semicolon")
    }
}
```
*Expected*: Compilation error with helpful suggestions

**Test Case 3: Runtime Exception**
```java
public class RuntimeError {
    public static void main(String[] args) {
        int[] arr = new int[5];
        System.out.println(arr[10]);
    }
}
```
*Expected*: Runtime error with exception details

## Deployment

### Prerequisites

1. **Java Execution Microservice**: Must be deployed and accessible
2. **Docker Support**: Microservice requires Docker for containers
3. **Network Access**: IDE must be able to reach microservice

### Configuration Steps

1. **Deploy Microservice**: Follow microservice deployment guide
2. **Update IDE Configuration**: Set correct microservice URL
3. **Test Integration**: Run comprehensive test suite
4. **Monitor Health**: Ensure status monitoring works

### Production Considerations

1. **Performance**: Microservice adds ~2-5 seconds per execution
2. **Scalability**: Microservice supports concurrent executions
3. **Reliability**: Graceful degradation when service is unavailable
4. **Security**: Network isolation and resource limits in microservice

## Monitoring and Maintenance

### Health Monitoring

- Service status visible in IDE
- Automatic health checks
- Manual refresh capability
- Error logging and reporting

### Performance Metrics

- Execution time tracking
- Success/failure rates
- Microservice response times
- Error categorization

### Troubleshooting

**Common Issues**:
1. **Service Offline**: Check microservice deployment
2. **Slow Execution**: Check Docker performance
3. **Compilation Errors**: Verify Java code syntax
4. **Network Errors**: Check connectivity and CORS

## Future Enhancements

1. **Multiple Language Support**: Extend microservice for Python, JavaScript
2. **Advanced Debugging**: Breakpoints and step-through debugging
3. **Performance Profiling**: Memory and CPU usage analysis
4. **Collaborative Execution**: Shared execution sessions
5. **Custom Libraries**: Support for external JAR files

---

**Integration Status**: ✅ **Complete**  
**Next Phase**: Deploy and test in production environment  
**Author**: MiniMax Agent  
**Date**: 2025-09-11