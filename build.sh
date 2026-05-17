#!/bin/bash
set -e
# Render Build Script
# Frontend is pre-built locally and committed to git (situation-room/dist/)
# This script only installs Python backend dependencies.

echo "🔎 Python: $(python --version 2>&1)"

echo "📦 Installing backend dependencies..."
cd situation-backend
pip install -r requirements.txt
echo "✅ Backend dependencies installed."
