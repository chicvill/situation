# ============================================================
# Situation Demo Data Seed Script
# 각 매장 점주(기존) + 점장 + 점원 계정, Employee, Attendance 생성
# ============================================================
$base = "https://situation.chicvill.store"
$pw   = "cbfad02f9ed2a8d1e08d8f74f5303e9eb93637d47f82ab6f1c15871cf8dd0481"  # SHA-256("1212")

function Put-Bundle($id, $jsonBody) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    try {
        $r = Invoke-WebRequest -Uri "$base/api/bundle/$id" -Method PUT `
            -Body $bytes -ContentType "application/json; charset=utf-8" `
            -UseBasicParsing -ErrorAction Stop
        Write-Host "  OK  $id" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL $id : $($_.Exception.Message.Substring(0,[Math]::Min(60,$_.Exception.Message.Length)))" -ForegroundColor Red
    }
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
function NextTs { $script:ts++; return $script:ts }

# ── 매장 정의 ─────────────────────────────────────────────────
$stores = @(
    @{ id="store-1";       name="미소 한식당";    ownerPhone="01000000001" },
    @{ id="store-2";       name="블루버드 카페";   ownerPhone="01000000002" },
    @{ id="store-3";       name="나폴리 피자";     ownerPhone="01000000003" },
    @{ id="store-Mbh";     name="일산국밥";        ownerPhone="01000000004" },
    @{ id="store-chicvill";name="시크빌";          ownerPhone="01000000005" }
)

# ── 점장/점원 명단 ─────────────────────────────────────────────
$employees_def = @(
    # store-1 미소 한식당
    @{ phone="01011000001"; name="이민준"; role="manager"; storeId="store-1"; storeName="미소 한식당";
       wage=13000; contract='{"start":"2025-01-15","end":"2026-12-31","employment_type":"정규직","gender":"남성","birth_date":"1995-03-12"}';
       schedule='[{"day_of_week":1,"start_time":"09:00","end_time":"18:00"},{"day_of_week":2,"start_time":"09:00","end_time":"18:00"},{"day_of_week":3,"start_time":"09:00","end_time":"18:00"},{"day_of_week":4,"start_time":"09:00","end_time":"18:00"},{"day_of_week":5,"start_time":"09:00","end_time":"18:00"}]';
       cumHours="124.0"; cumWage="1612000"; paidWage="1456000"; unpaidWage="156000" },
    @{ phone="01022000001"; name="김수아"; role="staff"; storeId="store-1"; storeName="미소 한식당";
       wage=11500; contract='{"start":"2025-09-01","end":"2026-08-31","employment_type":"알바","gender":"여성","birth_date":"2003-07-22"}';
       schedule='[{"day_of_week":1,"start_time":"14:00","end_time":"22:00"},{"day_of_week":3,"start_time":"14:00","end_time":"22:00"},{"day_of_week":5,"start_time":"14:00","end_time":"22:00"}]';
       cumHours="72.0"; cumWage="828000"; paidWage="749800"; unpaidWage="78200" },
    # store-2 블루버드 카페
    @{ phone="01011000002"; name="박지호"; role="manager"; storeId="store-2"; storeName="블루버드 카페";
       wage=13000; contract='{"start":"2025-03-01","end":"2027-02-28","employment_type":"정규직","gender":"남성","birth_date":"1992-11-05"}';
       schedule='[{"day_of_week":1,"start_time":"08:00","end_time":"17:00"},{"day_of_week":2,"start_time":"08:00","end_time":"17:00"},{"day_of_week":3,"start_time":"08:00","end_time":"17:00"},{"day_of_week":4,"start_time":"08:00","end_time":"17:00"},{"day_of_week":5,"start_time":"08:00","end_time":"17:00"}]';
       cumHours="98.0"; cumWage="1274000"; paidWage="1157000"; unpaidWage="117000" },
    @{ phone="01022000002"; name="최은지"; role="staff"; storeId="store-2"; storeName="블루버드 카페";
       wage=11500; contract='{"start":"2026-02-01","end":"2027-01-31","employment_type":"알바","gender":"여성","birth_date":"2004-01-14"}';
       schedule='[{"day_of_week":2,"start_time":"13:00","end_time":"21:00"},{"day_of_week":4,"start_time":"13:00","end_time":"21:00"},{"day_of_week":6,"start_time":"10:00","end_time":"18:00"}]';
       cumHours="56.0"; cumWage="644000"; paidWage="575800"; unpaidWage="68200" },
    # store-3 나폴리 피자
    @{ phone="01011000003"; name="정현우"; role="manager"; storeId="store-3"; storeName="나폴리 피자";
       wage=13000; contract='{"start":"2025-06-01","end":"2027-05-31","employment_type":"정규직","gender":"남성","birth_date":"1990-08-30"}';
       schedule='[{"day_of_week":1,"start_time":"11:00","end_time":"20:00"},{"day_of_week":2,"start_time":"11:00","end_time":"20:00"},{"day_of_week":3,"start_time":"11:00","end_time":"20:00"},{"day_of_week":5,"start_time":"11:00","end_time":"20:00"},{"day_of_week":6,"start_time":"11:00","end_time":"20:00"}]';
       cumHours="112.0"; cumWage="1456000"; paidWage="1330000"; unpaidWage="126000" },
    @{ phone="01022000003"; name="강민서"; role="staff"; storeId="store-3"; storeName="나폴리 피자";
       wage=11000; contract='{"start":"2026-01-15","end":"2026-12-31","employment_type":"알바","gender":"여성","birth_date":"2002-05-18"}';
       schedule='[{"day_of_week":5,"start_time":"17:00","end_time":"22:00"},{"day_of_week":6,"start_time":"11:00","end_time":"22:00"},{"day_of_week":0,"start_time":"11:00","end_time":"20:00"}]';
       cumHours="44.0"; cumWage="484000"; paidWage="440000"; unpaidWage="44000" },
    # store-Mbh 일산국밥
    @{ phone="01011000004"; name="한소희"; role="manager"; storeId="store-Mbh"; storeName="일산국밥";
       wage=13000; contract='{"start":"2025-04-01","end":"2027-03-31","employment_type":"정규직","gender":"여성","birth_date":"1994-02-09"}';
       schedule='[{"day_of_week":1,"start_time":"07:00","end_time":"16:00"},{"day_of_week":2,"start_time":"07:00","end_time":"16:00"},{"day_of_week":3,"start_time":"07:00","end_time":"16:00"},{"day_of_week":4,"start_time":"07:00","end_time":"16:00"},{"day_of_week":5,"start_time":"07:00","end_time":"16:00"}]';
       cumHours="86.0"; cumWage="1118000"; paidWage="1001000"; unpaidWage="117000" },
    @{ phone="01022000004"; name="오준혁"; role="staff"; storeId="store-Mbh"; storeName="일산국밥";
       wage=11000; contract='{"start":"2026-03-01","end":"2026-11-30","employment_type":"알바","gender":"남성","birth_date":"2001-09-25"}';
       schedule='[{"day_of_week":1,"start_time":"07:00","end_time":"13:00"},{"day_of_week":3,"start_time":"07:00","end_time":"13:00"},{"day_of_week":5,"start_time":"07:00","end_time":"13:00"}]';
       cumHours="36.0"; cumWage="396000"; paidWage="352000"; unpaidWage="44000" },
    # store-chicvill 시크빌
    @{ phone="01011000005"; name="서채원"; role="manager"; storeId="store-chicvill"; storeName="시크빌";
       wage=14000; contract='{"start":"2025-02-01","end":"2027-01-31","employment_type":"정규직","gender":"여성","birth_date":"1993-12-01"}';
       schedule='[{"day_of_week":1,"start_time":"10:00","end_time":"19:00"},{"day_of_week":2,"start_time":"10:00","end_time":"19:00"},{"day_of_week":3,"start_time":"10:00","end_time":"19:00"},{"day_of_week":4,"start_time":"10:00","end_time":"19:00"},{"day_of_week":5,"start_time":"10:00","end_time":"19:00"}]';
       cumHours="136.0"; cumWage="1904000"; paidWage="1764000"; unpaidWage="140000" },
    @{ phone="01022000005"; name="임지수"; role="staff"; storeId="store-chicvill"; storeName="시크빌";
       wage=12000; contract='{"start":"2025-11-01","end":"2026-10-31","employment_type":"알바","gender":"여성","birth_date":"2000-04-07"}';
       schedule='[{"day_of_week":2,"start_time":"14:00","end_time":"22:00"},{"day_of_week":4,"start_time":"14:00","end_time":"22:00"},{"day_of_week":6,"start_time":"12:00","end_time":"20:00"}]';
       cumHours="60.0"; cumWage="720000"; paidWage="648000"; unpaidWage="72000" }
)

Write-Host "`n=== Phase 1: PersonalInfos (점장/점원) ===" -ForegroundColor Cyan
foreach ($e in $employees_def) {
    $rid = "USER-$(NextTs)"
    $roleLabel = if ($e.role -eq "manager") { "점장" } else { "점원" }
    $json = [string]::Concat(
        '{"id":"', $rid, '","type":"PersonalInfos","title":"', $e.name, '님 계정 (', $roleLabel, ')","items":[',
        '{"name":"이름","value":"', $e.name, '"},',
        '{"name":"아이디","value":"', $e.phone, '"},',
        '{"name":"비밀번호","value":"', $pw, '"},',
        '{"name":"권한","value":"', $e.role, '"}',
        '],"status":"approved","timestamp":"2026-05-28 00:00:00",',
        '"store":"', $e.storeName, '","store_id":"', $e.storeId, '"}'
    )
    Put-Bundle $rid $json
    Start-Sleep -Milliseconds 60
}

Write-Host "`n=== Phase 2: Employee bundles ===" -ForegroundColor Cyan
foreach ($e in $employees_def) {
    $eid = "EMP-$($e.phone)"
    $직책 = if ($e.role -eq "manager") { "점장" } else { "점원" }
    $json = [string]::Concat(
        '{"id":"', $eid, '","type":"Employee","title":"', $e.name, ' 직원 정보","items":[',
        '{"name":"이름","value":"', $e.name, '"},',
        '{"name":"아이디","value":"', $e.phone, '"},',
        '{"name":"직책","value":"', $직책, '"},',
        '{"name":"시급","value":"', $e.wage, '"},',
        '{"name":"누적시간","value":"', $e.cumHours, '"},',
        '{"name":"누적임금","value":"', $e.cumWage, '"},',
        '{"name":"지불된임금","value":"', $e.paidWage, '"},',
        '{"name":"미지급임금","value":"', $e.unpaidWage, '"},',
        '{"name":"계약정보","value":', $e.contract, '},',
        '{"name":"스케줄","value":', $e.schedule, '}',
        '],"status":"active","timestamp":"2026-05-28 00:00:00",',
        '"store":"', $e.storeName, '","store_id":"', $e.storeId, '"}'
    )
    Put-Bundle $eid $json
    Start-Sleep -Milliseconds 60
}

Write-Host "`n=== Phase 3: Attendance records ===" -ForegroundColor Cyan
# 각 직원별 최근 3일 출퇴근 기록 생성
$today = [DateTime]::UtcNow.Date
foreach ($e in $employees_def) {
    for ($d = 3; $d -ge 1; $d--) {
        $date = $today.AddDays(-$d)
        $dayOfWeek = [int]$date.DayOfWeek   # 0=Sun, 1=Mon ...

        # Get schedule for this day
        $schedJson = $e.schedule | ConvertFrom-Json
        $daySchedule = $schedJson | Where-Object { $_.day_of_week -eq $dayOfWeek } | Select-Object -First 1
        if (-not $daySchedule) { continue }

        $inHour  = [int]($daySchedule.start_time.Split(':')[0])
        $outHour = [int]($daySchedule.end_time.Split(':')[0])
        $tardyOffset = if ($d -eq 2) { 8 } else { 0 }  # 2일 전은 지각
        $inTime  = $date.AddHours($inHour).AddMinutes($tardyOffset).ToString("yyyy-MM-ddTHH:mm:ss")
        $outTime = $date.AddHours($outHour).ToString("yyyy-MM-ddTHH:mm:ss")
        $workMins = ($outHour - $inHour) * 60 - $tardyOffset
        $isLate   = if ($tardyOffset -gt 0) { "지각" } else { "정시" }
        $earned   = [Math]::Floor($workMins / 60.0 * $e.wage)
        $paid     = if ($d -gt 1) { "지급" } else { "미지급" }

        $lid = "LOG-$(NextTs)"
        $json = [string]::Concat(
            '{"id":"', $lid, '","type":"Attendance","title":"', $e.name, ' 출퇴근","items":[',
            '{"name":"아이디","value":"', $e.phone, '"},',
            '{"name":"이름","value":"', $e.name, '"},',
            '{"name":"출근시간","value":"', $inTime, '"},',
            '{"name":"퇴근시간","value":"', $outTime, '"},',
            '{"name":"근무분수","value":"', $workMins, '"},',
            '{"name":"지각여부","value":"', $isLate, '"},',
            '{"name":"정산상태","value":"', $paid, '"},',
            '{"name":"당일임금","value":"', $earned, '"}',
            '],"status":"completed","timestamp":"', $inTime, '",',
            '"store":"', $e.storeName, '","store_id":"', $e.storeId, '"}'
        )
        Put-Bundle $lid $json
        Start-Sleep -Milliseconds 50
    }
}

Write-Host "`n=== 완료! ===" -ForegroundColor Yellow
Write-Host "계정 정보:" -ForegroundColor Yellow
Write-Host "  관리자: ID=admin, PW=1212" -ForegroundColor White
foreach ($s in $stores) {
    Write-Host "  $($s.name) 점주: ID=$($s.ownerPhone), PW=1212" -ForegroundColor White
}
Write-Host "  점장: 01011000001~5, PW=1212" -ForegroundColor White
Write-Host "  점원: 01022000001~5, PW=1212" -ForegroundColor White
