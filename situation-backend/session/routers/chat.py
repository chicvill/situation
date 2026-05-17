from typing import Dict
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from ..database import get_situation_history, get_db_conn
import ai_engine

router = APIRouter()


@router.post("/api/analyze-image")
async def analyze_image(doc_type: str = "menu", file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = ai_engine.analyze_document_image(image_bytes, doc_type)
    if "error" in result:
        return JSONResponse(status_code=500, content=result)
    return result


@router.post("/api/chat")
async def chat(data: Dict):
    query = data.get("query")
    if not isinstance(query, str):
        raise HTTPException(status_code=400, detail="query must be a string")
    history = data.get("history", [])
    store_id = data.get("store_id", "store-1")

    # 지식 인벤토리 데이터(최근 상황들) 가져오기
    pool_history = get_situation_history(store_id, limit=50)

    # 매장 고정 매뉴얼 가져오기
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT manual FROM store_configs WHERE store_id = %s", (store_id,))
    row = cur.fetchone()
    manual = row[0] if row else ""
    cur.close()
    conn.close()

    # AI 엔진 호출 (매뉴얼 포함)
    response = ai_engine.analyze_history(query, pool_history, store=store_id, manual=manual)
    return {"response": response}
