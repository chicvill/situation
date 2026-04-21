import os
import subprocess
import time
import sys

def run_servers():
    # Base directory set to the project root
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "situation-backend")
    frontend_dir = os.path.join(base_dir, "situation-room")
    venv_dir = os.path.join(base_dir, "venv")

    print("\n" + "="*50)
    print("🛡️  Antigravity System Guardian Mode: 가동 시작")
    print("="*50)

    # 1. 가상환경 체크 및 패키지 설치
    if not os.path.exists(venv_dir):
        print("\n📦 가상환경(venv)이 발견되지 않아 새로 생성합니다...")
        try:
            subprocess.run(["py", "-m", "venv", "venv"], check=True)
            print("✅ 가상환경 생성 완료.")
        except Exception as e:
            print(f"❌ 가상환경 생성 실패: {e}")
            return

    # 필수 패키지 설치 여부 확인 및 설치
    pip_path = os.path.join(venv_dir, "Scripts", "pip.exe")
    print("\n📚 필수 라이브러리 상태를 확인하고 필요시 설치합니다...")
    packages = ["fastapi", "uvicorn", "google-generativeai", "pydantic", "python-dotenv", "openai", "psycopg2-binary"]
    try:
        subprocess.run([pip_path, "install"] + packages, check=True)
        print("✅ 라이브러리 준비 완료.")
    except Exception as e:
        print(f"⚠️ 패키지 설치 중 일부 오류가 발생했을 수 있습니다: {e}")

    # Check if Windows Terminal (wt.exe) is available for tab/pane support
    import shutil
    use_wt = shutil.which("wt.exe") is not None
    activate_script = os.path.join(venv_dir, "Scripts", "Activate.ps1")

    # 2. 가상환경, 백엔드, 프론트엔드 3개의 탭 정의
    commands = [
        ("가상환경", f"echo '🛡️ MQnet System Management'; . '{activate_script}'; ls", base_dir),
        ("Backend", f". '{activate_script}'; uvicorn main:app --reload --host 0.0.0.0", backend_dir),
        ("Frontend", "npm run dev", frontend_dir)
    ]

    print("\n🚀 서버 가동을 시작합니다 (3개의 탭 생성)...")

    if use_wt:
        # Windows Terminal에서 3개의 별도 탭(Tab)으로 실행
        wt_args = ["wt"]
        for i, (title, cmd, dir_path) in enumerate(commands):
            if i > 0:
                wt_args.append(";")
            
            wt_args.append("new-tab")
            # WT는 명령줄의 세미콜론(;)을 자신의 구분자로 인식하므로 \; 로 이스케이프해야 합니다.
            escaped_cmd = cmd.replace(";", "\\;")
            wt_args.extend(["-d", dir_path, "--title", title, "powershell", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", escaped_cmd])
        
        try:
            subprocess.Popen(wt_args)
            print("✅ Windows Terminal 3개 탭 가동 완료.")
        except Exception as e:
            print(f"⚠️ WT 실행 실패, 개별 창으로 전환합니다: {e}")
            use_wt = False

    if not use_wt:
        # 개별 창으로 실행 (Fallback)
        for title, cmd, dir_path in commands:
            print(f"🔥 {title} 가동 중...")
            full_cmd = f"cd '{dir_path}'; {cmd}"
            ps_cmd = f"$Host.UI.RawUI.WindowTitle='{title}'; {full_cmd}"
            subprocess.Popen(["powershell", "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", ps_cmd], 
                             creationflags=subprocess.CREATE_NEW_CONSOLE)

    print("\n" + "="*50)
    print("✨ 모든 서비스 가동 명령이 완료되었습니다!")
    print("1. 백엔드: http://127.0.0.1:8000/docs")
    print("2. 프론트엔드: http://localhost:5173")
    print("="*50 + "\n")
    print("사장님, 모든 준비가 끝났습니다. 터미널 창을 닫지 마시고 매장 운영을 시작하세요!\n")

if __name__ == "__main__":
    try:
        run_servers()
    except KeyboardInterrupt:
        print("\n👋 시스템 가동을 중단합니다.")
    except Exception as e:
        print(f"\n❌ 가동 중 오류 발생: {e}")
