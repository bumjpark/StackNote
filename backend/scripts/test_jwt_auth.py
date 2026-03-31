import requests
import sys
import json

# 테스트용 설정
BASE_URL = "http://localhost:8000"
LOGIN_URL = f"{BASE_URL}/users/login"
SIGNUP_URL = f"{BASE_URL}/users/signup"

def test_jwt_flow(email, password):
    print(f"--- Testing JWT Flow for {email} ---")
    
    # 1. 회원가입 시도 (이미 존재할 수 있음)
    signup_data = {
        "email_id": email,
        "pw": password,
        "nickname": "TestUser"
    }
    print(f"1. Attempting Signup... ", end="")
    try:
        response = requests.post(SIGNUP_URL, json=signup_data)
        if response.status_code == 200:
            print("SUCCESS (New User Created)")
        elif response.status_code == 409:
            print("SUCCESS (User Already Exists)")
        else:
            print(f"FAILED (Status: {response.status_code})")
            print(response.text)
    except Exception as e:
        print(f"ERROR: {e}")
        return

    # 2. 로그인 및 토큰 획득
    login_data = {
        "email_id": email,
        "pw": password
    }
    print(f"2. Attempting Login... ", end="")
    try:
        response = requests.post(LOGIN_URL, json=login_data)
        if response.status_code == 200:
            result = response.json()
            token = result.get("access_token")
            if token:
                print("SUCCESS")
                print(f"   - Access Token: {token[:30]}...")
                print(f"   - Token Type: {result.get('token_type')}")
                return token
            else:
                print("FAILED (Token not found in response)")
                print(json.dumps(result, indent=2))
        else:
            print(f"FAILED (Status: {response.status_code})")
            print(response.text)
    except Exception as e:
        print(f"ERROR: {e}")
    
    return None

if __name__ == "__main__":
    # 사용법 안내
    if len(sys.argv) < 3:
        print("Usage: python3 test_jwt_auth.py <email> <password>")
        print("Example: python3 test_jwt_auth.py test@example.com Password123")
        sys.exit(1)
        
    email = sys.argv[1]
    password = sys.argv[2]
    
    test_jwt_flow(email, password)
