import { MusicTheory } from './musicTheory.js';

/**
 * Transpose a SmartChord fingering's fret array from one tuning to another.
 *
 * For each string, the pitch produced at (openNote + fret) must be preserved.
 * When the target string is tuned differently, we adjust the fret to compensate.
 *
 * @param {number[]} frets       Per-string frets; index 0 = highest string.
 *                               0 = open, -1 = muted.
 * @param {string[]} fromTuning  Open note per string in the source tuning.
 * @param {string[]} toTuning    Open note per string in the target tuning.
 * @param {number}   maxFret     Instrument maximum fret (notes beyond this are muted).
 * @returns {number[]}  Adjusted frets (-1 where the pitch can't be reached).
 */
export function transposeFretsToTuning(frets, fromTuning, toTuning, maxFret = 22) {
    return frets.map((fret, i) => {
        if (fret < 0) return -1;
        const fromOpen = fromTuning[i];
        const toOpen   = toTuning[i];
        if (!fromOpen || !toOpen) return -1;

        // shift = how many semitones higher the source open note is vs. the target open note.
        // Positive shift → target string is lower → we need more frets to reach the same pitch.
        const shift  = MusicTheory.getNoteIndex(fromOpen) - MusicTheory.getNoteIndex(toOpen);
        const newFret = fret + shift;

        if (newFret < 0 || newFret > maxFret) return -1;
        return newFret;
    });
}

/**
 * Convert a Fingering's frets array to a positions Set<"string-fret">.
 * Muted strings (-1) are excluded.
 *
 * @param {number[]} frets
 * @param {number}   capoFret  Add this offset to every fret (0 = no capo).
 * @returns {Set<string>}
 */
export function fretsToPositions(frets, capoFret = 0) {
    const positions = new Set();
    frets.forEach((fret, strIdx) => {
        if (fret >= 0) positions.add(`${strIdx}-${fret + capoFret}`);
    });
    return positions;
}

/**
 * Shift every fret in a positions Set by capoFret.
 * Used when converting open-chord shapes to absolute fret positions under a capo.
 *
 * @param {Set<string>} positions
 * @param {number}      capoFret
 * @returns {Set<string>}
 */
export function shiftPositionsByCapo(positions, capoFret) {
    if (!capoFret) return positions;
    const result = new Set();
    for (const pos of positions) {
        const [str, fret] = pos.split('-').map(Number);
        result.add(`${str}-${fret + capoFret}`);
    }
    return result;
}

/**
 * The chord root that a capo-shifted open shape actually sounds like.
 * e.g. playing a G shape with capo 2 → sounds like A.
 *
 * @param {string} playedRoot
 * @param {number} capoFret
 * @returns {string}
 */
export function soundingRoot(playedRoot, capoFret) {
    if (!capoFret) return playedRoot;
    return MusicTheory.transposeNote(playedRoot, capoFret);
}
