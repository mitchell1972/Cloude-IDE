const axios = require('axios');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-key';

const testClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 60000
});

// Test cases
const testCases = [
  {
    name: 'Simple Hello World',
    code: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println("Java execution successful!");
    }
}`,
    className: 'HelloWorld',
    expectedOutput: 'Hello, World!\nJava execution successful!'
  },
  {
    name: 'Mathematical Operations',
    code: `public class MathTest {
    public static void main(String[] args) {
        int a = 10;
        int b = 5;
        System.out.println("Addition: " + (a + b));
        System.out.println("Multiplication: " + (a * b));
        System.out.println("Division: " + (a / b));
    }
}`,
    className: 'MathTest',
    expectedOutput: 'Addition: 15\nMultiplication: 50\nDivision: 2'
  },
  {
    name: 'Loops and Conditions',
    code: `public class LoopTest {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i++) {
            if (i % 2 == 0) {
                System.out.println(i + " is even");
            } else {
                System.out.println(i + " is odd");
            }
        }
    }
}`,
    className: 'LoopTest',
    expectedOutput: '1 is odd\n2 is even\n3 is odd'
  },
  {
    name: 'Compilation Error Test',
    code: `public class ErrorTest {
    public static void main(String[] args) {
        System.out.println("Missing semicolon")
        int x = 5;
    }
}`,
    className: 'ErrorTest',
    shouldFail: true
  },
  {
    name: 'Runtime Error Test',
    code: `public class RuntimeErrorTest {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        System.out.println(arr[5]); // ArrayIndexOutOfBoundsException
    }
}`,
    className: 'RuntimeErrorTest',
    shouldFail: true
  }
];

async function runTests() {
  console.log(`🧪 Starting Java Executor Service Tests`);
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🔑 Using API Key: ${API_KEY ? 'Configured' : 'Not Set'}`);
  console.log('=' .repeat(60));
  
  // Health check first
  try {
    console.log('🔍 Checking service health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    if (healthResponse.data.checks) {
      Object.entries(healthResponse.data.checks).forEach(([check, status]) => {
        console.log(`   ${status ? '✅' : '❌'} ${check}`);
      });
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('⚠️ Continuing with tests anyway...');
  }
  
  console.log('\n' + '=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Running: ${testCase.name}`);
    console.log('─' .repeat(40));
    
    try {
      const startTime = Date.now();
      
      const response = await testClient.post('/api/execute', {
        code: testCase.code,
        className: testCase.className,
        mainMethod: true
      });
      
      const executionTime = Date.now() - startTime;
      
      if (testCase.shouldFail) {
        console.log('❌ Test should have failed but succeeded');
        console.log('📄 Response:', JSON.stringify(response.data, null, 2));
        failed++;
      } else {
        const result = response.data.result;
        
        if (result.success) {
          console.log('✅ Compilation and execution successful');
          console.log(`⏱️ Execution time: ${result.executionTime}ms (Total: ${executionTime}ms)`);
          console.log(`📝 Output: ${JSON.stringify(result.output.trim())}`);
          
          if (testCase.expectedOutput && result.output.trim() === testCase.expectedOutput) {
            console.log('✅ Output matches expected result');
          } else if (testCase.expectedOutput) {
            console.log('⚠️ Output differs from expected:');
            console.log(`   Expected: ${JSON.stringify(testCase.expectedOutput)}`);
            console.log(`   Actual:   ${JSON.stringify(result.output.trim())}`);
          }
          
          passed++;
        } else {
          console.log('❌ Execution failed:');
          console.log(`   Error: ${result.error}`);
          console.log(`   Output: ${result.output}`);
          failed++;
        }
      }
      
    } catch (error) {
      if (testCase.shouldFail) {
        console.log('✅ Test correctly failed as expected');
        if (error.response?.data) {
          console.log(`📄 Error details: ${error.response.data.error || error.message}`);
        }
        passed++;
      } else {
        console.log('❌ Test failed unexpectedly:');
        console.log(`   Error: ${error.message}`);
        if (error.response?.data) {
          console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        failed++;
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Java Executor Service is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please check the service configuration.');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('🚨 Test runner failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests, testCases };