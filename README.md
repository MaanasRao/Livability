# 🏙️ Livability

> **Real-time community insights, rent heatmaps, and neighborhood reporting for Hamilton, ON.**

Livability is a React Native mobile application designed to help students and residents find the best places to live. It combines static data (rent prices, amenities) with dynamic, crowd-sourced data (safety alerts, noise complaints) to generate a live "Livability Score" for every city block.

## 📱 Features

* **Interactive Heatmap:** A visual grid overlay showing "Livability Scores" (0-10) based on rent prices, proximity to grocery/transit, and industrial zoning.
* **Community Reporting:** Users can drop pins for Safety, Noise, Maintenance, Trash, or Traffic issues.
* **Crowd-Sourced Validation:** A Reddit-style voting system. Reports with low community trust (Score ≤ -3) are automatically removed from the map.
* **Smart Geofencing:** Prevents spam by ensuring reports are actually within Hamilton boundaries (or tagged as "Remote Demo" if testing).
* **Secure Search:** Google Places Autocomplete integrated securely for easy navigation.
* **Anti-Spam Protection:** Rate limiting on the backend preventing abuse of the voting and reporting systems.

## 🛠️ Tech Stack

### Frontend (Mobile)
* **Framework:** React Native (Expo SDK 52)
* **Language:** TypeScript
* **Maps:** `react-native-maps` (Google Maps SDK)
* **Services:** Google Places API, Google Geocoding API
* **State:** React Hooks & Context

### Backend (API)
* **Framework:** Python (FastAPI)
* **Database:** PostgreSQL (Supabase) via SQLAlchemy
* **Security:** `slowapi` (Rate Limiting), API Key Header Authentication
* **Hosting:** AWS EC2 (Ubuntu)

---

## 🚀 Getting Started

Follow these steps to run the project locally.

### 1. Prerequisites
* Node.js & npm
* Python 3.9+
* Expo Go app on your phone (or Android Emulator)

### 2. Backend Setup
The backend handles data persistence and logic.

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # (Windows: venv\Scripts\activate)

# Install dependencies
pip install -r requirements.txt

# Create .env file
touch .env
Add the following to backend/.env:

Properties

DATABASE_URL="postgresql://user:password@host:5432/postgres"
BACKEND_SECRET="my_secure_password_123"
Run the Server:

Bash

uvicorn main:app --reload --host 0.0.0.0 --port 8000
3. Frontend Setup
The mobile app.

```
### 3. 3. Frontend Setup
```
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file (CRITICAL)
touch .env
Add the following to frontend/.env:

Properties

# Public Key (Restricted to Places API)
EXPO_PUBLIC_GOOGLE_SEARCH_KEY=your_google_places_key

# Address of your Python Backend
EXPO_PUBLIC_API_URL=http://localhost:8000 
# (Or your AWS IP if running remotely)

# Must match the Backend Secret above
EXPO_PUBLIC_BACKEND_SECRET="my_secure_password_123"
Run the App:

Bash

npx expo start
Scan the QR code with your phone or press a for Android Emulator.

```

🔒 Security Architecture
This project implements a 3-Key Security System to protect API quotas and data integrity:

Android Map Key (app.json): Restricted via SHA-1 Fingerprint to the specific Android App Bundle.

Search Key (.env): Restricted via API constraints to only allow Place Autocomplete requests.

Backend Secret (.env): A custom handshake password that authenticates the Mobile App to the Python Backend, preventing unauthorized API calls (e.g., Postman attacks).

🤝 Contributing
Fork the repo

Create your feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

📄 License
Distributed under the MIT License. See LICENSE for more information.
