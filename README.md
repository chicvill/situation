# 🌐 Situation (지능형 매장 통합 운영 시스템)

커피숍, 식당 등의 매장에서 고객의 스마트폰으로 QR 코드를 스캔하여 **주문, 호출, 주차, 대기, 결제** 등을 처리할 수 있는 SaaS 기반의 지능형 통합 매장 관리 솔루션입니다.

## 🚀 주요 특징 (Key Features)

- **QR 기반 고객 서비스**: 고객이 자신의 스마트폰으로 직접 QR 코드를 스캔하여 모든 서비스를 이용할 수 있는 무인/반무인 매장에 최적화된 UX 제공.
- **AI 지능형 운영 (AI Knowledge Pool)**: 자연어 처리 API (`/api/situation`)를 통해 고객의 요청을 해석하고 시스템의 정형화된 상태(Bundle)로 변환하는 지능형 시스템 탑재.
- **실시간 상태 동기화**: MQTT 프로토콜 기반의 실시간 스트리밍을 통해 매장 내 모든 마이크로 UI(주방 디스플레이, 카운터 패드 등) 간의 상태를 지연 없이 동기화.
- **CodeLess 논리 매트릭스**: 하드코딩을 배제하고 `master_config` (JSON) 매장 설정 파일과 DB 템플릿에 기반하여 매장의 운영 규칙과 비즈니스 분기를 유연하게 제어.

## 🏗️ 시스템 아키텍처 (Architecture)

본 시스템은 4대 핵심 아키텍처 원칙을 기반으로 설계되었습니다.

1. **CodeLess 논리 매트릭스 (Logic Matrix)**
   - 설정 중심 설계 (Config-driven) 및 상태 제어 머신 연동
2. **AI Knowledge Pool (중앙 지식 저장소)**
   - 프론트-백엔드 간 엄격한 타입 무결성 유지 및 MQTT 실시간 스트리밍
3. **객체 수명 주기 관리 (Object Lifecycle)**
   - `pending` → `cooking` → `ready` → `served` → `paid` → `archived` 의 엄격한 상태 전이
   - 데이터 보존 시 물리적 삭제가 아닌 아카이빙(Soft Delete) 원칙 적용
4. **대화형 UX & 마이크로 UI**
   - KitchenDisplay, CounterPad, CallManager 등 13개 이상의 독립적 마이크로 UI 

## 🛠️ 기술 스택 (Tech Stack)

### Backend (`/situation-backend`)
- **Language**: Python 3
- **Framework**: FastAPI (추정)
- **Real-time/Messaging**: MQTT (`mosquitto`)
- **AI/Logic**: 자연어 해석 및 상태 변환 메커니즘 통합

### Frontend (`/situation-room`)
- **Core**: React 19, TypeScript, Vite
- **Styling/UI Component**: MUI (Material-UI) v9, Emotion
- **State/Real-time**: MQTT Client (`mqtt` package)

## 🏃 실행 방법 (How to Run)

프로젝트 루트 디렉토리에 포함된 배치 스크립트를 통해 전체 시스템 및 백엔드를 쉽게 제어할 수 있습니다.

- **전체 시스템 시작**: `run.bat` 또는 `start_system.bat`
- **시드 데이터 주입**: `seed.bat` (테스트용 기초 데이터 생성)
- **환경 업데이트 및 실행**: `update_and_run.bat`

## 🧪 테스트 및 무결성 검증 (Testing & CI)

기능 변경 시 매장 설정과 E2E 시나리오에 부작용(Regression)이 발생하지 않도록, 코드 수정 전/후로 아래의 자동화 하네스를 실행하여 무결성을 검증하세요:

```powershell
python scripts/verify_regression.py
```

## 📖 참고 문서 (Documentation)
추가적인 정보는 프로젝트 루트에 포함된 아래의 문서들을 참조하십시오:
- `skill.md`: 시스템 아키텍처 개발 원칙 및 통합 검증 워크플로우 지침
- `store_owner_manual.docx`: 매장 점주용 시스템 운영 매뉴얼
- `사업계획서_그레이스_하이테크_커피_v2.docx`: 비즈니스 및 도입 기획안
- `지능형_운영_시스템_연구_논문.docx`: 기반 기술 연구 논문
