#!/bin/bash
# Render Build Script
# 1. 프론트엔드 빌드
echo "🔨 Building frontend..."
cd situation-room
npm install
npm run build
echo "✅ Frontend built successfully."

# 2. 백엔드 패키지 설치
echo "📦 Installing backend dependencies..."
cd ../situation-backend
pip install -r requirements.txt
echo "✅ Backend dependencies installed."
