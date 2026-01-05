import requests

# Configuration
API_URL = "https://api.example.com/endpoint"  # Replace with your target URL

# Credentials
headers = {
    "Client-ID": "dH1Xed1fpITYonugor6sw39jvdq58M3h",
    "Authorization": "OAuth 2-310286-92172367-WPpVc4VRL7UmlRO",
    "Content-Type": "application/json"
}

def make_request():
    try:
        response = requests.get(API_URL, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    data = make_request()
    if data:
        print(data)
