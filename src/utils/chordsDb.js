/**
 * Local chord fingering data from @tombatossals/chords-db.
 * No network requests — all data is bundled at build time.
 *
 * Supported instruments: guitar, ukulele.
 * Mandolin is not in chords-db; algorithmic voicings are used instead.
 */

import guitarData  from '@tombatossals/chords-db/lib/guitar.json';
import ukuleleData from '@tombatossals/chords-db/lib/ukulele.json';

// ─── Instrument configs for @techies23/react-chords rendering ───────────────

export const CHORD_DIAGRAM_CONFIGS = {
    guitar: {
        strings:      6,
        fretsOnChord: 4,
        name:         'Guitar',
        keys:         [],
        tunings:      { standard: ['E', 'A', 'D', 'G', 'B', 'E'] },
    },
    ukulele: {
        strings:      4,
        fretsOnChord: 4,
        name:         'Ukulele',
        keys:         [],
        tunings:      { standard: ['G', 'C', 'E', 'A'] },
    },
};

// ─── Key name mappings ───────────────────────────────────────────────────────

// Guitar chords-db uses: C Csharp D Eb E F Fsharp G Ab A Bb B
const GUITAR_KEY_MAP = {
    C: 'C', 'C#': 'Csharp', D: 'D', 'D#': 'Eb',
    E: 'E', F: 'F', 'F#': 'Fsharp', G: 'G',
    'G#': 'Ab', A: 'A', 'A#': 'Bb', B: 'B',
};

// Ukulele chords-db uses: A Ab B Bb C D Db E Eb F G Gb
const UKULELE_KEY_MAP = {
    C: 'C', 'C#': 'Db', D: 'D', 'D#': 'Eb',
    E: 'E', F: 'F', 'F#': 'Gb', G: 'G',
    'G#': 'Ab', A: 'A', 'A#': 'Bb', B: 'B',
};

// ─── Chord type mapping: FretForge names → chords-db suffix ─────────────────

const TYPE_MAP = {
    major:      'major',
    minor:      'minor',
    dominant7:  '7',
    major7:     'maj7',
    minor7:     'm7',
    diminished: 'dim',
    augmented:  'aug',
};

// ─── Internal helpers ────────────────────────────────────────────────────────

function getDb(instrument) {
    if (instrument === 'guitar')  return { db: guitarData,  keyMap: GUITAR_KEY_MAP  };
    if (instrument === 'ukulele') return { db: ukuleleData, keyMap: UKULELE_KEY_MAP };
    return null;
}

/**
 * Look up raw chords-db positions for a chord.
 * Returns the native chords-db position array or null if not found.
 * These can be passed directly to the @techies23/react-chords Chord component.
 */
export function getRawDbPositions(instrument, root, chordType) {
    const entry = getDb(instrument);
    if (!entry) return null;
    const { db, keyMap } = entry;

    const dbKey  = keyMap[root];
    const dbType = TYPE_MAP[chordType];
    if (!dbKey || !dbType) return null;

    return db.chords[dbKey]?.find(g => g.suffix === dbType)?.positions ?? null;
}

/**
 * Convert a chords-db position to FretForge's internal Fingering format.
 *
 * chords-db string order: index 0 = lowest string (low E / G on uke)
 * FretForge string order: index 0 = highest string (high e / A on uke)
 * → Arrays are reversed.
 *
 * chords-db fret values are relative to baseFret.
 * FretForge uses absolute fret numbers.
 *   absolute = (fret <= 0) ? fret : baseFret + fret - 1
 */
function dbPositionToFingering(pos, idx) {
    // Reverse: chords-db low-to-high → FretForge high-to-low
    const revFrets   = [...pos.frets].reverse();
    const revFingers = [...(pos.fingers ?? [])].reverse();

    const absoluteFrets = revFrets.map(f => {
        if (f <= 0) return f;               // 0 = open, -1 = muted
        return pos.baseFret + f - 1;        // convert relative → absolute
    });

    const hasBarre = pos.barres?.length > 0;
    // barres[] holds relative fret values; convert first barre to absolute
    const barreStartFret = hasBarre ? (pos.baseFret + pos.barres[0] - 1) : null;
    const playedFrets = absoluteFrets.filter(f => f > 0);
    // A fingering is only "open" if it genuinely uses open strings — chords like Bb that sit
    // at baseFret=1 with no open strings are treated as barre so they sort by actual fret.
    const hasOpenString = absoluteFrets.some(f => f === 0);

    return {
        id:              String(idx),
        name:            hasBarre ? `Barre (${barreStartFret})` : 'Open',
        shape:           (pos.baseFret === 1 && !hasBarre && hasOpenString) ? 'open' : 'barre',
        frets:           absoluteFrets,
        fingers:         revFingers,
        barreStartFret,
        position:        playedFrets.length ? Math.min(...playedFrets) : 0,
        source:          'chords-db',
        // Keep raw data for react-chords rendering (no conversion needed)
        rawPosition:     pos,
    };
}

/**
 * Get fingerings in FretForge's Fingering format (used by fingeringsToPositionEntries).
 * Returns { open: Fingering[], barre: Fingering[] }.
 * Returns empty arrays for mandolin (not in database).
 */
export function getChordFingerings(instrument, root, chordType) {
    const rawPositions = getRawDbPositions(instrument, root, chordType);
    if (!rawPositions) return { open: [], barre: [] };

    const all = rawPositions.map((pos, i) => dbPositionToFingering(pos, i));
    return {
        open:  all.filter(f => f.shape === 'open'),
        barre: all.filter(f => f.shape === 'barre'),
    };
}

/** Instruments that use discrete strummed fingerings (vs. bass plucking logic). */
export const STRUMMED_INSTRUMENTS = new Set(['guitar', 'ukulele', 'mandolin']);
