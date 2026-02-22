"""
Quick test script for API endpoints
Run with: python api/test_api.py
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, description):
    """Test an API endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"Endpoint: {endpoint}")
    print('='*60)

    try:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
        response.raise_for_status()
        data = response.json()
        print(f"✅ Status: {response.status_code}")
        print(f"Response preview:")
        print(json.dumps(data, indent=2)[:500] + "..." if len(json.dumps(data)) > 500 else json.dumps(data, indent=2))
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the API running?")
        print("   Start with: uvicorn api.main:app --reload")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Test all endpoints"""
    print("\n" + "🚀 API ENDPOINT TESTS".center(60, "="))

    endpoints = [
        ("/", "Health check"),
        ("/api/regimes/labels", "Get regime labels"),
        ("/api/regimes/current", "Get current regime"),
        ("/api/regimes/history?limit=5", "Get regime history (last 5)"),
        ("/api/predictions/forecast", "Get regime forecast"),
        ("/api/predictions/comparison", "Get model comparison"),
        ("/api/metrics/summary", "Get dashboard metrics"),
        ("/api/features/importance?model=random_forest&top_n=5", "Get feature importances (RF)"),
        ("/api/correlations/matrix", "Get correlation matrix"),
        ("/api/health", "Detailed health check"),
    ]

    results = []
    for endpoint, description in endpoints:
        success = test_endpoint(endpoint, description)
        results.append((description, success))

    # Summary
    print(f"\n\n{'='*60}")
    print("TEST SUMMARY".center(60))
    print('='*60)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for description, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}  {description}")

    print('='*60)
    print(f"Total: {passed}/{total} tests passed")
    print('='*60)

if __name__ == "__main__":
    main()
