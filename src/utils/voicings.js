import { MusicTheory } from './musicTheory.js';

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

function computeGuitarVoicing(template, root, tuning) {
    const rootIdx = MusicTheory.getNoteIndex(root);
    const anchorIdx = MusicTheory.getNoteIndex(tuning[template.anchorString]);
    const anchorFret = ((rootIdx - anchorIdx) % 12 + 12) % 12;

    const positions = new Set();
    template.offsets.forEach((offset, strIdx) => {
        if (offset !== null) positions.add(`${strIdx}-${anchorFret + offset}`);
    });
    return positions;
}

// For each string find the lowest fret where any chord tone appears
function computeUkuleleVoicing(root, chordType, tuning) {
    const chordNotes = MusicTheory.getChordNotes(root, chordType);
    const positions = new Set();
    tuning.forEach((openNote, strIdx) => {
        const openBase = MusicTheory.getNoteIndex(openNote);
        let bestFret = Infinity;
        for (const note of chordNotes) {
            const fret = ((MusicTheory.getNoteIndex(note) - openBase) % 12 + 12) % 12;
            if (fret < bestFret) bestFret = fret;
        }
        if (bestFret !== Infinity) positions.add(`${strIdx}-${bestFret}`);
    });
    return positions;
}

export function getVoicingsForChord(root, chordType, instrument, tuning) {
    if (instrument === 'guitar') {
        return (GUITAR_TEMPLATES[chordType] || []).map(tpl => ({
            name: tpl.name,
            positions: computeGuitarVoicing(tpl, root, tuning),
        }));
    }
    if (instrument === 'ukulele') {
        return [{ name: 'Open', positions: computeUkuleleVoicing(root, chordType, tuning) }];
    }
    return [];
}
