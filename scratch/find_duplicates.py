import re

with open('../admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all function declarations: function name(...) or async function name(...)
funcs = re.findall(r'(?:async\s+)?function\s+(\w+)\s*\(', content)

# Count occurrences
counts = {}
for func in funcs:
    counts[func] = counts.get(func, 0) + 1

duplicates = {k: v for k, v in counts.items() if v > 1}
print("Duplicate functions:", duplicates)
