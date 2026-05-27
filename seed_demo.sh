#!/usr/bin/env bash
# ============================================================
# Situation Demo Data Seed Script (UTF-8 safe)
# ============================================================
set -e
BASE="https://situation.chicvill.store"
PW="cbfad02f9ed2a8d1e08d8f74f5303e9eb93637d47f82ab6f1c15871cf8dd0481"

put_bundle() {
  local id="$1"
  local body="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$body" \
    "$BASE/api/bundle/$id")
  if [ "$code" = "200" ]; then
    echo "  OK  $id"
  else
    echo "  FAIL $id (HTTP $code)"
  fi
}

TS=$(date +%s%3N)
next_id() { TS=$((TS+1)); echo "$TS"; }

# ─── Phase 1: PersonalInfos ───────────────────────────────────
echo ""
echo "=== Phase 1: PersonalInfos (점장/점원) ==="

# [store-1] 이민준 점장
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"이민준 점장 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"이민준\"},{\"name\":\"아이디\",\"value\":\"01011000001\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"manager\"}],\"status\":\"approved\",\"store\":\"미소 한식당\",\"store_id\":\"store-1\"}"

# [store-1] 김수아 점원
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"김수아 점원 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"김수아\"},{\"name\":\"아이디\",\"value\":\"01022000001\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"staff\"}],\"status\":\"approved\",\"store\":\"미소 한식당\",\"store_id\":\"store-1\"}"

# [store-2] 박지호 점장
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"박지호 점장 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"박지호\"},{\"name\":\"아이디\",\"value\":\"01011000002\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"manager\"}],\"status\":\"approved\",\"store\":\"블루버드 카페\",\"store_id\":\"store-2\"}"

# [store-2] 최은지 점원
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"최은지 점원 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"최은지\"},{\"name\":\"아이디\",\"value\":\"01022000002\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"staff\"}],\"status\":\"approved\",\"store\":\"블루버드 카페\",\"store_id\":\"store-2\"}"

# [store-3] 정현우 점장
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"정현우 점장 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"정현우\"},{\"name\":\"아이디\",\"value\":\"01011000003\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"manager\"}],\"status\":\"approved\",\"store\":\"나폴리 피자\",\"store_id\":\"store-3\"}"

# [store-3] 강민서 점원
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"강민서 점원 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"강민서\"},{\"name\":\"아이디\",\"value\":\"01022000003\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"staff\"}],\"status\":\"approved\",\"store\":\"나폴리 피자\",\"store_id\":\"store-3\"}"

# [store-Mbh] 한소희 점장
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"한소희 점장 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"한소희\"},{\"name\":\"아이디\",\"value\":\"01011000004\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"manager\"}],\"status\":\"approved\",\"store\":\"일산국밥\",\"store_id\":\"store-Mbh\"}"

# [store-Mbh] 오준혁 점원
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"오준혁 점원 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"오준혁\"},{\"name\":\"아이디\",\"value\":\"01022000004\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"staff\"}],\"status\":\"approved\",\"store\":\"일산국밥\",\"store_id\":\"store-Mbh\"}"

# [store-chicvill] 서채원 점장
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"서채원 점장 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"서채원\"},{\"name\":\"아이디\",\"value\":\"01011000005\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"manager\"}],\"status\":\"approved\",\"store\":\"시크빌\",\"store_id\":\"store-chicvill\"}"

# [store-chicvill] 임지수 점원
ID=$(next_id)
put_bundle "USER-$ID" "{\"id\":\"USER-$ID\",\"type\":\"PersonalInfos\",\"title\":\"임지수 점원 계정\",\"items\":[{\"name\":\"이름\",\"value\":\"임지수\"},{\"name\":\"아이디\",\"value\":\"01022000005\"},{\"name\":\"비밀번호\",\"value\":\"$PW\"},{\"name\":\"권한\",\"value\":\"staff\"}],\"status\":\"approved\",\"store\":\"시크빌\",\"store_id\":\"store-chicvill\"}"

# ─── Phase 2: Employee bundles ────────────────────────────────
echo ""
echo "=== Phase 2: Employee bundles ==="

SCHED_MF='[{"day_of_week":1,"start_time":"09:00","end_time":"18:00"},{"day_of_week":2,"start_time":"09:00","end_time":"18:00"},{"day_of_week":3,"start_time":"09:00","end_time":"18:00"},{"day_of_week":4,"start_time":"09:00","end_time":"18:00"},{"day_of_week":5,"start_time":"09:00","end_time":"18:00"}]'
SCHED_MWF='[{"day_of_week":1,"start_time":"14:00","end_time":"22:00"},{"day_of_week":3,"start_time":"14:00","end_time":"22:00"},{"day_of_week":5,"start_time":"14:00","end_time":"22:00"}]'

put_bundle "EMP-01011000001" "{\"id\":\"EMP-01011000001\",\"type\":\"Employee\",\"title\":\"이민준 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"이민준\"},{\"name\":\"아이디\",\"value\":\"01011000001\"},{\"name\":\"직책\",\"value\":\"점장\"},{\"name\":\"시급\",\"value\":\"13000\"},{\"name\":\"누적시간\",\"value\":\"124.0\"},{\"name\":\"누적임금\",\"value\":\"1612000\"},{\"name\":\"지불된임금\",\"value\":\"1456000\"},{\"name\":\"미지급임금\",\"value\":\"156000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-01-15\\\",\\\"end\\\":\\\"2026-12-31\\\",\\\"employment_type\\\":\\\"정규직\\\",\\\"gender\\\":\\\"남성\\\",\\\"birth_date\\\":\\\"1995-03-12\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MF\"}],\"status\":\"active\",\"store\":\"미소 한식당\",\"store_id\":\"store-1\"}"

put_bundle "EMP-01022000001" "{\"id\":\"EMP-01022000001\",\"type\":\"Employee\",\"title\":\"김수아 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"김수아\"},{\"name\":\"아이디\",\"value\":\"01022000001\"},{\"name\":\"직책\",\"value\":\"점원\"},{\"name\":\"시급\",\"value\":\"11500\"},{\"name\":\"누적시간\",\"value\":\"72.0\"},{\"name\":\"누적임금\",\"value\":\"828000\"},{\"name\":\"지불된임금\",\"value\":\"749800\"},{\"name\":\"미지급임금\",\"value\":\"78200\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-09-01\\\",\\\"end\\\":\\\"2026-08-31\\\",\\\"employment_type\\\":\\\"알바\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"2003-07-22\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MWF\"}],\"status\":\"active\",\"store\":\"미소 한식당\",\"store_id\":\"store-1\"}"

put_bundle "EMP-01011000002" "{\"id\":\"EMP-01011000002\",\"type\":\"Employee\",\"title\":\"박지호 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"박지호\"},{\"name\":\"아이디\",\"value\":\"01011000002\"},{\"name\":\"직책\",\"value\":\"점장\"},{\"name\":\"시급\",\"value\":\"13000\"},{\"name\":\"누적시간\",\"value\":\"98.0\"},{\"name\":\"누적임금\",\"value\":\"1274000\"},{\"name\":\"지불된임금\",\"value\":\"1157000\"},{\"name\":\"미지급임금\",\"value\":\"117000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-03-01\\\",\\\"end\\\":\\\"2027-02-28\\\",\\\"employment_type\\\":\\\"정규직\\\",\\\"gender\\\":\\\"남성\\\",\\\"birth_date\\\":\\\"1992-11-05\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MF\"}],\"status\":\"active\",\"store\":\"블루버드 카페\",\"store_id\":\"store-2\"}"

put_bundle "EMP-01022000002" "{\"id\":\"EMP-01022000002\",\"type\":\"Employee\",\"title\":\"최은지 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"최은지\"},{\"name\":\"아이디\",\"value\":\"01022000002\"},{\"name\":\"직책\",\"value\":\"점원\"},{\"name\":\"시급\",\"value\":\"11500\"},{\"name\":\"누적시간\",\"value\":\"56.0\"},{\"name\":\"누적임금\",\"value\":\"644000\"},{\"name\":\"지불된임금\",\"value\":\"575800\"},{\"name\":\"미지급임금\",\"value\":\"68200\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2026-02-01\\\",\\\"end\\\":\\\"2027-01-31\\\",\\\"employment_type\\\":\\\"알바\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"2004-01-14\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MWF\"}],\"status\":\"active\",\"store\":\"블루버드 카페\",\"store_id\":\"store-2\"}"

put_bundle "EMP-01011000003" "{\"id\":\"EMP-01011000003\",\"type\":\"Employee\",\"title\":\"정현우 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"정현우\"},{\"name\":\"아이디\",\"value\":\"01011000003\"},{\"name\":\"직책\",\"value\":\"점장\"},{\"name\":\"시급\",\"value\":\"13000\"},{\"name\":\"누적시간\",\"value\":\"112.0\"},{\"name\":\"누적임금\",\"value\":\"1456000\"},{\"name\":\"지불된임금\",\"value\":\"1330000\"},{\"name\":\"미지급임금\",\"value\":\"126000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-06-01\\\",\\\"end\\\":\\\"2027-05-31\\\",\\\"employment_type\\\":\\\"정규직\\\",\\\"gender\\\":\\\"남성\\\",\\\"birth_date\\\":\\\"1990-08-30\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MF\"}],\"status\":\"active\",\"store\":\"나폴리 피자\",\"store_id\":\"store-3\"}"

put_bundle "EMP-01022000003" "{\"id\":\"EMP-01022000003\",\"type\":\"Employee\",\"title\":\"강민서 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"강민서\"},{\"name\":\"아이디\",\"value\":\"01022000003\"},{\"name\":\"직책\",\"value\":\"점원\"},{\"name\":\"시급\",\"value\":\"11000\"},{\"name\":\"누적시간\",\"value\":\"44.0\"},{\"name\":\"누적임금\",\"value\":\"484000\"},{\"name\":\"지불된임금\",\"value\":\"440000\"},{\"name\":\"미지급임금\",\"value\":\"44000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2026-01-15\\\",\\\"end\\\":\\\"2026-12-31\\\",\\\"employment_type\\\":\\\"알바\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"2002-05-18\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MWF\"}],\"status\":\"active\",\"store\":\"나폴리 피자\",\"store_id\":\"store-3\"}"

put_bundle "EMP-01011000004" "{\"id\":\"EMP-01011000004\",\"type\":\"Employee\",\"title\":\"한소희 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"한소희\"},{\"name\":\"아이디\",\"value\":\"01011000004\"},{\"name\":\"직책\",\"value\":\"점장\"},{\"name\":\"시급\",\"value\":\"13000\"},{\"name\":\"누적시간\",\"value\":\"86.0\"},{\"name\":\"누적임금\",\"value\":\"1118000\"},{\"name\":\"지불된임금\",\"value\":\"1001000\"},{\"name\":\"미지급임금\",\"value\":\"117000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-04-01\\\",\\\"end\\\":\\\"2027-03-31\\\",\\\"employment_type\\\":\\\"정규직\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"1994-02-09\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MF\"}],\"status\":\"active\",\"store\":\"일산국밥\",\"store_id\":\"store-Mbh\"}"

put_bundle "EMP-01022000004" "{\"id\":\"EMP-01022000004\",\"type\":\"Employee\",\"title\":\"오준혁 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"오준혁\"},{\"name\":\"아이디\",\"value\":\"01022000004\"},{\"name\":\"직책\",\"value\":\"점원\"},{\"name\":\"시급\",\"value\":\"11000\"},{\"name\":\"누적시간\",\"value\":\"36.0\"},{\"name\":\"누적임금\",\"value\":\"396000\"},{\"name\":\"지불된임금\",\"value\":\"352000\"},{\"name\":\"미지급임금\",\"value\":\"44000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2026-03-01\\\",\\\"end\\\":\\\"2026-11-30\\\",\\\"employment_type\\\":\\\"알바\\\",\\\"gender\\\":\\\"남성\\\",\\\"birth_date\\\":\\\"2001-09-25\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MWF\"}],\"status\":\"active\",\"store\":\"일산국밥\",\"store_id\":\"store-Mbh\"}"

put_bundle "EMP-01011000005" "{\"id\":\"EMP-01011000005\",\"type\":\"Employee\",\"title\":\"서채원 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"서채원\"},{\"name\":\"아이디\",\"value\":\"01011000005\"},{\"name\":\"직책\",\"value\":\"점장\"},{\"name\":\"시급\",\"value\":\"14000\"},{\"name\":\"누적시간\",\"value\":\"136.0\"},{\"name\":\"누적임금\",\"value\":\"1904000\"},{\"name\":\"지불된임금\",\"value\":\"1764000\"},{\"name\":\"미지급임금\",\"value\":\"140000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-02-01\\\",\\\"end\\\":\\\"2027-01-31\\\",\\\"employment_type\\\":\\\"정규직\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"1993-12-01\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MF\"}],\"status\":\"active\",\"store\":\"시크빌\",\"store_id\":\"store-chicvill\"}"

put_bundle "EMP-01022000005" "{\"id\":\"EMP-01022000005\",\"type\":\"Employee\",\"title\":\"임지수 직원정보\",\"items\":[{\"name\":\"이름\",\"value\":\"임지수\"},{\"name\":\"아이디\",\"value\":\"01022000005\"},{\"name\":\"직책\",\"value\":\"점원\"},{\"name\":\"시급\",\"value\":\"12000\"},{\"name\":\"누적시간\",\"value\":\"60.0\"},{\"name\":\"누적임금\",\"value\":\"720000\"},{\"name\":\"지불된임금\",\"value\":\"648000\"},{\"name\":\"미지급임금\",\"value\":\"72000\"},{\"name\":\"계약정보\",\"value\":\"{\\\"start\\\":\\\"2025-11-01\\\",\\\"end\\\":\\\"2026-10-31\\\",\\\"employment_type\\\":\\\"알바\\\",\\\"gender\\\":\\\"여성\\\",\\\"birth_date\\\":\\\"2000-04-07\\\"}\"},{\"name\":\"스케줄\",\"value\":\"$SCHED_MWF\"}],\"status\":\"active\",\"store\":\"시크빌\",\"store_id\":\"store-chicvill\"}"

# ─── Phase 3: Attendance records ──────────────────────────────
echo ""
echo "=== Phase 3: Attendance records ==="

# 각 직원별 최근 3일치 출퇴근 기록 (일정에 맞는 요일만)
make_att() {
  local phone="$1" name="$2" store_id="$3" store_name="$4"
  local in_time="$5" out_time="$6" mins="$7" late="$8" paid="$9" wage="${10}"
  local earned=$(( mins / 60 * wage ))
  local lid="LOG-$(next_id)"
  put_bundle "$lid" "{\"id\":\"$lid\",\"type\":\"Attendance\",\"title\":\"$name 출퇴근\",\"items\":[{\"name\":\"아이디\",\"value\":\"$phone\"},{\"name\":\"이름\",\"value\":\"$name\"},{\"name\":\"출근시간\",\"value\":\"$in_time\"},{\"name\":\"퇴근시간\",\"value\":\"$out_time\"},{\"name\":\"근무분수\",\"value\":\"$mins\"},{\"name\":\"지각여부\",\"value\":\"$late\"},{\"name\":\"정산상태\",\"value\":\"$paid\"},{\"name\":\"당일임금\",\"value\":\"$earned\"}],\"status\":\"completed\",\"store\":\"$store_name\",\"store_id\":\"$store_id\"}"
}

# 이민준 (Mon-Fri 09:00-18:00) → 최근 월/화/수
make_att "01011000001" "이민준" "store-1" "미소 한식당" "2026-05-25T09:00:00" "2026-05-25T18:00:00" 540 "정시" "지급" 13000
make_att "01011000001" "이민준" "store-1" "미소 한식당" "2026-05-26T09:08:00" "2026-05-26T18:00:00" 532 "지각" "지급" 13000
make_att "01011000001" "이민준" "store-1" "미소 한식당" "2026-05-27T09:00:00" "2026-05-27T18:00:00" 540 "정시" "미지급" 13000

# 김수아 (Mon/Wed/Fri 14:00-22:00) → 최근 월/수
make_att "01022000001" "김수아" "store-1" "미소 한식당" "2026-05-26T14:00:00" "2026-05-26T22:00:00" 480 "정시" "지급" 11500
make_att "01022000001" "김수아" "store-1" "미소 한식당" "2026-05-27T14:05:00" "2026-05-27T22:00:00" 475 "지각" "미지급" 11500

# 박지호 (Mon-Fri 08:00-17:00)
make_att "01011000002" "박지호" "store-2" "블루버드 카페" "2026-05-26T08:00:00" "2026-05-26T17:00:00" 540 "정시" "지급" 13000
make_att "01011000002" "박지호" "store-2" "블루버드 카페" "2026-05-27T08:00:00" "2026-05-27T17:00:00" 540 "정시" "미지급" 13000

# 최은지 (Tue/Thu/Sat 13:00-21:00)
make_att "01022000002" "최은지" "store-2" "블루버드 카페" "2026-05-26T13:00:00" "2026-05-26T21:00:00" 480 "정시" "지급" 11500
make_att "01022000002" "최은지" "store-2" "블루버드 카페" "2026-05-27T13:12:00" "2026-05-27T21:00:00" 468 "지각" "미지급" 11500

# 정현우 (Mon-Wed-Fri-Sat 11:00-20:00)
make_att "01011000003" "정현우" "store-3" "나폴리 피자" "2026-05-26T11:00:00" "2026-05-26T20:00:00" 540 "정시" "지급" 13000
make_att "01011000003" "정현우" "store-3" "나폴리 피자" "2026-05-27T11:00:00" "2026-05-27T20:00:00" 540 "정시" "미지급" 13000

# 강민서 (Fri/Sat/Sun)
make_att "01022000003" "강민서" "store-3" "나폴리 피자" "2026-05-24T17:00:00" "2026-05-24T22:00:00" 300 "정시" "지급" 11000
make_att "01022000003" "강민서" "store-3" "나폴리 피자" "2026-05-25T11:00:00" "2026-05-25T22:00:00" 660 "정시" "지급" 11000

# 한소희 (Mon-Fri 07:00-16:00)
make_att "01011000004" "한소희" "store-Mbh" "일산국밥" "2026-05-26T07:00:00" "2026-05-26T16:00:00" 540 "정시" "지급" 13000
make_att "01011000004" "한소희" "store-Mbh" "일산국밥" "2026-05-27T07:00:00" "2026-05-27T16:00:00" 540 "정시" "미지급" 13000

# 오준혁 (Mon/Wed/Fri 07:00-13:00)
make_att "01022000004" "오준혁" "store-Mbh" "일산국밥" "2026-05-26T07:00:00" "2026-05-26T13:00:00" 360 "정시" "지급" 11000
make_att "01022000004" "오준혁" "store-Mbh" "일산국밥" "2026-05-27T07:10:00" "2026-05-27T13:00:00" 350 "지각" "미지급" 11000

# 서채원 (Mon-Fri 10:00-19:00)
make_att "01011000005" "서채원" "store-chicvill" "시크빌" "2026-05-26T10:00:00" "2026-05-26T19:00:00" 540 "정시" "지급" 14000
make_att "01011000005" "서채원" "store-chicvill" "시크빌" "2026-05-27T10:00:00" "2026-05-27T19:00:00" 540 "정시" "미지급" 14000

# 임지수 (Tue/Thu/Sat 14:00-22:00)
make_att "01022000005" "임지수" "store-chicvill" "시크빌" "2026-05-27T14:00:00" "2026-05-27T22:00:00" 480 "정시" "미지급" 12000

echo ""
echo "=================================================="
echo "  완료! 계정 정보"
echo "  관리자:    ID=admin         PW=1212"
echo "  점주1~5:   ID=01000000001~5 PW=1212"
echo "  점장1~5:   ID=01011000001~5 PW=1212"
echo "  점원1~5:   ID=01022000001~5 PW=1212"
echo "=================================================="
