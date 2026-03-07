import { MusicTheory } from './musicTheory.js';

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

// Returns the position closest to targetFret.
export function getPositionAtFret(root, chordType, instrument, tuning, targetFret) {
    const positions = getPositionsForChord(root, chordType, instrument, tuning);
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

    return [];
}
