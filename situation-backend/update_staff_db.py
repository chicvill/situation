import re

staff_db_path = r'c:\Users\USER\Desktop\Workstation\situation\situation-backend\session\db\staff_db.py'
with open(staff_db_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_calc = '''
            # Split logs into paid and unpaid based on their paid status
            unpaid_logs = [log for log in logs if not log.get('paid')]
            paid_logs = [log for log in logs if log.get('paid')]

            from ..hr_calc import calculate_payroll_for_logs
            unpaid_calc = calculate_payroll_for_logs(unpaid_logs, hourly_wage)
            paid_calc = calculate_payroll_for_logs(paid_logs, hourly_wage)

            total_hours = unpaid_calc['total_hours'] + paid_calc['total_hours']
            paid_wage = paid_calc['net_payroll']
            unpaid_wage = unpaid_calc['net_payroll']
            total_wage = paid_wage + unpaid_wage
'''

pattern = re.compile(r'total_minutes = sum\(log\[\'work_minutes\'\].*?paid_wage \+= weekly_holiday_allowance', re.DOTALL)
content = pattern.sub(new_calc.strip(), content)

content = content.replace('str(base_wage + weekly_holiday_allowance)', 'str(total_wage)')

with open(staff_db_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("staff_db.py updated")
