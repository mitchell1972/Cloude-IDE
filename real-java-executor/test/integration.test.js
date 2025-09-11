const request = require('supertest');
const app = require('../index');

describe('Real Java Executor Service', () => {
  const apiKey = process.env.API_KEY || 'test-key';
  
  describe('Health Checks', () => {
    test('GET /api/health should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
    });
    
    test('GET /api/health/detailed should return detailed health', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('checks');
    });
    
    test('GET /api/health/java should return Java-specific health', async () => {
      const response = await request(app)
        .get('/api/health/java')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('java');
      expect(response.body.java).toHaveProperty('runtime');
      expect(response.body.java).toHaveProperty('compiler');
    });
  });
  
  describe('Java Compilation and Execution', () => {
    test('POST /api/compile-and-run should compile and execute simple Java code', async () => {
      const javaCode = `
public class HelloTest {
    public static void main(String[] args) {
        System.out.println("Hello, Real Java!");
        System.out.println("Test successful!");
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: javaCode,
          className: 'HelloTest',
          mainMethod: true,
          timeout: 30000
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('output');
      expect(response.body.result.output).toContain('Hello, Real Java!');
      expect(response.body.result.output).toContain('Test successful!');
    }, 30000);
    
    test('POST /api/compile-and-run should handle compilation errors', async () => {
      const invalidJavaCode = `
public class ErrorTest {
    public static void main(String[] args) {
        System.out.println("Missing semicolon")
        int x = 5;
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: invalidJavaCode,
          className: 'ErrorTest'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('success', false);
      expect(response.body.result).toHaveProperty('compilationError', true);
      expect(response.body.result).toHaveProperty('stderr');
      expect(response.body.result.stderr).toContain('error');
    }, 15000);
    
    test('POST /api/compile-and-run should execute complex Java code', async () => {
      const complexJavaCode = `
public class ComplexTest {
    public static void main(String[] args) {
        // Test variables and arithmetic
        int a = 10;
        int b = 5;
        System.out.println("Addition: " + (a + b));
        System.out.println("Multiplication: " + (a * b));
        
        // Test loops
        for (int i = 1; i <= 3; i++) {
            System.out.println("Loop iteration: " + i);
        }
        
        // Test conditionals
        if (a > b) {
            System.out.println("a is greater than b");
        }
        
        // Test method calls
        String message = getMessage();
        System.out.println(message);
    }
    
    public static String getMessage() {
        return "Method call successful";
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: complexJavaCode,
          className: 'ComplexTest'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('success', true);
      expect(response.body.result.output).toContain('Addition: 15');
      expect(response.body.result.output).toContain('Multiplication: 50');
      expect(response.body.result.output).toContain('Loop iteration: 1');
      expect(response.body.result.output).toContain('Loop iteration: 2');
      expect(response.body.result.output).toContain('Loop iteration: 3');
      expect(response.body.result.output).toContain('a is greater than b');
      expect(response.body.result.output).toContain('Method call successful');
    }, 30000);
    
    test('POST /api/compile-only should compile without execution', async () => {
      const javaCode = `
public class CompileOnlyTest {
    public static void main(String[] args) {
        System.out.println("This should not execute");
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-only')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: javaCode,
          className: 'CompileOnlyTest'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('compilationId');
      expect(response.body.result).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('compilationTime');
      expect(response.body.result.compilationTime).toBeGreaterThan(0);
    }, 15000);
  });
  
  describe('Authentication and Validation', () => {
    test('POST /api/compile-and-run should require authentication', async () => {
      const response = await request(app)
        .post('/api/compile-and-run')
        .send({
          code: 'public class Test {}',
          className: 'Test'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('POST /api/compile-and-run should validate input', async () => {
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          // Missing required code field
          className: 'Test'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
    
    test('POST /api/compile-and-run should block dangerous code', async () => {
      const dangerousCode = `
public class DangerousTest {
    public static void main(String[] args) {
        Runtime.getRuntime().exec("rm -rf /");
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: dangerousCode,
          className: 'DangerousTest'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('dangerous operations');
    });
  });
  
  describe('System Endpoints', () => {
    test('GET /api/status should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Authorization', `Bearer ${apiKey}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status', 'operational');
      expect(response.body).toHaveProperty('java');
    });
    
    test('GET /api/stats should return statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);
      
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('configuration');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle runtime errors gracefully', async () => {
      const runtimeErrorCode = `
public class RuntimeErrorTest {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        System.out.println(arr[10]); // ArrayIndexOutOfBoundsException
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: runtimeErrorCode,
          className: 'RuntimeErrorTest'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('success', false);
      expect(response.body.result).toHaveProperty('runtimeError', true);
      expect(response.body.result).toHaveProperty('stderr');
      expect(response.body.result.stderr).toContain('Exception');
    }, 30000);
    
    test('should handle infinite loops with timeout', async () => {
      const infiniteLoopCode = `
public class InfiniteLoopTest {
    public static void main(String[] args) {
        while (true) {
            // Infinite loop
        }
    }
}
      `.trim();
      
      const response = await request(app)
        .post('/api/compile-and-run')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          code: infiniteLoopCode,
          className: 'InfiniteLoopTest',
          timeout: 5000 // 5 second timeout
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.result).toHaveProperty('success', false);
      expect(response.body.result.stderr).toContain('timeout');
    }, 10000);
  });
});