/**
 * SmartChord API integration — pure fetch + cache logic (no React).
 *
 * SmartChord does not publish a public API spec.  Update SMARTCHORD_API_BASE
 * and adjust parseResponse() once you have access to their endpoint docs or
 * credentials.  The hook and App layer use these functions so only this file
 * needs updating when the real endpoint is confirmed.
 *
 * Assumed response shape (adapt parseResponse if theirs differs):
 * {
 *   chords: [
 *     {
 *       id: string,
 *       name: string,
 *       // frets per string; 0 = open, -1 = muted.
 *       // Convention assumed: frets[0] = highest string (high e on guitar).
 *       // If SmartChord uses low-to-high order, set SMARTCHORD_STRINGS_HIGH_TO_LOW = false.
 *       frets: number[],
 *       fingers: number[],
 *       barre: { fret: number, fromString: number, toString: number } | null,
 *       position: number,   // lowest non-open fret (neck position)
 *       difficulty: number  // 1–5 (optional)
 *     }
 *   ]
 * }
 */

// ─── Configuration ──────────────────────────────────────────────────────────

export const SMARTCHORD_API_BASE = 'https://api.smartchord.de/v1';

// Set false if SmartChord returns frets in low-to-high string order.
// FretForge uses index 0 = highest string internally.
const SMARTCHORD_STRINGS_HIGH_TO_LOW = true;

// SmartChord instrument slugs
const SC_INSTRUMENTS = {
    guitar:   'guitar',
    ukulele:  'ukulele',
    mandolin: 'mandolin',
};

// SmartChord chord-type slugs
const SC_TYPES = {
    major:      'major',
    minor:      'minor',
    dominant7:  '7',
    major7:     'maj7',
    minor7:     'm7',
    diminished: 'dim',
    augmented:  'aug',
};

// Number of courses SmartChord returns per instrument.
// Mandolin returns 4 (one per course); FretForge expands these to 8 paired strings.
const SC_COURSES = {
    guitar:   6,
    ukulele:  4,
    mandolin: 4,
};

// ─── Cache ───────────────────────────────────────────────────────────────────

const CACHE_PREFIX  = 'fretforge_sc2_';
const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, exp } = JSON.parse(raw);
        if (Date.now() > exp) { localStorage.removeItem(key); return null; }
        return data;
    } catch { return null; }
}

function writeCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, exp: Date.now() + CACHE_TTL_MS }));
    } catch { /* storage full — ignore */ }
}

// ─── Normalise note name (flats → sharps) ───────────────────────────────────

const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
function normalizeNote(note) {
    return FLAT_TO_SHARP[note] || note;
}

// ─── Response parser ─────────────────────────────────────────────────────────

/**
 * Parse a SmartChord API response into canonical Fingering objects.
 *
 * @typedef {Object} Fingering
 * @property {string}   id
 * @property {string}   name
 * @property {'open'|'barre'} shape
 * @property {number[]} frets           index 0 = highest string; 0=open -1=muted
 * @property {number[]} fingers         finger number per string
 * @property {number|null} barreStartFret  absolute fret of barre (null for open)
 * @property {number|null} barreFromString highest string index included in barre
 * @property {number|null} barreToString   lowest string index included in barre
 * @property {number}   position        lowest non-muted non-open fret (neck position)
 * @property {number}   difficulty      1–5
 * @property {'smartchord'} source
 */
function parseResponse(data, instrument) {
    const courses = SC_COURSES[instrument] || 6;
    if (!Array.isArray(data?.chords)) return [];

    return data.chords.map((c, idx) => {
        let rawFrets   = (c.frets   || []).slice(0, courses);
        let rawFingers = (c.fingers || []).slice(0, courses);

        // Reverse if API returns low-to-high but we need high-to-low
        if (!SMARTCHORD_STRINGS_HIGH_TO_LOW) {
            rawFrets   = [...rawFrets].reverse();
            rawFingers = [...rawFingers].reverse();
        }

        // Mandolin: expand 4-course → 8 paired strings (double each course value)
        const frets   = instrument === 'mandolin' ? rawFrets.flatMap(f   => [f,   f  ]) : rawFrets;
        const fingers = instrument === 'mandolin' ? rawFingers.flatMap(f => [f,   f  ]) : rawFingers;

        const barreStartFret = c.barre?.fret ?? null;
        const shape = barreStartFret !== null ? 'barre' : 'open';
        const playedFrets = frets.filter(f => f > 0);
        const position = playedFrets.length ? Math.min(...playedFrets) : 0;

        return {
            id:             c.id            ?? `${instrument}_${idx}`,
            name:           c.name          ?? '',
            shape,
            frets,
            fingers,
            barreStartFret,
            barreFromString: c.barre?.fromString ?? null,
            barreToString:   c.barre?.toString   ?? null,
            position,
            difficulty: c.difficulty ?? 3,
            source: 'smartchord',
        };
    });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch fingerings for a chord from SmartChord (with localStorage cache).
 * Returns { open: Fingering[], barre: Fingering[] } or throws on network error.
 *
 * @param {string}       instrument  'guitar' | 'ukulele' | 'mandolin'
 * @param {string}       root        Note name, e.g. 'C', 'F#', 'Bb'
 * @param {string}       chordType   e.g. 'major', 'minor7'
 * @param {AbortSignal}  [signal]    Optional AbortSignal for cancellation
 */
export async function fetchSmartChordFingerings(instrument, root, chordType, signal) {
    const scInstrument = SC_INSTRUMENTS[instrument];
    const scType       = SC_TYPES[chordType];
    if (!scInstrument || !scType) return { open: [], barre: [] };

    const normalRoot = normalizeNote(root);
    const cacheKey   = `${CACHE_PREFIX}${instrument}_${normalRoot}_${chordType}`;
    const cached     = readCache(cacheKey);
    if (cached) return cached;

    const url = `${SMARTCHORD_API_BASE}/chords/${scInstrument}/${encodeURIComponent(normalRoot)}/${scType}`;
    const res = await fetch(url, signal ? { signal } : {});
    if (!res.ok) throw new Error(`SmartChord HTTP ${res.status}`);

    const data   = await res.json();
    const all    = parseResponse(data, instrument);
    const result = {
        open:  all.filter(f => f.shape === 'open'),
        barre: all.filter(f => f.shape === 'barre'),
    };

    writeCache(cacheKey, result);
    return result;
}

/** Instruments that use discrete strummed fingerings (vs. bass plucking logic). */
export const STRUMMED_INSTRUMENTS = new Set(['guitar', 'ukulele', 'mandolin']);
