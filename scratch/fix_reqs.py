import codecs
import os

bad_libs = ['pywin32', 'pywin32-ctypes', 'PyQt5', 'PyQt5-Qt5', 'PyQt5_sip', 'pynput', 'keyboard', 'pefile', 'pyinstaller', 'pyinstaller-hooks-contrib']

try:
    with codecs.open('requirements.txt', 'r', encoding='utf-16le') as f:
        lines = f.readlines()
except UnicodeError:
    with codecs.open('requirements.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()

new_lines = []
for line in lines:
    keep = True
    for bad in bad_libs:
        if line.strip().lower().startswith(bad.lower() + '=='):
            keep = False
            break
    if keep:
        new_lines.append(line)

with codecs.open('requirements.txt', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("requirements.txt has been fixed and converted to UTF-8.")
