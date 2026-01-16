import { MusicTheory } from './musicTheory';

export const Progressions = {
    romanNumerals: {
        major: {
            'I': { degree: 0, type: 'major', mode: 'ionian', seventh: 'major7' },
            'ii': { degree: 1, type: 'minor', mode: 'dorian', seventh: 'minor7' },
            'iii': { degree: 2, type: 'minor', mode: 'phrygian', seventh: 'minor7' },
            'IV': { degree: 3, type: 'major', mode: 'lydian', seventh: 'major7' },
            'V': { degree: 4, type: 'major', mode: 'mixolydian', seventh: 'dominant7' },
            'vi': { degree: 5, type: 'minor', mode: 'aeolian', seventh: 'minor7' },
            'vii°': { degree: 6, type: 'diminished', mode: 'locrian', seventh: 'diminished' }
        },
        minor: {
            'i': { degree: 0, type: 'minor', mode: 'aeolian', seventh: 'minor7' },
            'ii°': { degree: 1, type: 'diminished', mode: 'locrian', seventh: 'diminished' },
            'III': { degree: 2, type: 'major', mode: 'ionian', seventh: 'major7' },
            'iv': { degree: 3, type: 'minor', mode: 'dorian', seventh: 'minor7' },
            'v': { degree: 4, type: 'minor', mode: 'phrygian', seventh: 'minor7' },
            'VI': { degree: 5, type: 'major', mode: 'lydian', seventh: 'major7' },
            'VII': { degree: 6, type: 'major', mode: 'mixolydian', seventh: 'dominant7' }
        }
    },

    scaleIntervals: {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10]
    },

    parseProgression(progressionString, key, quality, use7ths = false) {
        const numerals = progressionString.split('-');
        const chords = [];
        const mapping = this.romanNumerals[quality];
        const intervals = this.scaleIntervals[quality];

        numerals.forEach(numeral => {
            const chordInfo = mapping[numeral];
            if (chordInfo) {
                const rootInterval = intervals[chordInfo.degree];
                const rootNote = MusicTheory.transposeNote(key, rootInterval);

                chords.push({
                    numeral: numeral,
                    root: rootNote,
                    type: use7ths ? chordInfo.seventh : chordInfo.type,
                    mode: chordInfo.mode
                });
            }
        });

        return chords;
    },

    getProgressions() {
        return [
            { name: 'I - IV - V', value: 'I-IV-V', use7ths: false },
            { name: 'I - V - vi - IV', value: 'I-V-vi-IV', use7ths: false },
            { name: 'I - IV - vi - V', value: 'I-IV-vi-V', use7ths: false },
            { name: 'I - vi - IV - V', value: 'I-vi-IV-V', use7ths: false },
            { name: 'vi - IV - I - V', value: 'vi-IV-I-V', use7ths: false },
            { name: 'I - iii - IV - V', value: 'I-iii-IV-V', use7ths: false },
            { name: 'I - IV - I - V', value: 'I-IV-I-V', use7ths: false },
            { name: 'I - V - IV - V', value: 'I-V-IV-V', use7ths: false },
            { name: 'I - vi - ii - V', value: 'I-vi-ii-V', use7ths: true },
            { name: 'ii - V - I', value: 'ii-V-I', use7ths: true },
            { name: 'iii - vi - ii - V', value: 'iii-vi-ii-V', use7ths: true },
            { name: 'I - III - IV - iv', value: 'I-III-IV-iv', use7ths: false },
            { name: 'i - VI - III - VII', value: 'i-VI-III-VII', use7ths: false },
            { name: 'i - iv - v', value: 'i-iv-v', use7ths: false },
            { name: 'i - VII - VI - VII', value: 'i-VII-VI-VII', use7ths: false },
            { name: 'i - iv - VII - III', value: 'i-iv-VII-III', use7ths: false },
            { name: 'i - VI - VII', value: 'i-VI-VII', use7ths: false },
            { name: 'i - III - VII - iv', value: 'i-III-VII-iv', use7ths: false }
        ];
    }
};