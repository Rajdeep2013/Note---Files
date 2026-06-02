from pathlib import Path
import sys
path = Path(r'e:\Note - Files\style.css')
text = path.read_text(encoding='utf-8')
stack = []
line = 1
col = 0
for ch in text:
    if ch == '\n':
        line += 1
        col = 0
        continue
    col += 1
    if ch == '{':
        stack.append((line, col))
    elif ch == '}':
        if not stack:
            print('Extra closing brace at', line, col)
            sys.exit(1)
        stack.pop()
if stack:
    print('Unclosed braces count', len(stack), 'first positions', stack[:5])
    sys.exit(1)
print('Brace balance OK')
