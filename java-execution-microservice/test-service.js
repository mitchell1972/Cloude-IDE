#!/usr/bin/env node

/**
 * Test script for Java Execution Microservice
 * 
 * Usage: node test-service.js [base-url]
 * Example: node test-service.js http://localhost:3001
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3001';
const TEST_TIMEOUT = 45000; // 45 seconds

// Test cases
const testCases = [
  {
    name: 'Simple Hello World',
    code: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
    className: 'HelloWorld',
    expectedOutput: 'Hello, World!'
  },
  {
    name: 'Mathematical Calculation',
    code: `public class MathTest {
    public static void main(String[] args) {
        int a = 10;
        int b = 20;
        int sum = a + b;
        System.out.println("Sum: " + sum);
        System.out.println("Product: " + (a * b));
    }
}`,
    className: 'MathTest',
    expectedOutput: ['Sum: 30', 'Product: 200']
  },
  {
    name: 'Compilation Error Test',
    code: `public class CompileError {
    public static void main(String[] args) {
        // Missing semicolon intentionally
        System.out.println("This will fail")
    }
}`,
    className: 'CompileError',
    expectError: true,
    errorType: 'compilation'
  },
  {
    name: 'Runtime Exception Test',
    code: `public class RuntimeError {
    public static void main(String[] args) {
        int[] arr = new int[5];
        System.out.println(arr[10]); // IndexOutOfBoundsException
    }
}`,
    className: 'RuntimeError',
    expectError: false, // Should compile but fail at runtime
    expectedError: 'IndexOutOfBoundsException'
  }
];

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: TEST_TIMEOUT
    };
    
    const req = client.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('\n=== Health Check Test ===');
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    console.log(`✅ Health check: ${response.status}`);
    console.log(`   Service: ${response.data.service}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function testServiceInfo() {
  console.log('\n=== Service Info Test ===');
  try {
    const response = await makeRequest(`${BASE_URL}/api/execute`);
    console.log(`✅ Service info: ${response.status}`);
    console.log(`   Version: ${response.data.version}`);
    console.log(`   Runtime: ${response.data.runtime?.javaImage || 'N/A'}`);
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Service info failed: ${error.message}`);
    return false;
  }
}

async function testDockerStatus() {
  console.log('\n=== Docker Status Test ===');
  try {
    const response = await makeRequest(`${BASE_URL}/api/execute/status`);
    console.log(`✅ Docker status: ${response.status}`);
    if (response.data.status) {
      console.log(`   Docker connected: ${response.data.status.docker?.connected}`);
      console.log(`   Java image available: ${response.data.status.java?.available}`);
      if (!response.data.status.java?.available) {
        console.log('   ⚠️  Java image needs to be pulled');
      }
    }
    return response.status === 200;
  } catch (error) {
    console.log(`❌ Docker status failed: ${error.message}`);
    return false;
  }
}

async function testCodeExecution(testCase) {
  console.log(`\n=== Testing: ${testCase.name} ===`);
  try {
    const response = await makeRequest(`${BASE_URL}/api/execute`, {
      method: 'POST',
      body: {
        code: testCase.code,
        className: testCase.className,
        timeout: 15000
      }
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${response.data.success}`);
    
    if (testCase.expectError && testCase.errorType === 'compilation') {
      if (!response.data.success && response.data.error === 'Compilation failed') {
        console.log('✅ Expected compilation error occurred');
        return true;
      } else {
        console.log('❌ Expected compilation error but got success');
        return false;
      }
    }
    
    if (response.data.success) {
      const output = response.data.executionOutput?.stdout || '';
      console.log(`   Execution time: ${response.data.executionTime}ms`);
      console.log(`   Output: "${output.trim()}"`);
      
      if (testCase.expectedOutput) {
        if (Array.isArray(testCase.expectedOutput)) {
          const allFound = testCase.expectedOutput.every(expected => 
            output.includes(expected)
          );
          if (allFound) {
            console.log('✅ All expected outputs found');
            return true;
          } else {
            console.log('❌ Some expected outputs missing');
            return false;
          }
        } else {
          if (output.includes(testCase.expectedOutput)) {
            console.log('✅ Expected output found');
            return true;
          } else {
            console.log('❌ Expected output not found');
            return false;
          }
        }
      }
      
      if (testCase.expectedError) {
        const errorOutput = response.data.executionOutput?.stderr || '';
        if (errorOutput.includes(testCase.expectedError)) {
          console.log('✅ Expected runtime error found');
          return true;
        } else {
          console.log('❌ Expected runtime error not found');
          console.log(`   stderr: "${errorOutput}"`);
          return false;
        }
      }
      
      console.log('✅ Test completed successfully');
      return true;
    } else {
      console.log(`❌ Execution failed: ${response.data.error}`);
      console.log(`   Message: ${response.data.message || 'N/A'}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(`🚀 Starting Java Execution Microservice Tests`);
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  const results = [];
  let totalTests = 0;
  let passedTests = 0;
  
  // Basic service tests
  const basicTests = [
    { name: 'Health Check', test: testHealthCheck },
    { name: 'Service Info', test: testServiceInfo },
    { name: 'Docker Status', test: testDockerStatus }
  ];
  
  for (const basicTest of basicTests) {
    totalTests++;
    const result = await basicTest.test();
    results.push({ name: basicTest.name, passed: result });
    if (result) passedTests++;
  }
  
  // Code execution tests
  for (const testCase of testCases) {
    totalTests++;
    const result = await testCodeExecution(testCase);
    results.push({ name: testCase.name, passed: result });
    if (result) passedTests++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });
  
  console.log('\n' + '-'.repeat(30));
  console.log(`📈 Overall: ${passedTests}/${totalTests} tests passed`);
  console.log(`🎯 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The microservice is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the service configuration.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Start tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});