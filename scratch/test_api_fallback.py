import requests
import os

def main():
    url = "http://127.0.0.1:8001/api/analyze-image?doc_type=menu"
    img_path = os.path.join(os.path.dirname(__file__), '..', '그레이스 커피.jpg')
    
    if not os.path.exists(img_path):
        print(f"Image not found at {img_path}")
        return
        
    print(f"Sending POST request to {url}...")
    try:
        with open(img_path, 'rb') as f:
            files = {'file': ('그레이스 커피.jpg', f, 'image/jpeg')}
            response = requests.post(url, files=files)
            
        print(f"Status Code: {response.status_code}")
        print("Response JSON:")
        print(response.json())
    except Exception as e:
        print("API request failed:", e)

if __name__ == '__main__':
    main()
