#!/bin/bash

# Navigate to the script's directory (the site folder)
cd "$(dirname "$0")"

echo "🎵 Regenerating manifest..."
python3 generate_manifest.py

echo "📦 Committing changes..."
# Check if there are changes
if [[ -n $(git status -s) ]]; then
    git add .
    git commit -m "Auto-deploy update via deploy.sh"
    
    echo "🚀 Pushing to GitHub (will trigger GitHub Pages Action)..."
    git push origin main
    
    echo "✅ Done! Your changes will be live on GitHub Pages in ~1 minute."
else
    echo "✅ No changes to commit. Everything is up to date!"
fi
