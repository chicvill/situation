# Node.js + Python 모두 사용 가능한 베이스 이미지
FROM node:20-slim AS frontend-builder

WORKDIR /app/situation-room
COPY situation-room/package*.json ./
RUN npm install
COPY situation-room/ ./
RUN npm run build

# Python 백엔드 이미지
FROM python:3.11-slim

WORKDIR /app

# 프론트엔드 빌드 결과물 복사
COPY --from=frontend-builder /app/situation-room/dist ./situation-room/dist

# 백엔드 의존성 설치
COPY situation-backend/requirements.txt ./situation-backend/
RUN pip install --no-cache-dir -r ./situation-backend/requirements.txt

# 백엔드 소스 복사
COPY situation-backend/ ./situation-backend/

# .env 파일 복사 (있을 경우)
COPY .env* ./

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "situation-backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
