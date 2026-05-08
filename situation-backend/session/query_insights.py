import os
import sys
import json
from datetime import datetime

# 패키지 로컬 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db_conn

def load_distilled_insight_from_db():
    """DB에서 가장 최신의 수확된 정보 알곡 데이터를 로드합니다."""
    conn = get_db_conn()
    if not conn:
        return None
    try:
        from psycopg2.extras import RealDictCursor # type: ignore
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM table_distilled_insights ORDER BY timestamp DESC LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            if isinstance(row['data'], str):
                row['data'] = json.loads(row['data'])
            return row
    except Exception as e:
        print(f"DB조회 실패로 로컬 백업파일 조회를 전환합니다: {e}")
    return None

def load_distilled_insight_from_file():
    """로컬 백업 knowledge_pool.json 파일에서 데이터를 로드합니다."""
    knowledge_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_pool.json")
    if os.path.exists(knowledge_path):
        with open(knowledge_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def extract_financial_report():
    """매출 및 요일별 재무 지식을 일목요연하게 추출합니다."""
    insight = load_distilled_insight_from_db() or load_distilled_insight_from_file()
    if not insight:
        print("❌ 정보 창고에 수확된 데이터가 존재하지 않습니다. 먼저 시뮬레이션을 돌려주세요.")
        return
        
    data = insight.get("data", insight)
    financials = data.get("financials", {})
    
    print("\n" + "📊" * 15 + " [재무 매출 요약 보고서] " + "📊" * 15)
    print(f" - 누적 영업일 매출액: {financials.get('total_revenue', 0):,}원")
    print(f" - 총 주문 처리수: {financials.get('order_count', 0):,}건")
    print(f" - 요일별 매출 현황 명세:")
    
    weekday_splits = financials.get("weekday_revenue_split", {})
    for day, rev in weekday_splits.items():
        gauge = "■" * int(rev / 2000000) if rev else ""
        print(f"   * {day}요일: {rev:12,}원 | {gauge}")
        
    print("\n - 매장 피크 타임 Top 3 시간대:")
    peaks = financials.get("peak_hours", [])
    for hour, rev in peaks:
        print(f"   * {hour:02d}:00 ~ {hour+1:02d}:00 시간대 누적 매출: {rev:12,}원")
    print("="*60 + "\n")

def extract_payroll_report():
    """직원들의 요약 급여 및 근태 상황을 추출합니다."""
    insight = load_distilled_insight_from_db() or load_distilled_insight_from_file()
    if not insight:
        print("❌ 정보 창고에 수확된 데이터가 존재하지 않습니다.")
        return
        
    data = insight.get("data", insight)
    payrolls = data.get("staff_payrolls", [])
    
    print("\n" + "👥" * 15 + " [스태프 인사 정산 보고서] " + "👥" * 15)
    print("이름     | 직급    | 시급      | 총근무시간 | 지각 | 기본급       | 주휴수당     | 원천세(3.3%) | 세후 실수령액")
    print("-" * 110)
    for staff in payrolls:
        print(f"{staff['name']:8} | {staff['role']:7} | {staff['hourly_wage']:8,}원 | {staff['total_hours']:9}h | {staff['tardy_count']:3}회 | {staff['base_wage']:11,}원 | {staff['weekly_holiday_allowance']:11,}원 | {staff['tax_deduction']:11,}원 | {staff['net_payroll']:12,}원")
    print("-" * 110)
    print("💡 주휴수당은 소정근로시간 주 15시간(월 60시간) 이상 근무 시 가산율에 의거 전자동 연산되었습니다.")
    print("=" * 110 + "\n")

def extract_bestsellers_report():
    """베스트셀러 판매량 순위를 추출합니다."""
    insight = load_distilled_insight_from_db() or load_distilled_insight_from_file()
    if not insight:
        print("❌ 정보 창고에 수확된 데이터가 존재하지 않습니다.")
        return
        
    data = insight.get("data", insight)
    bestsellers = data.get("top_best_sellers", [])
    
    print("\n" + "🥇" * 15 + " [품목 매출 및 판매량 랭킹] " + "🥇" * 15)
    for rank, menu in enumerate(bestsellers, 1):
        gauge = "★" * int(menu['count'] / 10)
        print(f"   [{rank}위] {menu['name']:18} | 누적 {menu['count']:3}개 판매 | 누적 매출액: {menu['revenue']:12,}원 | {gauge}")
    print("=" * 60 + "\n")

def extract_ai_consulting():
    """인공지능 비서의 사장님 맞춤 운영 요약 컨설팅 브리핑을 출력합니다."""
    insight = load_distilled_insight_from_db() or load_distilled_insight_from_file()
    if not insight:
        print("❌ 정보 창고에 수확된 데이터가 존재하지 않습니다.")
        return
        
    print("\n" + "🧠" * 15 + " [AI 인공지능 경영 피드백 브리핑] " + "🧠" * 15)
    print(f"📢 제목: {insight.get('title')}")
    print(f"📄 종합 권고문 요약:")
    print(insight.get("summary"))
    print("=" * 60 + "\n")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "sales":
            extract_financial_report()
        elif cmd == "payroll":
            extract_payroll_report()
        elif cmd == "menu":
            extract_bestsellers_report()
        elif cmd == "ai":
            extract_ai_consulting()
        else:
            print("사용법: python query_insights.py [sales | payroll | menu | ai]")
    else:
        # 인자값이 없을 시 종합 출력 브리핑 가동
        extract_financial_report()
        extract_bestsellers_report()
        extract_payroll_report()
        extract_ai_consulting()
