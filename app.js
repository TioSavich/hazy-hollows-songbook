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
let isTransposed = false;
let fontSize = 17;

// ── DOM refs ──
const indexView = document.getElementById('index-view');
const songView = document.getElementById('song-view');
const songGrid = document.getElementById('song-grid');
const searchInput = document.getElementById('search-input');
const backBtn = document.getElementById('back-btn');
const transposeToggle = document.getElementById('transpose-toggle');
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

let activeFilter = 'all';

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

    renderIndex();
    setupEvents();

    // Check URL hash for direct song link
    if (location.hash) {
        const filename = decodeURIComponent(location.hash.slice(1));
        const song = manifest.find(s => s.filename === filename);
        if (song) openSong(song);
    }
}

function renderIndex() {
    const query = searchInput.value.toLowerCase().trim();
    let filtered = manifest;

    if (activeFilter !== 'all') {
        filtered = filtered.filter(s => s.type === activeFilter);
    }

    if (query) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(query) ||
            (s.artist && s.artist.toLowerCase().includes(query)) ||
            s.written_key.toLowerCase().includes(query) ||
            s.absolute_key.toLowerCase().includes(query)
        );
    }

    // Sort by title
    filtered.sort((a, b) => a.title.localeCompare(b.title));

    if (filtered.length === 0) {
        songGrid.innerHTML = '<p class="no-results">No songs match your search.</p>';
        return;
    }

    songGrid.innerHTML = filtered.map(song => {
        const artistLine = song.type === 'cover' ? song.artist : 'Tio Savich';
        const tuningLabel = song.tuning === 'baritone' ? ' (Bari)' : '';
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
            activeFilter = pill.dataset.filter;
            renderIndex();
        });
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
        isTransposed = !isTransposed;
        transposeToggle.classList.toggle('active', isTransposed);
        toggleLabel.textContent = isTransposed ? "Band's Absolute" : "Tio's Shapes";
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
    isTransposed = false;
    transposeToggle.classList.remove('active');
    toggleLabel.textContent = "Tio's Shapes";

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
    const raw = song._raw;
    if (!raw) return;

    const lines = raw.split('\n');
    const semitones = song.semitones || 0;
    const html = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip metadata headers
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const inner = trimmed.slice(1, -1);

            // Comment directives → display as styled comment
            if (inner.startsWith('comment:') || inner.startsWith('c:')) {
                const comment = inner.replace(/^c(?:omment)?:\s*/, '');
                html.push(`<div class="comment-line">— ${escapeHtml(comment)} —</div>`);
            }
            // Skip other directives (title, artist, capo, etc.)
            continue;
        }

        // Empty line → section break
        if (!trimmed) {
            html.push('<div class="section-break"></div>');
            continue;
        }

        // Parse inline [Chord] brackets
        if (trimmed.includes('[')) {
            html.push(renderChordLine(trimmed, isTransposed ? semitones : 0));
        } else {
            // Plain lyric line
            html.push(`<div class="chord-line">${escapeHtml(trimmed)}</div>`);
        }
    }

    songBody.innerHTML = html.join('\n');

    // Update key display based on transpose state
    if (isTransposed && song.absolute_key && song.absolute_key !== '?') {
        keyDisplay.textContent = song.absolute_key;
    } else {
        keyDisplay.textContent = song.written_key || song.absolute_key;
    }
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

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);
