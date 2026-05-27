import re

file_path = r'c:\Users\USER\Desktop\Workstation\situation\situation-room\src\components\hr\EmployeeModal.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Wrapper paddings
content = content.replace("padding: '20px',", "padding: '10px', boxSizing: 'border-box',")
content = content.replace("padding: '30px',", "padding: '16px', boxSizing: 'border-box',")
content = content.replace("borderRadius: '24px',", "borderRadius: '16px',")

# 2. Header layout
content = content.replace(
    "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>",
    "<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>"
)
content = content.replace(
    "<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>",
    "<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>"
)
content = content.replace(
    "<span style={{ fontSize: '1.6rem' }}>👤</span>",
    "<span style={{ fontSize: '1.4rem' }}>👤</span>"
)
content = content.replace(
    "<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>",
    "<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>"
)

# 3. Edit mode sections padding
content = content.replace(
    "padding: '20px', borderRadius: '16px', background: '#f8fafc'",
    "padding: '14px', borderRadius: '12px', background: '#f8fafc'"
)

# 4. Force Attendance buttons
content = content.replace(
    "<div style={{ display: 'flex', gap: '12px' }}>",
    "<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>"
)
content = content.replace(
    "style={{ flex: 1, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}",
    "style={{ flex: '1 1 130px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}"
)
content = content.replace(
    "style={{ flex: 1, background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', borderRadius: '12px', padding: '14px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}",
    "style={{ flex: '1 1 130px', background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', borderRadius: '10px', padding: '12px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done modifying EmployeeModal.tsx')
