import glob

files = glob.glob('app/**/*.tsx', recursive=True)

replacements = [
    ("color: '#666'", "color: 'var(--text-secondary, #666)'"),
    ("color: '#999'", "color: 'var(--text-muted, #999)'"),
    ("color: '#333'", "color: 'var(--text-primary, #333)'"),
    ("color: '#64748b'", "color: 'var(--text-secondary, #64748b)'"),
    ("border: '1px solid #e0e4f8'", "border: '1px solid var(--border-color, #e0e4f8)'"),
    ("borderBottom: '1px solid #e0e4f8'", "borderBottom: '1px solid var(--border-color, #e0e4f8)'"),
    ("borderBottom: '2px solid #e0e4f8'", "borderBottom: '2px solid var(--border-color, #e0e4f8)'"),
    ("borderTop: '1px solid #e0e4f8'", "borderTop: '1px solid var(--border-color, #e0e4f8)'"),
    ("borderLeft: '1px solid #e0e4f8'", "borderLeft: '1px solid var(--border-color, #e0e4f8)'"),
    ("'2px solid #e0e4f8'", "'2px solid var(--border-color, #e0e4f8)'"),
    ("'1px solid #e0e4f8'", "'1px solid var(--border-color, #e0e4f8)'"),
    ("'1px solid #eee'", "'1px solid var(--border-color, #eee)'"),
    ("'2px solid #eee'", "'2px solid var(--border-color, #eee)'"),
]

changed = []
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        changed.append(filepath)

print('Modified', len(changed), 'files:')
for f in changed:
    print(' ', f)
