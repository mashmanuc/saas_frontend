import json
import sys

def find_duplicate_keys(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    key_positions = {}
    duplicates = []
    
    for i, line in enumerate(lines, 1):
        # Simple regex to find keys
        import re
        matches = re.findall(r'^\s*"([^"]+)"\s*:', line)
        for key in matches:
            if key in key_positions:
                duplicates.append((key, key_positions[key], i))
            else:
                key_positions[key] = i
    
    return duplicates

if __name__ == '__main__':
    dups = find_duplicate_keys('src/i18n/locales/uk.json')
    if dups:
        print("Duplicate keys found:")
        for key, first_line, second_line in dups:
            print(f'  "{key}" at lines {first_line} and {second_line}')
    else:
        print("No duplicates found")
