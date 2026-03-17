/* ═══════════════════════════════════════════════════════════
   Hazy Hollows Chord Book — App Logic
   ChordPro renderer with transposition toggle
   ═══════════════════════════════════════════════════════════ */

// ── Chromatic scale ──
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_MAP = {};
SHARPS.forEach((n, i) => NOTE_MAP[n] = i);
FLATS.forEach((n, i) => NOTE_MAP[n] = i);

function transposeChord(chord, semitones) {
    if (semitones === 0) return chord;
    // Extract root note (1-2 chars)
    const m = chord.match(/^([A-G][b#]?)(.*)/);
    if (!m) return chord;
    const root = m[1];
    const suffix = m[2];
    const idx = NOTE_MAP[root];
    if (idx === undefined) return chord;
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    // Prefer flats or sharps based on original
    const newRoot = root.includes('b') ? FLATS[newIdx] : SHARPS[newIdx];
    // Handle bass notes in slash chords
    if (suffix.includes('/')) {
        const slashIdx = suffix.indexOf('/');
        const bass = suffix.slice(slashIdx + 1);
        const restSuffix = suffix.slice(0, slashIdx);
        const transposedBass = transposeChord(bass, semitones);
        return newRoot + restSuffix + '/' + transposedBass;
    }
    return newRoot + suffix;
}

// ── State ──
let manifest = [];
let currentSong = null;
let showTiosShapes = false;
let showNoellePDF = false;
let fontSize = 17;

// ── Setlist State ──
let setlist = JSON.parse(localStorage.getItem('hazySetlist')) || [];
let showPerfTiosShapes = false;
let perfFontSize = 20;

// ── DOM refs ──
const indexView = document.getElementById('index-view');
const songView = document.getElementById('song-view');
const songGrid = document.getElementById('song-grid');
const searchInput = document.getElementById('search-input');
const backBtn = document.getElementById('back-btn');
const transposeToggle = document.getElementById('transpose-toggle');
const noelleToggle = document.getElementById('noelle-toggle');
const toggleLabel = document.getElementById('toggle-label');
const songTitle = document.getElementById('song-title');
const songMeta = document.getElementById('song-meta');
const keyDisplay = document.getElementById('key-display');
const songBody = document.getElementById('song-body');
const fontUp = document.getElementById('font-up');
const fontDown = document.getElementById('font-down');
const filterPills = document.querySelectorAll('.pill[data-filter]');
const countAll = document.getElementById('count-all');
const countOriginals = document.getElementById('count-originals');
const countCovers = document.getElementById('count-covers');
const performerSelect = document.getElementById('performer-select');

// ── Setlist DOM refs ──
const setlistCount = document.getElementById('setlist-count');
const openSetlistBtn = document.getElementById('open-setlist-btn');
const setlistView = document.getElementById('setlist-view');
const setlistGrid = document.getElementById('setlist-grid');
const setlistBackBtn = document.getElementById('setlist-back-btn');
const clearSetlistBtn = document.getElementById('clear-setlist-btn');
const playSetlistBtn = document.getElementById('play-setlist-btn');

const performanceView = document.getElementById('performance-view');
const perfBackBtn = document.getElementById('perf-back-btn');
const perfTransposeBtn = document.getElementById('perf-transpose-btn');
const perfFontUp = document.getElementById('perf-font-up');
const perfFontDown = document.getElementById('perf-font-down');
const performanceBody = document.getElementById('performance-body');

let activeTypeFilter = 'all';
let activePerformerFilter = 'all';

// ── Init ──
async function init() {
    try {
        const resp = await fetch('songs/manifest.json');
        manifest = await resp.json();
    } catch (e) {
        songGrid.innerHTML = '<p class="no-results">Could not load song manifest.</p>';
        return;
    }

    // Update counts
    countAll.textContent = manifest.length;
    countOriginals.textContent = manifest.filter(s => s.type === 'original').length;
    countCovers.textContent = manifest.filter(s => s.type === 'cover').length;
    
    updateSetlistCount();

    populatePerformers();
    renderIndex();
    setupEvents();

    // Check URL hash for direct song link
    if (location.hash) {
        const filename = decodeURIComponent(location.hash.slice(1));
        const song = manifest.find(s => s.filename === filename);
        if (song) openSong(song);
    }
}

function populatePerformers() {
    const performers = new Set();
    manifest.forEach(s => {
        if (s.performer) {
            performers.add(s.performer.trim());
        }
    });
    
    const sorted = Array.from(performers).sort();
    
    performerSelect.innerHTML = '<option value="all">Every Performer</option>';
    sorted.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        performerSelect.appendChild(opt);
    });
}

function renderIndex() {
    const query = searchInput.value.toLowerCase().trim();
    let filtered = manifest;

    if (activeTypeFilter !== 'all') {
        filtered = filtered.filter(s => s.type === activeTypeFilter);
    }
    
    if (activePerformerFilter !== 'all') {
        filtered = filtered.filter(s => s.performer && s.performer.trim() === activePerformerFilter);
    }

    if (query) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(query) ||
            (s.artist && s.artist.toLowerCase().includes(query)) ||
            (s.performer && s.performer.toLowerCase().includes(query)) ||
            (s.written_key && s.written_key.toLowerCase().includes(query)) ||
            (s.absolute_key && s.absolute_key.toLowerCase().includes(query))
        );
    }

    // Sort by title
    filtered.sort((a, b) => a.title.localeCompare(b.title));

    if (filtered.length === 0) {
        songGrid.innerHTML = '<p class="no-results">No songs match your search.</p>';
        return;
    }

    songGrid.innerHTML = filtered.map(song => {
        const artistLine = song.performer ? song.performer : (song.type === 'cover' ? song.artist : 'Tio Savich');
        const tuningLabel = song.tuning === 'baritone' ? ' (Bari)' : '';
        const inSetlist = setlist.includes(song.filename);
        const setlistBtnHtml = `<button class="add-to-setlist-btn ${inSetlist ? 'added' : ''}" data-filename="${escapeHtml(song.filename)}" aria-label="Add to setlist" onclick="event.stopPropagation(); toggleSetlist('${escapeHtml(song.filename)}')">${inSetlist ? '✓' : '+'}</button>`;

        return `
      <div class="song-card" data-filename="${song.filename}" tabindex="0" role="button">
        <div class="card-badge ${song.type}"></div>
        <div class="card-info">
          <div class="card-title">${song.title}${tuningLabel}</div>
          <div class="card-artist">${artistLine}</div>
        </div>
        <div class="card-keys">
          <span class="card-key">${song.absolute_key}</span>
          <span class="card-key-label">key</span>
        </div>
        <span class="card-type ${song.type}">${song.type}</span>
        ${setlistBtnHtml}
      </div>
    `;
    }).join('');
}

function setupEvents() {
    // Search
    searchInput.addEventListener('input', renderIndex);

    // Filter pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeTypeFilter = pill.dataset.filter;
            renderIndex();
        });
    });

    // Performer dropdown
    performerSelect.addEventListener('change', e => {
        activePerformerFilter = e.target.value;
        renderIndex();
    });

    // Song card clicks
    songGrid.addEventListener('click', e => {
        const card = e.target.closest('.song-card');
        if (!card) return;
        const filename = card.dataset.filename;
        const song = manifest.find(s => s.filename === filename);
        if (song) openSong(song);
    });

    // Keyboard nav on cards
    songGrid.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const card = e.target.closest('.song-card');
            if (card) card.click();
        }
    });

    // Back button
    backBtn.addEventListener('click', closeSong);

    // Transpose toggle
    transposeToggle.addEventListener('click', () => {
        showTiosShapes = !showTiosShapes;
        transposeToggle.classList.toggle('active', showTiosShapes);
        if (currentSong) renderSong(currentSong);
    });

    // Noelle's Version toggle
    noelleToggle.addEventListener('click', () => {
        showNoellePDF = !showNoellePDF;
        noelleToggle.classList.toggle('active', showNoellePDF);
        if (currentSong) renderSong(currentSong);
    });

    // Font size
    fontUp.addEventListener('click', () => {
        fontSize = Math.min(28, fontSize + 2);
        songBody.style.fontSize = fontSize + 'px';
    });
    fontDown.addEventListener('click', () => {
        fontSize = Math.max(11, fontSize - 2);
        songBody.style.fontSize = fontSize + 'px';
    });
    
    // Setlist actions
    openSetlistBtn.addEventListener('click', () => {
        indexView.classList.remove('active');
        setlistView.classList.add('active');
        renderSetlist();
    });
    setlistBackBtn.addEventListener('click', () => {
        setlistView.classList.remove('active');
        indexView.classList.add('active');
        renderIndex();
    });
    clearSetlistBtn.addEventListener('click', () => {
        if (confirm("Clear your entire setlist?")) {
            setlist = [];
            updateSetlistCount();
            renderSetlist();
        }
    });
    playSetlistBtn.addEventListener('click', startPerformance);
    
    perfBackBtn.addEventListener('click', () => {
        performanceView.classList.remove('active');
        setlistView.classList.add('active');
    });
    perfTransposeBtn.addEventListener('click', () => {
        showPerfTiosShapes = !showPerfTiosShapes;
        perfTransposeBtn.classList.toggle('active', showPerfTiosShapes);
        startPerformance(false);
    });
    perfFontUp.addEventListener('click', () => {
        perfFontSize = Math.min(36, perfFontSize + 2);
        performanceBody.style.fontSize = perfFontSize + 'px';
    });
    perfFontDown.addEventListener('click', () => {
        perfFontSize = Math.max(14, perfFontSize - 2);
        performanceBody.style.fontSize = perfFontSize + 'px';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        if (songView.classList.contains('active')) {
            if (e.key === 'Escape') closeSong();
            if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
                transposeToggle.click();
            }
        } else {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                searchInput.focus();
            }
        }
    });

    // Handle browser back
    window.addEventListener('popstate', () => {
        if (!location.hash && songView.classList.contains('active')) {
            closeSong(true);
        } else if (location.hash) {
            const filename = decodeURIComponent(location.hash.slice(1));
            const song = manifest.find(s => s.filename === filename);
            if (song) openSong(song, true);
        }
    });
}

async function openSong(song, skipPush) {
    currentSong = song;
    showTiosShapes = false;
    transposeToggle.classList.remove('active');
    
    showNoellePDF = false;
    noelleToggle.classList.remove('active');
    
    if (song.noelle_pdf) {
        noelleToggle.style.display = 'flex';
    } else {
        noelleToggle.style.display = 'none';
    }

    // Update header
    songTitle.textContent = song.title;
    const tuningNote = song.tuning === 'baritone' ? `Baritone, ` : '';
    const capoNote = song.capo !== 0 ? `Capo ${song.capo}` : 'No capo';
    songMeta.textContent = `${song.artist} · ${tuningNote}${capoNote}`;
    keyDisplay.textContent = song.absolute_key;

    // Fetch and render the .chopro file
    try {
        const resp = await fetch(`songs/${song.filename}`);
        const text = await resp.text();
        song._raw = text;
        renderSong(song);
    } catch (e) {
        songBody.innerHTML = '<p style="color: var(--text-muted);">Could not load song file.</p>';
    }

    // Switch views
    indexView.classList.remove('active');
    songView.classList.add('active');
    songBody.scrollTop = 0;
    window.scrollTo(0, 0);

    if (!skipPush) {
        history.pushState(null, '', '#' + encodeURIComponent(song.filename));
    }
}

function closeSong(skipPush) {
    currentSong = null;
    songView.classList.remove('active');
    indexView.classList.add('active');
    if (!skipPush) {
        history.pushState(null, '', location.pathname);
    }
}

function renderSong(song) {
    if (showNoellePDF && song.noelle_pdf) {
        songBody.innerHTML = `<iframe src="songs/${song.noelle_pdf}" class="pdf-embed" width="100%" height="800px" frameborder="0"></iframe>`;
        keyDisplay.textContent = 'PDF';
        transposeToggle.style.display = 'none';
        return;
    }
    
    transposeToggle.style.display = 'flex';

    const raw = song._raw;
    if (!raw) return;

    songBody.innerHTML = extractSongHTML(song, showTiosShapes);

    // Update key display based on transpose state
    if (showTiosShapes) {
        keyDisplay.textContent = song.key || song.absolute_key || '?';
    } else {
        keyDisplay.textContent = song.absolute_key || song.key || '?';
    }
}

function extractSongHTML(song, useWrittenShapes) {
    const raw = song._raw;
    if (!raw) return '';

    const lines = raw.split('\n');
    const semitonesToAbsolute = song.transpose || 0;
    
    const html = [];
    let inSection = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip metadata headers
        if ( trimmed.startsWith('{') && trimmed.endsWith('}') ) {
            const inner = trimmed.slice(1, -1);

            // Comment directives
            if (inner.startsWith('comment:') || inner.startsWith('c:')) {
                const comment = inner.replace(/^c(?:omment)?:\s*/, '').trim();
                
                // Embed Logic
                if (comment.startsWith('http')) {
                    html.push(renderAudioEmbed(comment));
                } else {
                    html.push(`<div class="comment-line">— ${escapeHtml(comment)} —</div>`);
                }
            } 
            // Section Starts
            else if (inner.startsWith('start_of_') || inner.startsWith('soc') || inner.startsWith('sov')) {
                let type = 'section';
                let label = '';
                
                if (inner.startsWith('soc')) {
                    type = 'chorus';
                    label = 'Chorus';
                } else if (inner.startsWith('sov')) {
                    type = 'verse';
                    label = 'Verse';
                } else {
                    const match = inner.match(/^start_of_([a-z_]+)(?::\s*(.*))?$/i);
                    if (match) {
                        type = match[1].toLowerCase().replace(/_/g, '-');
                        label = match[2] || match[1].replace(/_/g, ' ');
                        // capitalize label
                        label = label.charAt(0).toUpperCase() + label.slice(1);
                    }
                }
                
                if (inSection) html.push(`</div>`); // Close previous if unclosed
                html.push(`<div class="song-section ${escapeHtml(type)}">`);
                if (label) html.push(`<div class="section-label">${escapeHtml(label)}</div>`);
                inSection = true;
            }
            // Section Ends
            else if (inner.startsWith('end_of_') || inner.startsWith('eoc') || inner.startsWith('eov')) {
                if (inSection) {
                    html.push(`</div>`);
                    inSection = false;
                }
            }
            // Skip other directives
            continue;
        }

        // Empty line
        if (!trimmed) {
            // Only add a break if we aren't at the very top or double spacing
            if (html.length > 0 && !html[html.length - 1].includes('section-break') && !html[html.length - 1].includes('class="song-section') && !inSection) {
               html.push('<div class="section-break"></div>');
            } else if (inSection && html.length > 0 && !html[html.length-1].includes('section-label')) {
               html.push('<div class="section-break"></div>');
            }
            continue;
        }

        // Parse inline [Chord] brackets
        if (trimmed.includes('[')) {
            html.push(renderChordLine(trimmed, useWrittenShapes ? 0 : semitonesToAbsolute));
        } else {
            // Plain lyric line
            html.push(`<div class="chord-line">${escapeHtml(trimmed)}</div>`);
        }
    }
    
    if (inSection) html.push('</div>'); // Ensure trailing sections are closed

    return html.join('\n');
}

function renderChordLine(line, semitones) {
    // Parse the ChordPro line into segments: each segment has an optional chord + text
    // Example: "[G]You're ok. [Gb]Part of me" → [{chord:"G", text:"You're ok. "}, {chord:"Gb", text:"Part of me"}]
    const segments = [];
    let i = 0;

    while (i < line.length) {
        const bracketStart = line.indexOf('[', i);
        if (bracketStart === -1) {
            // Remaining text with no chord
            const text = line.slice(i);
            if (text) {
                if (segments.length > 0) {
                    segments[segments.length - 1].text += text;
                } else {
                    segments.push({ chord: '', text });
                }
            }
            break;
        }

        // Text before the bracket (belongs to previous segment or is a no-chord prefix)
        if (bracketStart > i) {
            const prefix = line.slice(i, bracketStart);
            if (segments.length > 0) {
                segments[segments.length - 1].text += prefix;
            } else {
                segments.push({ chord: '', text: prefix });
            }
        }

        const bracketEnd = line.indexOf(']', bracketStart);
        if (bracketEnd === -1) {
            // Malformed — just add the rest as text
            segments.push({ chord: '', text: line.slice(bracketStart) });
            break;
        }

        const chord = line.slice(bracketStart + 1, bracketEnd);
        const displayChord = semitones !== 0 ? transposeChord(chord, semitones) : chord;

        // Start a new segment for this chord
        segments.push({ chord: displayChord, text: '' });
        i = bracketEnd + 1;
    }

    // If the entire line is just chords with no lyrics, render as a chord-only line
    const hasLyrics = segments.some(s => s.text.trim().length > 0);
    if (!hasLyrics) {
        const chordStr = segments.map(s => s.chord).filter(Boolean).join('  ');
        const cls = semitones !== 0 ? 'chord chord-transposed' : 'chord';
        return `<div class="chord-only-line"><span class="${cls}">${escapeHtml(chordStr)}</span></div>`;
    }

    // Build two-row display: chords on top, lyrics below, aligned in columns
    const cls = semitones !== 0 ? 'chord chord-transposed' : 'chord';
    let html = '<div class="chord-lyric-pair">';
    for (const seg of segments) {
        const chordHtml = seg.chord
            ? `<span class="${cls}">${escapeHtml(seg.chord)}</span>`
            : '&nbsp;';
        const textHtml = seg.text ? escapeHtml(seg.text) : '&nbsp;';
        html += `<span class="cl-col"><span class="cl-chord">${chordHtml}</span><span class="cl-lyric">${textHtml}</span></span>`;
    }
    html += '</div>';
    return html;
}

function renderAudioEmbed(url) {
    if (url.includes('soundcloud.com')) {
        return `<div class="audio-embed"><iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false"></iframe></div>`;
    } else if (url.includes('spotify.com')) {
        // basic parser for spotify track or album
        const path = new URL(url).pathname;
        return `<div class="audio-embed"><iframe style="border-radius:12px" src="https://open.spotify.com/embed${path}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
    } else {
        return `<a href="${escapeHtml(url)}" target="_blank" class="audio-link">Listen Audio ↗</a>`;
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);

// ── Setlist & Performance Subroutines ──

function updateSetlistCount() {
    setlistCount.textContent = setlist.length;
    localStorage.setItem('hazySetlist', JSON.stringify(setlist));
}

window.toggleSetlist = function(filename) {
    if (setlist.includes(filename)) {
        setlist = setlist.filter(f => f !== filename);
    } else {
        setlist.push(filename);
    }
    updateSetlistCount();
    renderIndex();
}

window.removeFromSetlist = function(index) {
    setlist.splice(index, 1);
    updateSetlistCount();
    renderSetlist();
}

function renderSetlist() {
    setlistGrid.innerHTML = '';
    if (setlist.length === 0) {
        setlistGrid.innerHTML = '<p class="no-results" style="color: var(--text-muted);">Your setlist is empty. Add songs from the home page.</p>';
        return;
    }
    
    setlist.forEach((filename, index) => {
        const song = manifest.find(s => s.filename === filename);
        if (!song) return;
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <div class="card-info" style="flex: 1;">
                <div class="card-title">${index + 1}. ${escapeHtml(song.title)}</div>
                <div class="card-artist">Key: <strong style="color:var(--chord-color)">${escapeHtml(song.absolute_key)}</strong> | ${song.capo ? 'Capo '+song.capo : 'No capo'} ${song.tuning==='baritone'?'| Baritone':''}</div>
            </div>
            <button class="remove-from-setlist-btn" onclick="removeFromSetlist(${index})" style="background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;padding:12px;">✕</button>
        `;
        setlistGrid.appendChild(card);
    });
}

async function startPerformance(fetchMissing = true) {
    if (fetchMissing) {
        performanceBody.innerHTML = '<p style="text-align:center; padding: 40px; color: var(--text-muted);">Generating performance view...</p>';
        setlistView.classList.remove('active');
        performanceView.classList.add('active');
    }
    
    let html = '';
    for (const filename of setlist) {
        const song = manifest.find(s => s.filename === filename);
        if (!song) continue;
        
        if (!song._raw) {
            try {
                const resp = await fetch(`songs/${song.filename}`);
                song._raw = await resp.text();
            } catch (e) {
                continue;
            }
        }
        
        const displayKey = showPerfTiosShapes ? (song.key||song.absolute_key||'?') : (song.absolute_key||song.key||'?');
        const capoS = song.capo ? 'Capo '+song.capo : 'No capo';
        const bari = song.tuning==='baritone' ? ' · Baritone' : '';
        
        html += `<div class="perf-song-divider" style="margin-top: 80px; padding-bottom: 20px; border-bottom: 2px solid var(--border);">
            <h2 style="font-family: var(--font-body); font-size: 2rem; margin-bottom: 8px;">${escapeHtml(song.title)}</h2>
            <div style="font-family: var(--font-body); font-size: 1rem; color: var(--text-muted);">Key: <strong style="color: var(--chord-color);">${escapeHtml(displayKey)}</strong> &nbsp;·&nbsp; ${capoS}${bari}</div>
        </div>`;
        
        if (song.noelle_pdf && !showPerfTiosShapes) {
             html += `<iframe src="songs/${song.noelle_pdf}" class="pdf-embed" width="100%" height="800px" frameborder="0" style="margin-top: 20px; border-radius: var(--radius);"></iframe>`;
        } else {
             html += `<div style="margin-top: 30px;">${extractSongHTML(song, showPerfTiosShapes)}</div>`;
        }
        
        // Huge padding so songs aren't visually confusing on same screen
        html += `<div style="height: 60vh;"></div>`; 
    }
    
    performanceBody.innerHTML = html;
    performanceBody.style.fontSize = perfFontSize + 'px';
    if (fetchMissing) window.scrollTo(0, 0);
}
