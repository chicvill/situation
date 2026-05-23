"""
서버 실행 진입점 — HiveMQ TLS 호환을 위해 uvicorn 시작 전 SelectorEventLoop 강제 설정
"""
import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    uvicorn.run('session.main:app', host='0.0.0.0', port=port, reload=False)
