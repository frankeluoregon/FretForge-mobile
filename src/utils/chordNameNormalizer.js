/**
 * Normalizes ChordPro chord symbols to FretForge's { root, type } format.
 */
import { MusicTheory } from './musicTheory.js';

// Flat-to-sharp mapping
const FLAT_MAP = {
    Cb: 'B', Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#',
};

const ROOT_RE = /^([A-G][b#]?)/;

// Note validation set (after normalization)
const VALID_NOTES = new Set(MusicTheory.notes);

// Suffix patterns in priority order (most specific first)
const SUFFIX_RULES = [
    // Minor 7 variants (must come before minor and 7)
    { re: /^(?:m7|min7|-7|mi7)/, type: 'minor7' },
    // Major 7 variants (must come before major and 7)
    { re: /^(?:maj7|Maj7|M7|ma7|∆7|Δ7|△7)/, type: 'major7' },
    // Diminished (must come before minor — "dim" doesn't start with "m")
    { re: /^(?:dim|°|o)/, type: 'diminished' },
    // Augmented
    { re: /^(?:aug|\+)/, type: 'augmented' },
    // Dominant 7 (plain 7, 9, 11, 13 — after m7/maj7 ruled out)
    { re: /^[79]/, type: 'dominant7' },
    { re: /^1[13]/, type: 'dominant7' },
    // Minor variants (after m7 ruled out)
    { re: /^(?:m(?!aj)|min|-|mi)/, type: 'minor' },
    // Everything else (sus, add, 5, 6, empty) → major
];

/**
 * Normalize a ChordPro chord string.
 *
 * @param {string} chordStr  e.g. "Bbm7/D", "F#sus4", "C"
 * @returns {{ root: string, type: string, bass: string|null, original: string } | null}
 *          null if the string doesn't look like a chord
 */
export function normalizeChordName(chordStr) {
    if (!chordStr || !ROOT_RE.test(chordStr)) return null;

    const original = chordStr;

    // Split slash chord
    let mainPart = chordStr;
    let bass = null;
    const slashIdx = chordStr.indexOf('/');
    if (slashIdx > 0) {
        const afterSlash = chordStr.slice(slashIdx + 1);
        if (ROOT_RE.test(afterSlash) && afterSlash.length <= 2) {
            bass = normalizeRoot(afterSlash);
            mainPart = chordStr.slice(0, slashIdx);
        }
    }

    // Extract root
    const rootMatch = mainPart.match(ROOT_RE);
    if (!rootMatch) return null;

    const root = normalizeRoot(rootMatch[1]);
    if (!root) return null;

    // Determine type from suffix
    const suffix = mainPart.slice(rootMatch[1].length);
    let type = 'major'; // default

    for (const rule of SUFFIX_RULES) {
        if (rule.re.test(suffix)) {
            type = rule.type;
            break;
        }
    }

    return { root, type, bass, original };
}

/**
 * Normalize a root note name (handle flats → sharps).
 * @param {string} note
 * @returns {string|null}
 */
function normalizeRoot(note) {
    if (!note) return null;
    // Try flat mapping first
    if (note.length === 2 && note[1] === 'b') {
        const mapped = FLAT_MAP[note];
        if (mapped) return mapped;
    }
    // Check if it's valid as-is
    if (VALID_NOTES.has(note)) return note;
    // Single letter notes
    if (note.length === 1 && VALID_NOTES.has(note)) return note;
    return null;
}

/**
 * Transpose a chord by a number of semitones.
 * @param {{ root: string, type: string, bass: string|null, original: string }} chord
 * @param {number} semitones
 * @returns {{ root: string, type: string, bass: string|null, original: string }}
 */
export function transposeNormalizedChord(chord, semitones) {
    if (!chord || semitones === 0) return chord;
    const notes = MusicTheory.notes;
    const rootIdx = notes.indexOf(chord.root);
    const newRoot = notes[(rootIdx + semitones + 120) % 12];
    const newBass = chord.bass
        ? notes[(notes.indexOf(chord.bass) + semitones + 120) % 12]
        : null;
    return {
        root: newRoot,
        type: chord.type,
        bass: newBass,
        original: chord.original, // keep original display name context
    };
}
