import httpx
import asyncio

# The URL of your local API
url = "http://127.0.0.1:8000/events"

# A fake "Noise Report" at Hamilton City Hall
fake_event = {
    "type": "noise",
    "lat": 43.2557,     # Hamilton Latitude
    "lng": -79.8711,    # Hamilton Longitude
    "description": "Loud construction noise test!"
}

async def send_test():
    async with httpx.AsyncClient() as client:
        # 1. POST (Create) the event
        print(f"📡 Sending event to {url}...")
        response = await client.post(url, json=fake_event)
        
        if response.status_code == 200:
            print("✅ Success! Event Saved:")
            print(response.json())
        else:
            print("❌ Error:")
            print(response.text)

if __name__ == "__main__":
    asyncio.run(send_test())