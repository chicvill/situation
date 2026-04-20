from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uuid
from ai_engine import parse_situation_text

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SituationRequest(BaseModel):
    text: str

class BundleItem(BaseModel):
    name: str
    value: str

class BundleData(BaseModel):
    id: str
    type: str
    title: str
    timestamp: str
    items: List[BundleItem]

# In-memory "Knowledge Pool" database
knowledge_pool: List[BundleData] = []

@app.post("/api/situation", response_model=BundleData)
async def process_situation(request: SituationRequest):
    print(f"Received Situation: {request.text}")
    # 1. AI Engine processes the text
    ai_result = parse_situation_text(request.text)
    
    # 2. Create the Bundle object
    new_bundle = BundleData(
        id=str(uuid.uuid4()),
        type=ai_result.get("type", "Log"),
        title=ai_result.get("title", "상황 기록"),
        timestamp=ai_result.get("timestamp", ""),
        items=[BundleItem(**item) for item in ai_result.get("items", [])]
    )
    
    # 3. Store in Knowledge Pool
    knowledge_pool.insert(0, new_bundle) # Append to front for newest first
    
    return new_bundle

@app.get("/api/bundles", response_model=List[BundleData])
async def get_bundles():
    return knowledge_pool
