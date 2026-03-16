import os
import json
import re

songs_dir = "/Users/tio/Desktop/Music Chords and Lyrics/site/songs"
manifest_path = os.path.join(songs_dir, "manifest.json")

manifest = []

for filename in os.listdir(songs_dir):
    if not filename.endswith(".chopro"):
        continue
    filepath = os.path.join(songs_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    song_info = {"filename": filename}
    
    # Extract metadata blocks {key: value}
    for match in re.finditer(r'\{([^:]+):\s*([^}]+)\}', content):
        key = match.group(1).strip()
        value = match.group(2).strip()
        # Some values should be cast to integer
        if key in ['capo', 'transpose']:
            try:
                value = int(value)
            except ValueError:
                pass
        song_info[key] = value

    manifest.append(song_info)

# Sort by title
manifest.sort(key=lambda x: x.get("title", ""))

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

print(f"Generated manifest.json with {len(manifest)} songs.")
