from typing import List, Dict
from datetime import datetime, timedelta

def calculate_payroll_for_logs(logs: List[Dict], hourly_wage: int) -> Dict:
    """
    Given a list of attendance logs and the hourly wage,
    calculate the base wage, overtime, night shift allowance, and weekly holiday allowance.
    """
    base_wage = 0
    overtime_allowance = 0
    night_allowance = 0
    total_minutes = 0

    # Group logs by week for weekly holiday allowance
    weekly_hours = {}

    for log in logs:
        work_minutes = log.get('work_minutes') or 0
        if work_minutes <= 0:
            continue
            
        total_minutes += work_minutes
        
        # Base wage
        log_base_wage = int((work_minutes / 60.0) * hourly_wage)
        base_wage += log_base_wage

        # Overtime (Simple: > 8 hours a day)
        if work_minutes > 8 * 60:
            over_minutes = work_minutes - (8 * 60)
            overtime_allowance += int((over_minutes / 60.0) * hourly_wage * 0.5)

        # Night shift (22:00 ~ 06:00)
        check_in_time = log.get('check_in_time')
        check_out_time = log.get('check_out_time')
        if check_in_time and check_out_time:
            try:
                # Parse times (assuming ISO format strings)
                in_dt = datetime.fromisoformat(check_in_time.replace('Z', '+00:00'))
                out_dt = datetime.fromisoformat(check_out_time.replace('Z', '+00:00'))
                
                # Approximate night shift intersection
                # For simplicity in this demo, if any part of the shift is between 22 and 6, we add 0.5x for those hours.
                current = in_dt
                night_minutes = 0
                while current < out_dt:
                    if current.hour >= 22 or current.hour < 6:
                        night_minutes += 1
                    current += timedelta(minutes=1)
                
                if night_minutes > 0:
                    night_allowance += int((night_minutes / 60.0) * hourly_wage * 0.5)
            except Exception:
                pass

        # Weekly grouping (using ISO calendar week)
        if check_in_time:
            try:
                in_dt = datetime.fromisoformat(check_in_time.replace('Z', '+00:00'))
                year, week, _ = in_dt.isocalendar()
                week_key = f"{year}-W{week}"
                weekly_hours[week_key] = weekly_hours.get(week_key, 0) + (work_minutes / 60.0)
            except:
                pass

    # Weekly Holiday Allowance: For every week with >= 15 hours, add 8 hours of pay
    holiday_allowance = 0
    for w_key, hrs in weekly_hours.items():
        if hrs >= 15.0:
            holiday_allowance += int(8 * hourly_wage)

    # 3.3% Tax Deduction
    total_gross = base_wage + overtime_allowance + night_allowance + holiday_allowance
    tax_deduction = int(total_gross * 0.033)
    net_payroll = total_gross - tax_deduction

    return {
        "total_minutes": total_minutes,
        "total_hours": round(total_minutes / 60.0, 1),
        "base_wage": base_wage,
        "overtime_allowance": overtime_allowance,
        "night_allowance": night_allowance,
        "holiday_allowance": holiday_allowance,
        "tax_deduction": tax_deduction,
        "net_payroll": net_payroll
    }
