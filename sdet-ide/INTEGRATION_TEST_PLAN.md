# SDET IDE Java Execution - Integration Test Plan

## Test Environment Setup

### Prerequisites
1. SDET IDE deployed and accessible
2. Java execution microservice deployed and running
3. Browser with developer tools access
4. Test Java code samples prepared

### Test Configuration
```bash
# Microservice URL (update as needed)
JAVA_MICROSERVICE_URL="https://java-executor-service.railway.app"

# IDE URL (update as needed) 
SDET_IDE_URL="https://sdet-ide.your-domain.com"
```

## Integration Test Suite

### Phase 1: Microservice Connectivity

#### Test 1.1: Service Health Check
**Objective**: Verify microservice is accessible and healthy

**Steps**:
1. Open SDET IDE in browser
2. Create or open a Java file
3. Look for "Java Execution Service" status panel
4. Verify status shows "Online" with green indicator
5. Click "Refresh" button to test manual health check

**Expected Results**:
- ✅ Service status displays correctly
- ✅ Green "Online" indicator
- ✅ Timestamp shows recent check
- ✅ No error messages

**Failure Scenarios**:
- ❌ Red "Offline" indicator → Check microservice deployment
- ❌ Error message → Check network connectivity/CORS
- ❌ No status panel → Check if Java file is selected

#### Test 1.2: Service Status Details
**Objective**: Verify detailed status information

**Steps**:
1. Open browser developer tools (F12)
2. Go to Console tab
3. In SDET IDE, open a Java file
4. Check console for health check logs

**Expected Console Output**:
```
Using Java execution microservice for Java code
Executing Java code via microservice: { className: "...", codeLength: ..., timeout: 30000, memoryLimit: "256m" }
```

### Phase 2: Java Code Execution

#### Test 2.1: Simple Hello World
**Objective**: Test basic Java program execution

**Test Code**:
```java
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello from SDET IDE!");
        System.out.println("Java microservice integration successful!");
    }
}
```

**Steps**:
1. Create new Java file named "HelloWorld.java"
2. Paste the test code
3. Click "Run Program" button
4. Wait for execution to complete
5. Check output panel

**Expected Results**:
- ✅ "Run Program" button available (not "Run Tests")
- ✅ Execution completes within 5-10 seconds
- ✅ Output shows both println statements
- ✅ Success indicator (green checkmark)
- ✅ Execution time displayed

#### Test 2.2: Mathematical Calculations
**Objective**: Test program with computations

**Test Code**:
```java
public class MathCalculator {
    public static void main(String[] args) {
        int a = 15;
        int b = 25;
        
        System.out.println("Sum: " + (a + b));
        System.out.println("Product: " + (a * b));
        System.out.println("Division: " + (b / a));
        
        // Test floating point
        double pi = 3.14159;
        double radius = 5.0;
        double area = pi * radius * radius;
        
        System.out.println("Circle area: " + area);
    }
}
```

**Expected Results**:
- ✅ Output: "Sum: 40"
- ✅ Output: "Product: 375"
- ✅ Output: "Division: 1"
- ✅ Output: "Circle area: 78.53975"

#### Test 2.3: Command Line Arguments
**Objective**: Test program that expects arguments

**Test Code**:
```java
public class ArgumentTest {
    public static void main(String[] args) {
        System.out.println("Number of arguments: " + args.length);
        
        if (args.length > 0) {
            System.out.println("First argument: " + args[0]);
        } else {
            System.out.println("No arguments provided");
        }
        
        for (int i = 0; i < args.length; i++) {
            System.out.println("args[" + i + "] = " + args[i]);
        }
    }
}
```

**Expected Results**:
- ✅ Output: "Number of arguments: 0"
- ✅ Output: "No arguments provided"

### Phase 3: Error Handling

#### Test 3.1: Compilation Error
**Objective**: Test handling of Java compilation errors

**Test Code**:
```java
public class CompileError {
    public static void main(String[] args) {
        System.out.println("This line is missing a semicolon")
        System.out.println("This will cause compilation to fail");
    }
}
```

**Steps**:
1. Create Java file with above code
2. Click "Run Program"
3. Check error handling

**Expected Results**:
- ❌ Red error indicator
- ❌ "Compilation Error" in output
- ✅ Helpful error message about semicolon
- ✅ "Java Compilation Tips" section
- ✅ No application crash

#### Test 3.2: Runtime Exception
**Objective**: Test handling of Java runtime errors

**Test Code**:
```java
public class RuntimeError {
    public static void main(String[] args) {
        System.out.println("Starting program...");
        
        int[] numbers = {1, 2, 3, 4, 5};
        
        // This will cause ArrayIndexOutOfBoundsException
        System.out.println("Accessing element: " + numbers[10]);
        
        System.out.println("This line won't be reached");
    }
}
```

**Expected Results**:
- ✅ Output: "Starting program..."
- ❌ Runtime error indicator
- ✅ Exception details in output
- ✅ "Java Execution Tips" section

#### Test 3.3: Infinite Loop Protection
**Objective**: Test timeout handling

**Test Code**:
```java
public class InfiniteLoop {
    public static void main(String[] args) {
        System.out.println("Starting infinite loop test...");
        
        int counter = 0;
        while (true) {
            counter++;
            // This will run until timeout
            if (counter % 1000000 == 0) {
                System.out.println("Counter: " + counter);
            }
        }
    }
}
```

**Expected Results**:
- ✅ Initial output appears
- ✅ Execution stops after ~30 seconds
- ✅ Timeout error message
- ✅ "Timeout Suggestions" in output

### Phase 4: Language Detection

#### Test 4.1: Test vs Program Detection
**Objective**: Verify correct classification of Java files

**Test Case A - Program with Main**:
```java
public class MyProgram {
    public static void main(String[] args) {
        System.out.println("This is a program");
    }
}
```
*Expected*: "Run Program" button

**Test Case B - JUnit Test**:
```java
import org.junit.Test;
import static org.junit.Assert.*;

public class MyTest {
    @Test
    public void testSomething() {
        assertEquals(2, 1 + 1);
    }
}
```
*Expected*: "Run Tests" button

**Test Case C - Program with Test Methods (Edge Case)**:
```java
public class TestUtility {
    public static void main(String[] args) {
        System.out.println("This has main method, so it's a program");
    }
    
    public void testHelper() {
        // This is just a helper method, not a test
    }
}
```
*Expected*: "Run Program" button (main method takes priority)

### Phase 5: Non-Java Language Compatibility

#### Test 5.1: Python Execution
**Objective**: Ensure non-Java languages still work

**Test Code** (Python file):
```python
print("Hello from Python!")
print("Non-Java execution still works")

for i in range(3):
    print(f"Count: {i}")
```

**Expected Results**:
- ✅ No Java service status panel
- ✅ Execution uses original Supabase function
- ✅ Output appears correctly
- ✅ "Run Script" button text

#### Test 5.2: JavaScript Execution
**Test Code** (JavaScript file):
```javascript
console.log("Hello from JavaScript!");
console.log("Testing compatibility...");

for (let i = 0; i < 3; i++) {
    console.log(`Iteration: ${i}`);
}
```

**Expected Results**:
- ✅ "Execute Code" button
- ✅ Uses original execution path
- ✅ Output displayed correctly

### Phase 6: Performance Testing

#### Test 6.1: Execution Speed
**Objective**: Measure execution performance

**Method**:
1. Execute same Java program 5 times
2. Record execution times
3. Calculate average

**Acceptance Criteria**:
- Average execution time < 10 seconds
- No execution takes > 15 seconds
- Time includes compilation + execution

#### Test 6.2: Concurrent Execution
**Objective**: Test multiple simultaneous executions

**Method**:
1. Open SDET IDE in 3 different browser tabs
2. Execute different Java programs simultaneously
3. Verify all complete successfully

**Expected Results**:
- ✅ All executions complete
- ✅ No "too many concurrent executions" errors
- ✅ Reasonable performance maintained

### Phase 7: Network Error Simulation

#### Test 7.1: Microservice Offline
**Objective**: Test behavior when microservice is unavailable

**Simulation Method**:
1. Block network access to microservice URL
2. Or temporarily stop microservice
3. Attempt Java code execution

**Expected Results**:
- ❌ "Offline" status indicator
- ✅ Graceful error handling
- ✅ Informative error message
- ✅ Suggestion to try again later
- ✅ No application crash

#### Test 7.2: Network Timeout
**Simulation**: Use slow network connection

**Expected Results**:
- ✅ Timeout after 45 seconds
- ✅ Clear timeout error message
- ✅ Application remains responsive

## Test Results Documentation

### Test Execution Log
```
Test Suite: SDET IDE Java Integration
Date: _______________
Tester: _____________
Environment: ________

[ ] Phase 1: Microservice Connectivity
    [ ] 1.1 Service Health Check
    [ ] 1.2 Service Status Details

[ ] Phase 2: Java Code Execution  
    [ ] 2.1 Simple Hello World
    [ ] 2.2 Mathematical Calculations
    [ ] 2.3 Command Line Arguments

[ ] Phase 3: Error Handling
    [ ] 3.1 Compilation Error
    [ ] 3.2 Runtime Exception  
    [ ] 3.3 Infinite Loop Protection

[ ] Phase 4: Language Detection
    [ ] 4.1 Test vs Program Detection

[ ] Phase 5: Non-Java Compatibility
    [ ] 5.1 Python Execution
    [ ] 5.2 JavaScript Execution

[ ] Phase 6: Performance Testing
    [ ] 6.1 Execution Speed
    [ ] 6.2 Concurrent Execution

[ ] Phase 7: Network Error Simulation
    [ ] 7.1 Microservice Offline
    [ ] 7.2 Network Timeout

Overall Result: [ ] PASS [ ] FAIL
Notes: _________________________________
```

### Success Criteria

**Integration Successful If**:
- ✅ 95% of test cases pass
- ✅ Java execution works reliably
- ✅ Error handling is graceful
- ✅ Non-Java languages unaffected
- ✅ Performance is acceptable
- ✅ Network issues handled well

**Critical Failure Indicators**:
- ❌ Java execution always fails
- ❌ Application crashes on errors
- ❌ Non-Java execution broken
- ❌ Microservice always unreachable

---

**Test Plan Version**: 1.0  
**Author**: MiniMax Agent  
**Last Updated**: 2025-09-11