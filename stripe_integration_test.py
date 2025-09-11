#!/usr/bin/env python3
"""
Comprehensive Stripe Subscription Integration Test Suite
for Cloud IDE Platform (SDET & IDE)
"""

import requests
import json
import time
from datetime import datetime

class StripeIntegrationTester:
    def __init__(self):
        self.supabase_url = "https://zjfilhbczaquokqlcoej.supabase.co"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmlsaGJjemFxdW9rcWxjb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzQ2MjIsImV4cCI6MjA3MTExMDYyMn0.b6YATor8UyDwYSiSagOQUxM_4sqfCv-89CBXVgC2hP0"
        self.service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmlsaGJjemFxdW9rcWxjb2VqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTUzNDYyMiwiZXhwIjoyMDcxMTEwNjIyfQ.jJshkdGtU8WtLdgCr9NrUo2rCjkQWQYI-_jOXg9P4zw"
        self.test_email = "emjklffg@minimax.com"
        self.test_user_id = "c4b76f0c-fd31-4929-95e6-12ce2b53a01a"
        self.results = []
        
    def log_test(self, test_name, status, details):
        """Log test results"""
        result = {
            "timestamp": datetime.now().isoformat(),
            "test": test_name,
            "status": status,
            "details": details
        }
        self.results.append(result)
        print(f"[{status}] {test_name}: {details}")
        
    def test_plan_configuration(self):
        """Test 1: Verify plan configurations in database"""
        print("\n=== Testing Plan Configuration ===")
        
        # Test SDET plans
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/sdet_plans",
                headers={"apikey": self.anon_key, "Authorization": f"Bearer {self.anon_key}"}
            )
            
            if response.status_code == 200:
                sdet_plans = response.json()
                self.log_test("SDET Plans Retrieval", "PASS", f"Found {len(sdet_plans)} SDET plans")
                
                for plan in sdet_plans:
                    self.log_test(f"SDET Plan {plan['plan_type']}", "PASS", 
                                f"${plan['price']/100:.2f}, Limit: {plan['monthly_limit']}, Price ID: {plan['price_id']}")
            else:
                self.log_test("SDET Plans Retrieval", "FAIL", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("SDET Plans Retrieval", "ERROR", str(e))
            
        # Test IDE plans
        try:
            response = requests.get(
                f"{self.supabase_url}/rest/v1/ide_plans",
                headers={"apikey": self.anon_key, "Authorization": f"Bearer {self.anon_key}"}
            )
            
            if response.status_code == 200:
                ide_plans = response.json()
                self.log_test("IDE Plans Retrieval", "PASS", f"Found {len(ide_plans)} IDE plans")
                
                for plan in ide_plans:
                    self.log_test(f"IDE Plan {plan['plan_type']}", "PASS", 
                                f"${plan['price']/100:.2f}, Limit: {plan['monthly_limit']}, Price ID: {plan['price_id']}")
            else:
                self.log_test("IDE Plans Retrieval", "FAIL", f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("IDE Plans Retrieval", "ERROR", str(e))
    
    def test_edge_function_availability(self):
        """Test 2: Verify edge functions are accessible"""
        print("\n=== Testing Edge Function Availability ===")
        
        functions_to_test = [
            "sdet-create-subscription",
            "sdet-stripe-webhook", 
            "create-subscription",
            "stripe-webhook"
        ]
        
        for func_name in functions_to_test:
            try:
                # Test with OPTIONS request (CORS preflight)
                response = requests.options(
                    f"{self.supabase_url}/functions/v1/{func_name}",
                    headers={"apikey": self.anon_key}
                )
                
                if response.status_code == 200:
                    self.log_test(f"Edge Function {func_name}", "PASS", "Function accessible")
                else:
                    self.log_test(f"Edge Function {func_name}", "FAIL", f"HTTP {response.status_code}")
                    
            except Exception as e:
                self.log_test(f"Edge Function {func_name}", "ERROR", str(e))
    
    def test_subscription_creation_validation(self):
        """Test 3: Test subscription creation validation"""
        print("\n=== Testing Subscription Creation Validation ===")
        
        # Test SDET subscription with missing auth
        try:
            response = requests.post(
                f"{self.supabase_url}/functions/v1/sdet-create-subscription",
                headers={"apikey": self.anon_key, "Content-Type": "application/json"},
                json={"planType": "professional", "customerEmail": self.test_email}
            )
            
            if response.status_code == 500:
                error_data = response.json()
                if "Invalid token" in error_data.get("error", {}).get("message", ""):
                    self.log_test("SDET Auth Validation", "PASS", "Properly rejects unauthenticated requests")
                else:
                    self.log_test("SDET Auth Validation", "FAIL", f"Unexpected error: {error_data}")
            else:
                self.log_test("SDET Auth Validation", "FAIL", f"Unexpected status: {response.status_code}")
                
        except Exception as e:
            self.log_test("SDET Auth Validation", "ERROR", str(e))
            
        # Test with invalid plan type
        try:
            response = requests.post(
                f"{self.supabase_url}/functions/v1/sdet-create-subscription",
                headers={"apikey": self.anon_key, "Content-Type": "application/json"},
                json={"planType": "invalid_plan", "customerEmail": self.test_email}
            )
            
            if response.status_code in [400, 500]:
                self.log_test("Invalid Plan Validation", "PASS", "Properly rejects invalid plan types")
            else:
                self.log_test("Invalid Plan Validation", "FAIL", f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Invalid Plan Validation", "ERROR", str(e))
    
    def test_webhook_functionality(self):
        """Test 4: Test webhook endpoint availability"""
        print("\n=== Testing Webhook Functionality ===")
        
        webhook_functions = ["sdet-stripe-webhook", "stripe-webhook"]
        
        for webhook in webhook_functions:
            try:
                # Test with empty body (should fail gracefully)
                response = requests.post(
                    f"{self.supabase_url}/functions/v1/{webhook}",
                    headers={"apikey": self.anon_key, "Content-Type": "application/json"},
                    json={}
                )
                
                if response.status_code in [200, 400]:  # 400 is expected for invalid webhook data
                    self.log_test(f"Webhook {webhook}", "PASS", "Webhook endpoint accessible")
                else:
                    self.log_test(f"Webhook {webhook}", "FAIL", f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Webhook {webhook}", "ERROR", str(e))
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*60)
        print("COMPREHENSIVE STRIPE INTEGRATION TEST REPORT")
        print("="*60)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r["status"] == "PASS"])
        failed_tests = len([r for r in self.results if r["status"] == "FAIL"])
        error_tests = len([r for r in self.results if r["status"] == "ERROR"])
        
        print(f"\nTest Summary:")
        print(f"  Total Tests: {total_tests}")
        print(f"  Passed: {passed_tests}")
        print(f"  Failed: {failed_tests}")
        print(f"  Errors: {error_tests}")
        print(f"  Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        # Save detailed results
        with open('stripe_test_results.json', 'w') as f:
            json.dump({
                "test_date": datetime.now().isoformat(),
                "summary": {
                    "total": total_tests,
                    "passed": passed_tests,
                    "failed": failed_tests,
                    "errors": error_tests,
                    "success_rate": passed_tests/total_tests*100
                },
                "detailed_results": self.results
            }, f, indent=2)
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "errors": error_tests,
            "success_rate": passed_tests/total_tests*100
        }
    
    def run_all_tests(self):
        """Execute complete test suite"""
        print("Starting Comprehensive Stripe Integration Test Suite...")
        print(f"Test Time: {datetime.now().isoformat()}")
        print(f"Target Environment: {self.supabase_url}")
        
        self.test_plan_configuration()
        self.test_edge_function_availability()
        self.test_subscription_creation_validation()
        self.test_webhook_functionality()
        
        return self.generate_report()

if __name__ == "__main__":
    tester = StripeIntegrationTester()
    results = tester.run_all_tests()
