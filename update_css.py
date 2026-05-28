import re

def update_css(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    replacements = [
        (r'rgba\(30, 41, 59, 0.7\)', r'var(--card-bg)'),
        (r'rgba\(30, 41, 59, 0.5\)', r'var(--card-bg)'),
        (r'rgba\(15, 23, 42, 0.5\)', r'var(--background)'),
        (r'rgba\(59, 130, 246, 0.1\)', r'rgba(59, 130, 246, 0.15)'), # leave it as is or tint it
        (r'#1e293b', r'var(--card-hover)'),
        (r'#cbd5e1', r'var(--foreground)'),
        (r'color: #ffffff;', r'color: var(--foreground);'),
        (r'background: linear-gradient\(135deg, var\(--primary\) 0%, var\(--primary-hover\) 100%\);\n  color: #ffffff;', r'background: var(--primary-gradient);\n  color: #ffffff;'),
        (r'color: #60a5fa;', r'color: var(--primary);'),
        (r'border: 3px solid rgba\(255,255,255,0.1\);', r'border: 3px solid var(--border-color);'),
    ]

    for old, new in replacements:
        content = re.sub(old, new, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_css('src/app/profile/profile.module.css')
update_css('src/app/call/call.module.css')

