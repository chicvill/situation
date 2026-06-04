# -*- coding: utf-8 -*-
"""
scripts/verify_regression.py — 리그레션 방지 검증 스크립트

이 스크립트는 'A' 모듈(예: 백엔드 API, AI 엔진)을 수정하는 과정에서
'B'와 'C' 모듈(예: 매장 설정 파일, E2E 시나리오 정합성 등)이 
나도 모르게 오작동하거나 훼손되었는지 검증해 주는 자동화 테스트 하네스입니다.

실행 방법:
    python scripts/verify_regression.py
"""

import os
import sys
import json
import subprocess
import urllib.request
import urllib.error

# 색상 정의 (Windows 콘솔 호환 지원)
COLOR_SUCCESS = "\033[92m"
COLOR_WARNING = "\033[93m"
COLOR_FAIL = "\033[91m"
COLOR_RESET = "\033[0m"

# 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "situation-backend")
CONFIG_FILE = os.path.join(BASE_DIR, "master_config_v2_그레이스_하이테크_커피.json")
E2E_TEST_SCRIPT = os.path.join(BACKEND_DIR, "test_e2e.py")
VENV_PYTHON = os.path.join(BASE_DIR, "venv", "Scripts", "python.exe")

def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def check_config_integrity():
    """
    [B 컴포넌트 검증]
    매장 설정 JSON 파일의 파싱 무결성 및 필수 구조 필드를 검증합니다.
    """
    print("🔄 [B 검증] 매장 설정 파일(master_config) 무결성 체크...")
    if not os.path.exists(CONFIG_FILE):
        print(f"{COLOR_FAIL}❌ 실패: 설정 파일이 존재하지 않습니다. ({CONFIG_FILE}){COLOR_RESET}")
        return False

    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 필수 필드 구조 검증 (v2 스펙)
        if "store" not in data or "name" not in data["store"]:
            print(f"{COLOR_FAIL}❌ 실패: 필수 필드 'store.name'이 누락되었습니다.{COLOR_RESET}")
            return False
            
        if "catalog" not in data or "menus" not in data["catalog"]:
            print(f"{COLOR_FAIL}❌ 실패: 필수 필드 'catalog.menus'가 누락되었습니다.{COLOR_RESET}")
            return False

        if "infrastructure" not in data or "devices" not in data["infrastructure"]:
            print(f"{COLOR_FAIL}❌ 실패: 필수 필드 'infrastructure.devices'가 누락되었습니다.{COLOR_RESET}")
            return False
                
        print(f"{COLOR_SUCCESS}✅ 통과: 매장 설정 파일 구조가 안전합니다. ({data['store']['name']}){COLOR_RESET}")
        return True
    except json.JSONDecodeError as e:
        print(f"{COLOR_FAIL}❌ 실패: JSON 파일 문법 오류! {e}{COLOR_RESET}")
        return False
    except Exception as e:
        print(f"{COLOR_FAIL}❌ 실패: {e}{COLOR_RESET}")
        return False

def check_server_running(url="http://localhost:8000"):
    """
    [C 컴포넌트 검증 전제조건]
    백엔드 API 서버가 켜져 있는지 확인합니다.
    """
    print("🔄 [서버 체크] 백엔드 API 서버 동작 여부 확인...")
    try:
        with urllib.request.urlopen(f"{url}/api/debug/state", timeout=2) as response:
            if response.status == 200:
                print(f"{COLOR_SUCCESS}✅ 통과: 백엔드 서버가 온라인 상태입니다.{COLOR_RESET}")
                return True
    except Exception:
        print(f"{COLOR_WARNING}⚠️ 경고: 로컬 백엔드 서버(localhost:8000)에 연결할 수 없습니다.{COLOR_RESET}")
        print("   -> 테스트 실행을 위해 'run.bat' 또는 'start_system.bat'을 사용해 서버를 먼저 구동해 주세요.")
        return False
    return False

def run_e2e_tests():
    """
    [C 컴포넌트 검증]
    E2E 시나리오 하네스를 실행하여 사이드 이펙트(부작용)를 완벽히 차단합니다.
    """
    print("🔄 [C 검증] E2E 테스트 하네스 구동중...")
    if not os.path.exists(E2E_TEST_SCRIPT):
        print(f"{COLOR_FAIL}❌ 실패: test_e2e.py 스크립트가 존재하지 않습니다.{COLOR_RESET}")
        return False

    python_executable = VENV_PYTHON if os.path.exists(VENV_PYTHON) else "python"
    
    try:
        # 백엔드 디렉터리에서 test_e2e.py 실행
        result = subprocess.run(
            [python_executable, E2E_TEST_SCRIPT],
            cwd=BACKEND_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8"
        )
        
        print("\n--- E2E 테스트 출력 ---")
        print(result.stdout)
        if result.stderr:
            print(f"{COLOR_WARNING}에러 출력:{COLOR_RESET}\n{result.stderr}")
        print("----------------------\n")
        
        if result.returncode == 0:
            print(f"{COLOR_SUCCESS}✅ 통과: 모든 E2E 테스트 케이스가 무결하게 통과되었습니다!{COLOR_RESET}")
            return True
        else:
            print(f"{COLOR_FAIL}❌ 실패: E2E 테스트 시나리오 실패 검출. (부작용 발생!){COLOR_RESET}")
            return False
            
    except Exception as e:
        print(f"{COLOR_FAIL}❌ 실패: E2E 테스트 실행 중 장애 발생: {e}{COLOR_RESET}")
        return False

def main():
    print_section("Antigravity 리그레션 검증 시스템 (Harness)")
    
    config_ok = check_config_integrity()
    server_ok = check_server_running()
    
    if not server_ok:
        print(f"\n{COLOR_FAIL}❌ 검증 중단: 백엔드 서버가 실행 중이지 않아 E2E 검증을 진행할 수 없습니다.{COLOR_RESET}")
        sys.exit(1)
        
    e2e_ok = run_e2e_tests()
    
    print_section("최종 리그레션 검증 보고서")
    
    if config_ok and e2e_ok:
        print(f"{COLOR_SUCCESS}🎉 검증 성공: 리그레션 없음!{COLOR_RESET}")
        print("A를 안심하고 커밋 또는 배포하셔도 좋습니다. B와 C는 부작용 없이 안전합니다.")
        sys.exit(0)
    else:
        print(f"{COLOR_FAIL}🚨 검증 실패: 사이드 이펙트 감지됨!{COLOR_RESET}")
        print("수정한 내용이 B 또는 C의 기본 기능에 장애를 유발하고 있습니다. 코드를 롤백하거나 수정하십시오.")
        sys.exit(1)

if __name__ == "__main__":
    main()
