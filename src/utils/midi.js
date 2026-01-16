import * as Tone from 'tone';
import { MusicTheory } from './musicTheory';

export const MIDIPlayer = {
    samplers: {},
    loadingPromise: null,
    baseUrl: '/samples/', // Points to public/samples/

    instruments: {
        guitar: { type: 'guitar-electric', name: 'Electric Guitar' },
        bass4: { type: 'bass-electric', name: 'Electric Bass' },
        bass5: { type: 'bass-electric', name: 'Electric Bass' },
        bass6: { type: 'bass-electric', name: 'Electric Bass' },
        ukulele: { type: 'guitar-nylon', name: 'Nylon Guitar' },
        mandolin: { type: 'guitar-nylon', name: 'Mandolin' },
        banjo: { type: 'guitar-electric', name: 'Banjo' }
    },

    preload() {
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                this.samplers = {
                    'guitar-electric': new Tone.Sampler({
                        urls: {
                            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
                            C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3",
                            "C#2": "Cs2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3", "D#5": "Ds5.mp3",
                            E2: "E2.mp3", "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3"
                        },
                        baseUrl: this.baseUrl + "guitar-electric/",
                        release: 1,
                    }).toDestination(),

                    'guitar-nylon': new Tone.Sampler({
                        urls: {
                            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
                            "A#5": "As5.mp3", B1: "B1.mp3", B2: "B2.mp3", B3: "B3.mp3", B4: "B4.mp3",
                            "C#3": "Cs3.mp3", "C#4": "Cs4.mp3", "C#5": "Cs5.mp3",
                            D2: "D2.mp3", D3: "D3.mp3", D5: "D5.mp3", "D#4": "Ds4.mp3",
                            E2: "E2.mp3", E3: "E3.mp3", E4: "E4.mp3", E5: "E5.mp3",
                            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3",
                            G3: "G3.mp3", G5: "G5.mp3", "G#2": "Gs2.mp3", "G#4": "Gs4.mp3", "G#5": "Gs5.mp3"
                        },
                        baseUrl: this.baseUrl + "guitar-nylon/",
                        release: 1,
                    }).toDestination(),

                    'bass-electric': new Tone.Sampler({
                        urls: {
                            A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3",
                            C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3",
                            "C#2": "Cs2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3",
                            E2: "E2.mp3", "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3"
                        },
                        baseUrl: this.baseUrl + "guitar-electric/",
                        release: 1.5,
                    }).toDestination()
                };

                this.samplers['guitar-electric'].volume.value = -8;
                this.samplers['guitar-nylon'].volume.value = -8;
                this.samplers['bass-electric'].volume.value = -6;

                await Tone.loaded();
                console.log("Samples loaded");
            } catch (error) {
                console.error('Error initializing samplers:', error);
                this.initFallbackSynth();
            }
        })();

        return this.loadingPromise;
    },

    async init() {
        // 1. Try to resume AudioContext (requires user gesture)
        if (Tone.context.state !== 'running') {
            try {
                await Tone.start();
            } catch (e) { /* Ignore if no gesture yet */ }
        }

        // 2. Ensure samples are loading/loaded
        if (!this.loadingPromise) this.preload();
        await this.loadingPromise;
    },

    initFallbackSynth() {
        const definitions = {
            'guitar-electric': {
                oscillator: { type: "sawtooth" },
                envelope: { attack: 0.02, decay: 0.8, sustain: 0.4, release: 1.5 },
                filter: { Q: 1, type: "lowpass", rolloff: -12 },
                filterEnvelope: { attack: 0.01, decay: 0.5, baseFrequency: 200, octaves: 4 }
            },
            'guitar-nylon': {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 1 },
                filter: { Q: 0.5, type: "lowpass", rolloff: -12 },
                filterEnvelope: { attack: 0.04, decay: 0.4, sustain: 0.1, baseFrequency: 300, octaves: 2 }
            },
            'bass-electric': {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.2 },
                filter: { Q: 2, type: "lowpass", rolloff: -24 },
                filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.1, baseFrequency: 100, octaves: 3 }
            }
        };

        this.samplers = {};
        
        Object.keys(definitions).forEach(key => {
            this.samplers[key] = new Tone.PolySynth(Tone.MonoSynth, definitions[key]).toDestination();
        });

        // Volume adjustments for balance
        if (this.samplers['guitar-electric']) this.samplers['guitar-electric'].volume.value = -5;
    },

    getSampler(instrument) {
        const instrumentConfig = this.instruments[instrument] || this.instruments.guitar;
        return this.samplers[instrumentConfig.type];
    },

    async playSingleNote(toneNote, instrument, duration = 0.8) {
        try {
            await this.init();
            const sampler = this.getSampler(instrument);
            if (sampler) sampler.triggerAttackRelease(toneNote, duration);
        } catch (error) {
            console.error("Error in playSingleNote:", error);
        }
    },

    getMidiNoteAtPosition(stringIndex, fret, instrument, tuning) {
        const baseOctaves = this.getBaseOctaves(instrument);
        if (stringIndex >= tuning.length) return null;

        const openNoteName = tuning[stringIndex];
        const baseOctave = baseOctaves[stringIndex];
        const openMidi = this.noteToMidi(openNoteName + baseOctave);
        return openMidi + fret;
    },

    noteToMidi(noteName) {
        const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        const match = noteName.match(/^([A-G][#b]?)(\d?)$/);
        if (!match) return 60;
        const note = match[1];
        const octave = match[2] ? parseInt(match[2]) : 4;
        return (octave + 1) * 12 + noteMap[note];
    },

    midiToToneNote(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        return noteNames[noteIndex] + octave;
    },

    getChordMidiNotes(chord, instrument, tuning) {
        const notes = [];
        const baseOctaves = this.getBaseOctaves(instrument);

        if (chord.visiblePositions) {
            chord.visiblePositions.forEach(pos => {
                const [stringIndex, fret] = pos.split('-').map(Number);
                if (stringIndex < tuning.length) {
                    const openNoteName = tuning[stringIndex];
                    const baseOctave = baseOctaves[stringIndex];
                    const openMidi = this.noteToMidi(openNoteName + baseOctave);
                    notes.push(openMidi + fret);
                }
            });
            return notes;
        }

        const intervals = MusicTheory.chords[chord.type];
        if (!intervals) return [];

        let minMidi = 127;
        tuning.forEach((note, index) => {
            const octave = baseOctaves[index];
            const midi = this.noteToMidi(note + octave);
            if (midi < minMidi) minMidi = midi;
        });

        let targetMinMidi = minMidi + 12;
        if (instrument.startsWith('bass')) targetMinMidi = 28;

        let rootMidi = -1;
        for (let oct = 0; oct <= 8; oct++) {
            const testMidi = this.noteToMidi(chord.root + oct);
            if (testMidi >= targetMinMidi) {
                rootMidi = testMidi;
                break;
            }
        }
        if (rootMidi === -1) rootMidi = this.noteToMidi(chord.root + 4);

        intervals.forEach(interval => notes.push(rootMidi + interval));
        return notes;
    },

    getBaseOctaves(instrument) {
        const octaveMap = {
            guitar: [4, 3, 3, 3, 2, 2],
            bass4: [2, 2, 1, 1],
            bass5: [2, 2, 1, 1, 0],
            bass6: [3, 2, 2, 1, 1, 0],
            ukulele: [4, 4, 4, 4],
            mandolin: [5, 5, 4, 4, 4, 4, 3, 3],
            banjo: [4, 3, 3, 3, 4]
        };
        return octaveMap[instrument] || octaveMap.guitar;
    },

    async playChordHarmony(chord, instrument, tuning, duration = 2.0) {
        try {
            await this.init();
            const midiNotes = this.getChordMidiNotes(chord, instrument, tuning);
            const toneNotes = midiNotes.map(midi => this.midiToToneNote(midi));
            const sampler = this.getSampler(instrument);
            if (sampler) sampler.triggerAttackRelease(toneNotes, duration);
        } catch (error) {
            console.error("Error in playChordHarmony:", error);
        }
    },

    async playChordStrum(chord, instrument, tuning, duration = 2.0, direction = 'down') {
        try {
            await this.init();
            let midiNotes = this.getChordMidiNotes(chord, instrument, tuning);
            if (direction === 'up') midiNotes = midiNotes.reverse();
            
            const sampler = this.getSampler(instrument);
            if (!sampler) return;

            const strumDelay = 0.05;
            if (instrument === 'mandolin') {
                const courseDelay = 0.01;
                midiNotes.forEach((midiNote, index) => {
                    const toneNote = this.midiToToneNote(midiNote);
                    const startTime = index * strumDelay;
                    sampler.triggerAttackRelease(toneNote, duration, '+' + startTime);
                    sampler.triggerAttackRelease(toneNote, duration, '+' + (startTime + courseDelay));
                });
            } else {
                midiNotes.forEach((midiNote, index) => {
                    const toneNote = this.midiToToneNote(midiNote);
                    const startTime = '+' + (index * strumDelay);
                    sampler.triggerAttackRelease(toneNote, duration, startTime);
                });
            }
        } catch (error) {
            console.error("Error in playChordStrum:", error);
        }
    },

    async playChordArpeggio(chord, instrument, tuning, duration = 2.0, pattern = 'ascending') {
        try {
            await this.init();
            let midiNotes = this.getChordMidiNotes(chord, instrument, tuning);
            midiNotes = [...new Set(midiNotes)].sort((a, b) => a - b);

            if (pattern === 'descending') midiNotes = midiNotes.reverse();
            else if (pattern === 'alternating') {
                const ascending = [...midiNotes];
                const descending = [...midiNotes].reverse().slice(1, -1);
                midiNotes = [...ascending, ...descending];
            }

            const sampler = this.getSampler(instrument);
            if (!sampler) return;

            const noteDelay = duration / 4;
            if (instrument === 'mandolin') {
                const courseDelay = 0.01;
                midiNotes.forEach((midiNote, index) => {
                    const toneNote = this.midiToToneNote(midiNote);
                    const startTime = index * noteDelay;
                    sampler.triggerAttackRelease(toneNote, noteDelay, '+' + startTime);
                    sampler.triggerAttackRelease(toneNote, noteDelay, '+' + (startTime + courseDelay));
                });
            } else {
                midiNotes.forEach((midiNote, index) => {
                    const toneNote = this.midiToToneNote(midiNote);
                    const startTime = '+' + (index * noteDelay);
                    sampler.triggerAttackRelease(toneNote, noteDelay, startTime);
                });
            }
        } catch (error) {
            console.error("Error in playChordArpeggio:", error);
        }
    },

    async playProgression(chords, instrument, tuning, playbackMode = 'harmony', chordDuration = 2.0) {
        await this.init();
        for (let i = 0; i < chords.length; i++) {
            const chord = chords[i];
            const delay = i * chordDuration;
            setTimeout(() => {
                if (playbackMode === 'harmony') this.playChordHarmony(chord, instrument, tuning, chordDuration * 0.9);
                else if (playbackMode === 'strum') this.playChordStrum(chord, instrument, tuning, chordDuration * 0.9);
                else if (playbackMode === 'arpeggio') this.playChordArpeggio(chord, instrument, tuning, chordDuration);
            }, delay * 1000);
        }
    },

    toggleMute() {
        Tone.Destination.mute = !Tone.Destination.mute;
        return Tone.Destination.mute;
    }
};