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

function computeGuitarVoicingAtFret(template, anchorFret) {
    const positions = new Set();
    template.offsets.forEach((offset, strIdx) => {
        if (offset !== null) positions.add(`${strIdx}-${anchorFret + offset}`);
    });
    return positions;
}

// For each string find the lowest chord tone at or above startFret
function computeUkuleleVoicing(root, chordType, tuning, startFret = 0) {
    const chordNotes = MusicTheory.getChordNotes(root, chordType);
    const positions = new Set();
    tuning.forEach((openNote, strIdx) => {
        const openBase = MusicTheory.getNoteIndex(openNote);
        let bestFret = Infinity;
        for (const note of chordNotes) {
            let fret = ((MusicTheory.getNoteIndex(note) - openBase) % 12 + 12) % 12;
            while (fret < startFret) fret += 12;
            if (fret < bestFret) bestFret = fret;
        }
        if (bestFret !== Infinity) positions.add(`${strIdx}-${bestFret}`);
    });
    return positions;
}

function getRootFret(positions, root, tuning) {
    let rootFret = Infinity;
    for (const pos of positions) {
        const [strIdx, fret] = pos.split('-').map(Number);
        if (MusicTheory.areNotesEqual(MusicTheory.transposeNote(tuning[strIdx], fret), root)) {
            if (fret < rootFret) rootFret = fret;
        }
    }
    return rootFret === Infinity ? null : rootFret;
}

// Returns the shape/family options for the global nav voicing selector
export function getVoicingFamilies(instrument) {
    if (instrument === 'guitar') {
        return [
            { value: 'E-family', label: 'E-family' },
            { value: 'A-family', label: 'A-family' },
        ];
    }
    if (instrument === 'ukulele') {
        return [
            { value: 'slot-0', label: 'Open' },
            { value: 'slot-1', label: '2nd pos' },
            { value: 'slot-2', label: '3rd pos' },
            { value: 'slot-3', label: '4th pos' },
        ];
    }
    return [];
}

// Returns the single best voicing for a chord given a global family/shape selection
export function getVoicingForFamily(root, chordType, instrument, tuning, family) {
    if (!family) return null;
    const voicings = getVoicingsForChord(root, chordType, instrument, tuning);
    if (!voicings.length) return null;
    if (instrument === 'guitar') {
        const prefix = family === 'E-family' ? 'E' : 'A';
        return voicings.find(v => v.name.startsWith(prefix)) || null;
    }
    if (instrument === 'ukulele') {
        const slot = parseInt(family.replace('slot-', ''));
        return voicings[slot] || null;
    }
    return null;
}

export function getVoicingsForChord(root, chordType, instrument, tuning) {
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
                    positions: computeGuitarVoicingAtFret(tpl, anchorFret),
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
        const seenPositions = new Set();
        [...baseStartFrets].sort((a, b) => a - b).forEach(baseStartFret => {
            let startFret = baseStartFret;
            while (startFret <= maxFrets) {
                if (!seenPositions.has(startFret)) {
                    seenPositions.add(startFret);
                    const pos = computeUkuleleVoicing(root, chordType, tuning, startFret);
                    const maxFret = Math.max(...Array.from(pos).map(p => parseInt(p.split('-')[1])));
                    if (maxFret <= maxFrets) {
                        const rootFret = getRootFret(pos, root, tuning) ?? startFret;
                        result.push({
                            name: `Fret ${rootFret}`,
                            position: rootFret,
                            positions: pos,
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
