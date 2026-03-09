import { MusicTheory } from './musicTheory.js';
import { fretsToPositions, transposeFretsToTuning } from './tuningTransposer.js';

export const INSTRUMENT_MAX_FRETS = {
    guitar: 24,
    bass4: 24,
    bass5: 24,
    bass6: 24,
    ukulele: 22,
    mandolin: 18,
};

// Barre chord templates derived from movable open chord shapes.
// offsets[i] = frets above the barre for string i (0=high e … 5=low E).
// null = string not played.
// anchorString = string where root falls (determines barre fret).
const GUITAR_BARRE_TEMPLATES = {
    major: [
        { name: 'E-shape',  anchorString: 5, offsets: [0, 0, 1, 2, 2, 0] },
        { name: 'A-shape',  anchorString: 4, offsets: [0, 2, 2, 2, 0, null] },
        { name: 'D-shape',  anchorString: 3, offsets: [2, 3, 2, 0, null, null] },
    ],
    minor: [
        { name: 'Em-shape', anchorString: 5, offsets: [0, 0, 0, 2, 2, 0] },
        { name: 'Am-shape', anchorString: 4, offsets: [0, 1, 2, 2, 0, null] },
        { name: 'Dm-shape', anchorString: 3, offsets: [1, 3, 2, 0, null, null] },
    ],
    dominant7: [
        { name: 'E7-shape', anchorString: 5, offsets: [0, 0, 1, 0, 2, 0] },
        { name: 'A7-shape', anchorString: 4, offsets: [0, 2, 0, 2, 0, null] },
        { name: 'D7-shape', anchorString: 3, offsets: [2, 1, 2, 0, null, null] },
    ],
    major7: [
        { name: 'Emaj7-shape', anchorString: 5, offsets: [0, 0, 1, 1, 2, 0] },
        { name: 'Amaj7-shape', anchorString: 4, offsets: [0, 2, 1, 2, 0, null] },
        { name: 'Dmaj7-shape', anchorString: 3, offsets: [2, 2, 2, 0, null, null] },
    ],
    minor7: [
        { name: 'Em7-shape',  anchorString: 5, offsets: [0, 0, 0, 0, 2, 0] },
        { name: 'Am7-shape',  anchorString: 4, offsets: [0, 1, 0, 2, 0, null] },
        { name: 'Dm7-shape',  anchorString: 3, offsets: [1, 1, 2, 0, null, null] },
    ],
    diminished: [
        { name: 'Edim-shape', anchorString: 5, offsets: [null, null, 0, 2, 1, 0] },
        { name: 'Adim-shape', anchorString: 4, offsets: [null, 1, 2, 1, 0, null] },
    ],
    augmented: [
        { name: 'Eaug-shape', anchorString: 5, offsets: [0, 1, 1, 2, 3, 0] },
        { name: 'Aaug-shape', anchorString: 4, offsets: [null, 2, 2, 3, 0, null] },
    ],
};

// Build a positions Set from a template at a given anchor fret.
function computeBarrePositions(template, anchorFret) {
    const positions = new Set();
    template.offsets.forEach((offset, strIdx) => {
        if (offset !== null) positions.add(`${strIdx}-${anchorFret + offset}`);
    });
    return positions;
}

// Open position: for each string find the lowest chord tone at frets 0–4.
// Prefers open strings; skips a string if no chord tone falls in range.
function computeOpenPosition(root, chordType, tuning) {
    const chordNotes = MusicTheory.getChordNotes(root, chordType);
    const positions = new Set();
    tuning.forEach((openNote, strIdx) => {
        for (let fret = 0; fret <= 4; fret++) {
            const note = MusicTheory.transposeNote(openNote, fret);
            if (chordNotes.some(n => MusicTheory.areNotesEqual(note, n))) {
                positions.add(`${strIdx}-${fret}`);
                break;
            }
        }
    });
    return positions;
}

/**
 * Convert SmartChord Fingering objects to position entries compatible with
 * getPositionsForChord's return format.
 *
 * If the instrument tuning differs from standard, pass fromTuning (standard)
 * and toTuning (current) to transpose fret positions automatically.
 *
 * @param {{ open: Fingering[], barre: Fingering[] }} fingerings  From SmartChord hook
 * @param {number}   capoFret    0 = no capo; open shapes are shifted by this amount
 * @param {string[]} [fromTuning]  Standard tuning (source of SmartChord fingerings)
 * @param {string[]} [toTuning]    Current tuning (target; omit if same as standard)
 * @param {number}   [maxFret=24]
 * @returns {Array<{name:string, position:number, positions:Set, source:string}>|null}
 *          null when no fingerings are available (caller should use algorithmic fallback)
 */
export function fingeringsToPositionEntries(fingerings, capoFret = 0, fromTuning, toTuning, maxFret = 24) {
    if (!fingerings || (fingerings.open.length === 0 && fingerings.barre.length === 0)) {
        return null;
    }

    const needsTranspose = fromTuning && toTuning &&
        fromTuning.some((note, i) => note !== toTuning[i]);

    const adaptFrets = (frets) =>
        needsTranspose
            ? transposeFretsToTuning(frets, fromTuning, toTuning, maxFret)
            : frets;

    const entries = [];

    for (const f of fingerings.open) {
        const frets = adaptFrets(f.frets);
        const positions = fretsToPositions(frets, capoFret);
        if (positions.size === 0) continue;
        entries.push({
            name: f.name || 'Open',
            position: capoFret,
            positions,
            source: 'smartchord',
            shape: 'open',
            barreStartFret: null,
        });
    }

    for (const f of fingerings.barre) {
        const frets = adaptFrets(f.frets);
        const positions = fretsToPositions(frets, 0); // barre frets are already absolute
        if (positions.size === 0) continue;
        const minPlayedFret = Math.min(...frets.filter(x => x > 0));
        entries.push({
            name: f.name || `Barre (${f.barreStartFret ?? minPlayedFret})`,
            position: f.barreStartFret ?? minPlayedFret,
            positions,
            source: 'smartchord',
            shape: 'barre',
            barreStartFret: f.barreStartFret ?? minPlayedFret,
        });
    }

    if (entries.length === 0) return null;
    entries.sort((a, b) => a.position - b.position);
    return entries;
}

// Returns the position closest to targetFret.
// Pass precomputedPositions (from fingeringsToPositionEntries or getPositionsForChord)
// to skip re-computation.
export function getPositionAtFret(root, chordType, instrument, tuning, targetFret, precomputedPositions = null) {
    const positions = precomputedPositions || getPositionsForChord(root, chordType, instrument, tuning);
    if (!positions.length) return null;
    return positions.reduce((best, p) =>
        Math.abs(p.position - targetFret) < Math.abs(best.position - targetFret) ? p : best
    );
}

export function getPositionsForChord(root, chordType, instrument, tuning) {
    const maxFrets = INSTRUMENT_MAX_FRETS[instrument] || 24;

    if (instrument === 'guitar') {
        const result = [];

        // Position 0: open chord (first position, open strings)
        const openPositions = computeOpenPosition(root, chordType, tuning);
        if (openPositions.size > 0) {
            result.push({
                name: 'Open',
                position: 0,
                positions: openPositions,
            });
        }

        // Barre positions: one per template shape, repeating up the neck
        for (const tpl of GUITAR_BARRE_TEMPLATES[chordType] || []) {
            const rootIdx = MusicTheory.getNoteIndex(root);
            const anchorIdx = MusicTheory.getNoteIndex(tuning[tpl.anchorString]);
            const maxOffset = Math.max(...tpl.offsets.filter(o => o !== null));

            // Find first anchorFret >= 1 where root falls on the anchor string
            let anchorFret = ((rootIdx - anchorIdx) % 12 + 12) % 12;
            if (anchorFret === 0) anchorFret = 12; // fret 0 is covered by open position

            while (anchorFret + maxOffset <= maxFrets) {
                result.push({
                    name: `${tpl.name} (${anchorFret})`,
                    position: anchorFret,
                    positions: computeBarrePositions(tpl, anchorFret),
                });
                anchorFret += 12;
            }
        }

        // Sort by position so the slider moves logically up the neck
        result.sort((a, b) => a.position - b.position);
        return result;
    }

    if (instrument === 'ukulele') {
        const chordNotes = MusicTheory.getChordNotes(root, chordType);
        const result = [];

        // Position 0: open chord (frets 0–4)
        const openPositions = computeOpenPosition(root, chordType, tuning);
        if (openPositions.size > 0) {
            result.push({ name: 'Open', position: 0, positions: openPositions });
        }

        // Higher positions: for each fret where root appears on any string,
        // build a voicing by finding nearest chord tone per string within a 4-fret window.
        const rootIdx = MusicTheory.getNoteIndex(root);
        const seenAnchors = new Set([0]);

        tuning.forEach((openNote) => {
            const openBase = MusicTheory.getNoteIndex(openNote);
            let anchor = ((rootIdx - openBase) % 12 + 12) % 12;
            if (anchor === 0) anchor = 12;

            while (anchor <= maxFrets) {
                if (!seenAnchors.has(anchor)) {
                    seenAnchors.add(anchor);
                    const positions = new Set();
                    tuning.forEach((strOpen, strIdx) => {
                        for (let fret = anchor; fret <= anchor + 4; fret++) {
                            const note = MusicTheory.transposeNote(strOpen, fret);
                            if (chordNotes.some(n => MusicTheory.areNotesEqual(note, n))) {
                                if (fret <= maxFrets) positions.add(`${strIdx}-${fret}`);
                                break;
                            }
                        }
                    });
                    if (positions.size > 0) {
                        result.push({ name: `Fret ${anchor}`, position: anchor, positions });
                    }
                }
                anchor += 12;
            }
        });

        result.sort((a, b) => a.position - b.position);
        return result;
    }

    // Mandolin: compute voicings on the 4 unique courses (skip paired strings — odd indices).
    // Uses the same windowed chord-tone search as ukulele.
    if (instrument === 'mandolin') {
        const chordNotes = MusicTheory.getChordNotes(root, chordType);
        const result = [];

        // Build a 4-element "effective tuning" from the even-indexed strings (one per course)
        const courseTuning = tuning.filter((_, i) => i % 2 === 0); // ['E','A','D','G']

        const openPositionsCourses = computeOpenPosition(root, chordType, courseTuning);
        if (openPositionsCourses.size > 0) {
            // Map course positions back to paired-string positions (course i → strings 2i and 2i+1)
            const expanded = new Set();
            for (const pos of openPositionsCourses) {
                const [courseIdx, fret] = pos.split('-').map(Number);
                expanded.add(`${courseIdx * 2}-${fret}`);
                expanded.add(`${courseIdx * 2 + 1}-${fret}`);
            }
            result.push({ name: 'Open', position: 0, positions: expanded });
        }

        const rootIdx = MusicTheory.getNoteIndex(root);
        const seenAnchors = new Set([0]);
        courseTuning.forEach((openNote) => {
            const openBase = MusicTheory.getNoteIndex(openNote);
            let anchor = ((rootIdx - openBase) % 12 + 12) % 12;
            if (anchor === 0) anchor = 12;
            while (anchor <= maxFrets) {
                if (!seenAnchors.has(anchor)) {
                    seenAnchors.add(anchor);
                    const coursePositions = new Set();
                    courseTuning.forEach((strOpen, courseIdx) => {
                        for (let fret = anchor; fret <= anchor + 4; fret++) {
                            const note = MusicTheory.transposeNote(strOpen, fret);
                            if (chordNotes.some(n => MusicTheory.areNotesEqual(note, n))) {
                                if (fret <= maxFrets) coursePositions.add(`${courseIdx}-${fret}`);
                                break;
                            }
                        }
                    });
                    if (coursePositions.size > 0) {
                        const expanded = new Set();
                        for (const pos of coursePositions) {
                            const [courseIdx, fret] = pos.split('-').map(Number);
                            expanded.add(`${courseIdx * 2}-${fret}`);
                            expanded.add(`${courseIdx * 2 + 1}-${fret}`);
                        }
                        result.push({ name: `Fret ${anchor}`, position: anchor, positions: expanded });
                    }
                }
                anchor += 12;
            }
        });

        result.sort((a, b) => a.position - b.position);
        return result;
    }

    return [];
}
