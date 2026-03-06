import { MusicTheory } from './musicTheory.js';

export const INSTRUMENT_MAX_FRETS = {
    guitar: 24,
    bass4: 24,
    bass5: 24,
    bass6: 24,
    ukulele: 22,
    mandolin: 18,
};

// Guitar barre chord templates
// offsets indexed by stringIndex (0 = high E, 5 = low E); null = skip string
// anchorString = string where root is placed
const GUITAR_TEMPLATES = {
    major: [
        { name: 'E-shape', anchorString: 5, offsets: [0, 0, 1, 2, 2, 0] },
        { name: 'A-shape', anchorString: 4, offsets: [0, 2, 2, 2, 0, null] },
    ],
    minor: [
        { name: 'Em-shape', anchorString: 5, offsets: [0, 0, 0, 2, 2, 0] },
        { name: 'Am-shape', anchorString: 4, offsets: [0, 1, 2, 2, 0, null] },
    ],
    dominant7: [
        { name: 'E7-shape', anchorString: 5, offsets: [0, 0, 1, 0, 2, 0] },
        { name: 'A7-shape', anchorString: 4, offsets: [0, 2, 0, 2, 0, null] },
    ],
    major7: [
        { name: 'Emaj7-shape', anchorString: 5, offsets: [0, 0, 1, 1, 2, 0] },
        { name: 'Amaj7-shape', anchorString: 4, offsets: [0, 2, 1, 2, 0, null] },
    ],
    minor7: [
        { name: 'Em7-shape', anchorString: 5, offsets: [0, 0, 0, 0, 2, 0] },
        { name: 'Am7-shape', anchorString: 4, offsets: [0, 1, 0, 2, 0, null] },
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

function computeGuitarPositionAtFret(template, anchorFret) {
    const fretPositions = new Set();
    template.offsets.forEach((offset, strIdx) => {
        if (offset !== null) fretPositions.add(`${strIdx}-${anchorFret + offset}`);
    });
    return fretPositions;
}

// For each string find the lowest chord tone at or above startFret.
// If the open string is a chord tone, always prefer fret 0.
function computeUkulelePosition(root, chordType, tuning, startFret = 0) {
    const chordNotes = MusicTheory.getChordNotes(root, chordType);
    const fretPositions = new Set();
    tuning.forEach((openNote, strIdx) => {
        const openBase = MusicTheory.getNoteIndex(openNote);
        const openIsChordTone = chordNotes.some(note =>
            ((MusicTheory.getNoteIndex(note) - openBase) % 12 + 12) % 12 === 0
        );
        if (openIsChordTone) {
            fretPositions.add(`${strIdx}-0`);
            return;
        }
        let bestFret = Infinity;
        for (const note of chordNotes) {
            let fret = ((MusicTheory.getNoteIndex(note) - openBase) % 12 + 12) % 12;
            if (fret === 0) fret = 12; // open already handled above
            while (fret < startFret) fret += 12;
            if (fret < bestFret) bestFret = fret;
        }
        if (bestFret !== Infinity) fretPositions.add(`${strIdx}-${bestFret}`);
    });
    return fretPositions;
}

function getMinFrettedNote(fretPositions) {
    let min = Infinity;
    for (const pos of fretPositions) {
        const fret = parseInt(pos.split('-')[1]);
        if (fret > 0 && fret < min) min = fret;
    }
    return min === Infinity ? 0 : min;
}

function getRootFret(fretPositions, root, tuning) {
    let rootFret = Infinity;
    for (const pos of fretPositions) {
        const [strIdx, fret] = pos.split('-').map(Number);
        if (MusicTheory.areNotesEqual(MusicTheory.transposeNote(tuning[strIdx], fret), root)) {
            if (fret < rootFret) rootFret = fret;
        }
    }
    return rootFret === Infinity ? null : rootFret;
}

// Returns the position closest to targetFret
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
        for (const tpl of GUITAR_TEMPLATES[chordType] || []) {
            const rootIdx = MusicTheory.getNoteIndex(root);
            const anchorIdx = MusicTheory.getNoteIndex(tuning[tpl.anchorString]);
            let anchorFret = ((rootIdx - anchorIdx) % 12 + 12) % 12;
            const maxOffset = Math.max(...tpl.offsets.filter(o => o !== null));
            while (anchorFret + maxOffset <= maxFrets) {
                result.push({
                    name: `${tpl.name} (${anchorFret})`,
                    position: anchorFret,
                    positions: computeGuitarPositionAtFret(tpl, anchorFret),
                });
                anchorFret += 12;
            }
        }
        return result;
    }

    if (instrument === 'ukulele') {
        const rootIdx = MusicTheory.getNoteIndex(root);
        // Collect all frets (0–11) where root appears on any string
        const baseStartFrets = new Set();
        tuning.forEach((openNote) => {
            const openBase = MusicTheory.getNoteIndex(openNote);
            baseStartFrets.add(((rootIdx - openBase) % 12 + 12) % 12);
        });

        const result = [];
        const seenMinFrets = new Set();
        [...baseStartFrets].sort((a, b) => a - b).forEach(baseStartFret => {
            let startFret = baseStartFret;
            while (startFret <= maxFrets) {
                const fretPos = computeUkulelePosition(root, chordType, tuning, startFret);
                const maxFret = Math.max(...Array.from(fretPos).map(p => parseInt(p.split('-')[1])));
                if (maxFret <= maxFrets) {
                    const minFret = getMinFrettedNote(fretPos);
                    if (!seenMinFrets.has(minFret)) {
                        seenMinFrets.add(minFret);
                        result.push({
                            name: `Fret ${minFret}`,
                            position: minFret,
                            positions: fretPos,
                        });
                    }
                }
                startFret += 12;
            }
        });
        result.sort((a, b) => a.position - b.position);
        return result;
    }

    return [];
}
