# Hazy Hollows Songbook

This repository contains the performance-ready ChordPro charts for Tio Savich & Hazy Hollows.

## How to View Locally
Because this site uses JavaScript to fetch the `manifest.json` file, you **cannot** just double-click `index.html` to open it in a browser (due to CORS security restrictions for local files). 

Instead, open your terminal, navigate to this folder, and run a local web server:

```bash
python3 -m http.server 8000
```

Then open your browser and go to: [http://localhost:8000](http://localhost:8000)

## How to Add or Edit Songs
1. Add or edit `.chopro` files inside the `songs/` folder. 
2. (Optional) There are ~100+ backup conversions from docx files waiting inside the `staged_docx_songs/` folder. You can safely pick and choose which ones you want to move into `songs/` without overwriting your manual edits. 
3. Ensure you use the proper ChordPro tags at the top of your file (e.g. `{title: My Song}`, `{key: C}`, `{type: original}`, etc.).
4. **IMPORTANT:** After adding, changing metadata, or deleting a song, you must regenerate the `manifest.json` file!
5. Run the python script to update the index:

```bash
python3 generate_manifest.py
```

6. Once the manifest is generated and you see the new songs locally, you can commit and push the changes to GitHub.

## Deploying to GitHub Pages
If you want the band to be able to access this on their phones:
1. Push this repository to GitHub.
2. In your GitHub repository settings, go to **Pages**.
3. Under "Build and deployment", select **Deploy from a branch**.
4. Select the **main** branch and **root** (/) folder, then click Save.
5. In a few minutes, your site will be live at `https://YOUR-USERNAME.github.io/hazy-hollows-songbook/`!
