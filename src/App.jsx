import React, { useState, useEffect, useMemo, useRef } from 'react';
import { jsPDF } from "jspdf";
import Fretboard from './components/Fretboard';
import { MusicTheory } from './utils/musicTheory';
import { MIDIPlayer } from './utils/midi';
import { Progressions } from './utils/progressions';
import Logo from './components/Logo';
import { getPositionsForChord, getPositionAtFret, INSTRUMENT_MAX_FRETS } from './utils/positions.js';

const TUNINGS = {
    guitar: {
        standard: ['E', 'B', 'G', 'D', 'A', 'E'],
        dropD: ['E', 'B', 'G', 'D', 'A', 'D'],
        dadgad: ['D', 'A', 'G', 'D', 'A', 'D']
    },
    bass4: ['G', 'D', 'A', 'E'],
    bass5: ['G', 'D', 'A', 'E', 'B'],
    bass6: ['C', 'G', 'D', 'A', 'E', 'B'],
    ukulele: ['A', 'E', 'C', 'G'],
    mandolin: ['E', 'E', 'A', 'A', 'D', 'D', 'G', 'G']
};

const DEFAULT_CHORDS = [
    { root: 'C', type: 'major', mode: 'ionian', visiblePositions: null, isFiltering: false },
    { root: 'A', type: 'minor', mode: 'aeolian', visiblePositions: null, isFiltering: false },
    { root: 'F', type: 'major', mode: 'ionian', visiblePositions: null, isFiltering: false },
    { root: 'G', type: 'major', mode: 'mixolydian', visiblePositions: null, isFiltering: false }
];

// JSON serialization helpers for Set objects
const replacer = (key, value) => {
    if (value instanceof Set) {
        return { dataType: 'Set', value: Array.from(value) };
    }
    return value;
};

const reviver = (key, value) => {
    if (typeof value === 'object' && value !== null && value.dataType === 'Set') {
        return new Set(value.value);
    }
    return value;
};

function App() {
    // Load saved settings once on mount
    const savedSettings = useMemo(() => {
        try {
            const saved = localStorage.getItem('fretforge_settings');
            return saved ? JSON.parse(saved, reviver) : {};
        } catch (e) {
            console.error('Failed to load settings', e);
            return {};
        }
    }, []);

    // Global State
    const [mode, setMode] = useState(savedSettings.mode || 'fretboard');
    const [instrument, setInstrument] = useState(savedSettings.instrument || 'guitar');
    const [guitarTuning, setGuitarTuning] = useState(savedSettings.guitarTuning || 'standard');
    const [numFrets, setNumFrets] = useState(() => {
        if (window.innerWidth <= 768) {
            return window.innerWidth > window.innerHeight ? 12 : 5;
        }
        return savedSettings.numFrets || 12;
    });
    const [showScaleNotes, setShowScaleNotes] = useState(savedSettings.showScaleNotes ?? true);
    const [showPassingNotes, setShowPassingNotes] = useState(savedSettings.showPassingNotes ?? true);
    const [theme, setTheme] = useState(savedSettings.theme || 'default');
    const [zoom, setZoom] = useState(savedSettings.zoom || 100);
    const [playbackMode, setPlaybackMode] = useState(savedSettings.playbackMode || 'strum');
    const [isMuted, setIsMuted] = useState(false);
    const [pdfOrientation, setPdfOrientation] = useState('landscape');
    const [activeUtilityPanel, setActiveUtilityPanel] = useState(null); // 'instrument', 'theme', 'zoom', 'print', null
    const [neckPosition, setNeckPosition] = useState(savedSettings.neckPosition ?? null);
    const [viewLayout, setViewLayout] = useState(savedSettings.viewLayout || 'single');

    // Progression State
    const [progKey, setProgKey] = useState(savedSettings.progKey || 'C');
    const [progQuality, setProgQuality] = useState(savedSettings.progQuality || 'major');
    const [selectedProgression, setSelectedProgression] = useState(savedSettings.selectedProgression || '');

    // Chords State
    const [chords, setChords] = useState(() => {
        if (savedSettings.mode === 'progression') {
            return savedSettings.progressionChords || DEFAULT_CHORDS;
        }
        return savedSettings.fretboardChords || DEFAULT_CHORDS;
    });

    // Ref to instrument for use inside resize closure (avoids stale closure)
    const instrumentRef = useRef(instrument);
    useEffect(() => { instrumentRef.current = instrument; }, [instrument]);

    // Persistence Effect
    useEffect(() => {
        const settings = {
            mode, instrument, guitarTuning, numFrets, showScaleNotes, showPassingNotes,
            theme, zoom, playbackMode, progKey, progQuality, selectedProgression, neckPosition, viewLayout,
            // Save current chords to the appropriate bucket, preserve the other from existing storage
            fretboardChords: mode === 'fretboard' ? chords : (savedSettings.fretboardChords || DEFAULT_CHORDS),
            progressionChords: mode === 'progression' ? chords : (savedSettings.progressionChords || DEFAULT_CHORDS)
        };
        
        // We need to read the latest from LS to ensure we don't overwrite the "other" mode's chords with stale data
        // if we haven't switched to it yet.
        const currentLS = localStorage.getItem('fretforge_settings');
        if (currentLS) {
            const parsedLS = JSON.parse(currentLS, reviver);
            if (mode === 'fretboard') {
                settings.progressionChords = parsedLS.progressionChords || settings.progressionChords;
            } else {
                settings.fretboardChords = parsedLS.fretboardChords || settings.fretboardChords;
            }
        }

        localStorage.setItem('fretforge_settings', JSON.stringify(settings, replacer));
    }, [mode, instrument, guitarTuning, numFrets, showScaleNotes, showPassingNotes, theme, zoom, playbackMode, progKey, progQuality, selectedProgression, neckPosition, viewLayout, chords]);

    // Derived State
    const currentTuning = useMemo(() => {
        if (instrument === 'guitar') {
            return TUNINGS.guitar[guitarTuning] || TUNINGS.guitar.standard;
        }
        return TUNINGS[instrument] || TUNINGS.guitar.standard;
    }, [instrument, guitarTuning]);

    // Clear position/filter state when instrument changes; clamp numFrets to new instrument max
    useEffect(() => {
        setChords(prev => prev.map(c => ({ ...c, visiblePositions: null, isFiltering: false })));
        setNumFrets(prev => Math.min(prev, INSTRUMENT_MAX_FRETS[instrument] || 24));
        setNeckPosition(null);
    }, [instrument]);

    // Compute fretStart for two-col mode: start window 1 fret before the lowest fingered fret
    const computeFretStart = (positions) => {
        if (!positions || positions.size === 0) return 0;
        const frets = Array.from(positions).map(k => parseInt(k.split('-')[1])).filter(f => f > 0);
        if (frets.length === 0) return 0;
        return Math.max(0, Math.min(...frets) - 1);
    };

    // Auto-adjust numFrets across all chords when position changes
    useEffect(() => {
        if (neckPosition === null) return;
        let maxNeeded = 0;
        chords.forEach(chord => {
            const p = getPositionAtFret(chord.root, chord.type, instrument, currentTuning, neckPosition);
            if (p) {
                const m = Math.max(...Array.from(p.positions).map(s => parseInt(s.split('-')[1])));
                if (m > maxNeeded) maxNeeded = m;
            }
        });
        setNumFrets(prev => {
            const needed = maxNeeded + 2;
            const cap = INSTRUMENT_MAX_FRETS[instrument] || 24;
            return needed > prev ? Math.min(needed, cap) : prev;
        });
    }, [neckPosition, chords, instrument]);

    // Effects
    useEffect(() => {
        document.body.className = theme !== 'default' ? theme : '';
    }, [theme]);

    // Mobile Optimization Effect
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                // Mobile: fret count based on orientation
                const isLandscape = window.innerWidth > window.innerHeight;
                setNumFrets(isLandscape ? 12 : 5);
            } else {
                // Desktop: compute frets to fill the available width
                // page-content is 96% of viewport; fretboard-container has 40px padding; 60px label column
                const availableWidth = window.innerWidth * 0.96 - 40 - 60;
                const computed = Math.min(INSTRUMENT_MAX_FRETS[instrumentRef.current] || 24, Math.max(12, Math.floor(availableWidth / 80)));
                setNumFrets(computed);
            }
        };

        // Auto-hide toolbar on scroll (Mobile only)
        let lastScrollTop = 0;
        const topBar = document.querySelector('.top-bar');
        
        const handleScroll = () => {
            if (window.innerWidth > 768) return;
            
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            // Hide on scroll down, show on scroll up
            if (scrollTop > lastScrollTop && scrollTop > 50) {
                topBar?.classList.add('hidden');
            } else {
                topBar?.classList.remove('hidden');
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Initial check
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Audio Initialization Effect
    useEffect(() => {
        // 1. Start downloading samples immediately (Preload)
        MIDIPlayer.preload();

        // 2. Global unlock handler to resume AudioContext on first interaction
        const unlockAudio = () => {
            MIDIPlayer.init().then(() => {
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('keydown', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
            });
        };

        document.addEventListener('click', unlockAudio);
        document.addEventListener('keydown', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);

        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    // Effect to close menus on outside click
    // Close utility panel on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeUtilityPanel && !event.target.closest('.utility-bar') && !event.target.closest('.utility-panel')) {
                setActiveUtilityPanel(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeUtilityPanel]);

    // Dynamic Body Padding for Fixed Header
    useEffect(() => {
        const topBar = document.querySelector('.top-bar');
        if (!topBar) return;

        const updatePadding = () => {
            const height = topBar.offsetHeight;
            document.body.style.paddingTop = `${height + 20}px`;
        };

        const observer = new ResizeObserver(updatePadding);
        observer.observe(topBar);
        
        // Initial update
        updatePadding();

        return () => {
            observer.disconnect();
            document.body.style.paddingTop = '';
        };
    }, []);

    // Handlers
    const switchMode = (newMode) => {
        if (mode === newMode) return;

        // Load chords for the new mode from localStorage
        const saved = localStorage.getItem('fretforge_settings');
        const settings = saved ? JSON.parse(saved, reviver) : {};
        
        let nextChords;
        if (newMode === 'fretboard') {
            nextChords = settings.fretboardChords || DEFAULT_CHORDS;
        } else {
            nextChords = settings.progressionChords || DEFAULT_CHORDS;
        }
        
        setChords(nextChords);
        setMode(newMode);
    };

    const handleChordChange = (index, field, value) => {
        const newChords = [...chords];
        newChords[index] = { ...newChords[index], [field]: value };
        
        // Reset filter state if chord parameters change
        if (field === 'root' || field === 'type' || field === 'mode') {
            newChords[index].isFiltering = false;
            newChords[index].visiblePositions = null;

            // Auto-select default mode for type
            if (field === 'type') {
                const options = MusicTheory.modeOptions[value];
                if (options && options.length > 0) {
                    newChords[index].mode = options[0].value;
                }
            }
        }
        setChords(newChords);
    };


    const handleNoteClick = async (chordIndex, string, fret) => {
        const chord = chords[chordIndex];
        
        // Play Note
        const midiNote = MIDIPlayer.getMidiNoteAtPosition(string, fret, instrument, currentTuning);
        if (midiNote) {
            const toneNote = MIDIPlayer.midiToToneNote(midiNote);
            MIDIPlayer.playSingleNote(toneNote, instrument);
        }

        // Handle Filter
        if (chord.isFiltering) {
            const newChords = [...chords];
            const posKey = `${string}-${fret}`;
            const newSet = new Set(chord.visiblePositions || []);
            
            if (newSet.has(posKey)) newSet.delete(posKey);
            else newSet.add(posKey);
            
            newChords[chordIndex].visiblePositions = newSet;
            setChords(newChords);
        }
    };

    const toggleFilter = (index) => {
        const newChords = [...chords];
        const chord = newChords[index];
        
        if (!chord.isFiltering) {
            // Start filtering - init empty set
            chord.isFiltering = true;
            if (!chord.visiblePositions) chord.visiblePositions = new Set();
        } else {
            // Stop filtering
            chord.isFiltering = false;
        }
        setChords(newChords);
    };

    const addChord = () => {
        if (chords.length >= 12) return;
        setChords(prev => [...prev, { root: 'C', type: 'major', mode: 'ionian', visiblePositions: null, isFiltering: false }]);
    };

    const removeChord = (index) => {
        setChords(prev => prev.filter((_, i) => i !== index));
    };

    const loadProgression = (value, key = progKey, quality = progQuality) => {
        if (!value) return;
        const option = Progressions.getProgressions().find(p => p.value === value);
        if (option) {
            const newChords = Progressions.parseProgression(value, key, quality, option.use7ths);
            setChords(newChords.map(c => ({ ...c, visiblePositions: null, isFiltering: false })));
            setSelectedProgression(value);
        }
    };

    // Recalculate progression when key or quality changes
    useEffect(() => {
        if (mode === 'progression' && selectedProgression) {
            loadProgression(selectedProgression, progKey, progQuality);
        }
    }, [progKey, progQuality]);

    const playChord = (chord, mode) => {
        if (mode === 'harmony') MIDIPlayer.playChordHarmony(chord, instrument, currentTuning);
        if (mode === 'strum') MIDIPlayer.playChordStrum(chord, instrument, currentTuning);
        if (mode === 'arpeggio') MIDIPlayer.playChordArpeggio(chord, instrument, currentTuning);
    };

    const resetFretboardSettings = () => {
        if (window.confirm('Reset fretboard view settings to default?')) {
            if (window.innerWidth <= 768) {
                setNumFrets(window.innerWidth > window.innerHeight ? 12 : 5);
            } else {
                const availableWidth = window.innerWidth * 0.96 - 40 - 60;
                setNumFrets(Math.min(INSTRUMENT_MAX_FRETS[instrument] || 24, Math.max(12, Math.floor(availableWidth / 80))));
            }
            setZoom(100);
            setChords(mode === 'progression' ? (savedSettings.progressionChords || DEFAULT_CHORDS) : DEFAULT_CHORDS);
        }
    };

    const toggleMute = () => {
        const muted = MIDIPlayer.toggleMute();
        setIsMuted(muted);
    };

    const drawFretboardOnCanvas = (canvas, chord, chordLabel, nextChordRoot, maxFrets, tuning) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw label
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(chordLabel, 50, 30);

        const fretboardTop = 80;
        const fretboardHeight = height - 160;
        const fretboardWidth = width - 100;
        const numStrings = tuning.length;
        const numFrets = maxFrets;
        const stringSpacing = fretboardHeight / (numStrings - 1);
        const fretSpacing = fretboardWidth / numFrets;

        // Draw strings
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        for (let i = 0; i < numStrings; i++) {
            const y = fretboardTop + i * stringSpacing;
            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(50 + fretboardWidth, y);
            ctx.stroke();
        }

        // Draw frets
        ctx.strokeStyle = '#8B7355';
        for (let i = 0; i <= numFrets; i++) {
            const x = 50 + i * fretSpacing;
            ctx.lineWidth = i === 0 ? 6 : 2;
            ctx.beginPath();
            ctx.moveTo(x, fretboardTop);
            ctx.lineTo(x, fretboardTop + fretboardHeight);
            ctx.stroke();
        }

        // Draw fret numbers
        ctx.fillStyle = '#000000';
        ctx.font = '15px Arial';
        ctx.textAlign = 'center';
        for (let i = 1; i <= numFrets; i++) {
            const x = 50 + i * fretSpacing - fretSpacing / 2;
            ctx.fillText(i.toString(), x, fretboardTop + fretboardHeight + 30);
        }

        const chordNotes = MusicTheory.getChordNotes(chord.root, chord.type);
        const scaleNotes = MusicTheory.getScaleNotes(chord.root, chord.mode);

        for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
            for (let fret = 0; fret <= numFrets; fret++) {
                const openNote = tuning[stringIndex];
                const note = MusicTheory.transposeNote(openNote, fret);
                
                const posKey = `${stringIndex}-${fret}`;
                if (chord.visiblePositions && !chord.visiblePositions.has(posKey)) continue;

                const isChordTone = chordNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const isScaleNote = scaleNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const isRoot = MusicTheory.areNotesEqual(note, chord.root);
                const passingNote = nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                const isPassingNote = passingNote && MusicTheory.areNotesEqual(note, passingNote);

                // Only draw if it's a valid note type and visibility settings allow it
                if (isChordTone || (showScaleNotes && isScaleNote) || isPassingNote) {
                    const x = 50 + (fret === 0 ? 0 : fret * fretSpacing - fretSpacing / 2);
                    const y = fretboardTop + stringIndex * stringSpacing;
                    const size = 14;

                    let fillColor, strokeColor, lineWidth, shape, textColor;

                    if (isRoot) {
                        fillColor = '#000000'; strokeColor = '#FFFFFF'; textColor = '#FFFFFF'; lineWidth = 3; shape = 'square';
                    } else if (isPassingNote) {
                        fillColor = '#999999'; strokeColor = '#999999'; textColor = '#000000'; lineWidth = 0; shape = 'triangle';
                    } else if (isChordTone) {
                        fillColor = '#CCCCCC'; strokeColor = '#CCCCCC'; textColor = '#000000'; lineWidth = 2; shape = 'square';
                    } else {
                        fillColor = '#FFFFFF'; strokeColor = '#000000'; textColor = '#000000'; lineWidth = 2; shape = 'circle';
                    }

                    ctx.beginPath();
                    if (shape === 'square') ctx.rect(x - size, y - size, size * 2, size * 2);
                    else if (shape === 'circle') ctx.arc(x, y, size, 0, 2 * Math.PI);
                    else if (shape === 'triangle') {
                        const shift = size * 0.3;
                        ctx.moveTo(x - size + shift, y - size);
                        ctx.lineTo(x - size + shift, y + size);
                        ctx.lineTo(x + size * 1.2, y);
                        ctx.closePath();
                    }

                    ctx.fillStyle = fillColor; ctx.fill();
                    ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.stroke();

                    ctx.fillStyle = textColor;
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let label;
                    if (isRoot) label = 'R';
                    else if (isLeadingNote) label = 'L';
                    else if (isChordTone) label = MusicTheory.getChordIntervalLabel(chord.root, note, chord.type);
                    else label = MusicTheory.getScaleDegreeLabel(chord.root, note, chord.mode);
                    
                    ctx.fillText(label, x, y);
                }
            }
        }
    };

    const exportToPDF = () => {
        const orientation = pdfOrientation === 'landscape' ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'mm', 'a4');
        
        let printFrets = numFrets;
        
        // Portrait constraints: Max 12 frets
        if (orientation === 'p') {
            if (numFrets > 12) {
                alert("Only 12 frets will be printed in portrait mode.");
                printFrets = 12;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 450;

        // Layout Configuration
        let itemsPerPage;
        let getPosition;
        
        const pageWidth = orientation === 'l' ? 297 : 210;
        const pageHeight = orientation === 'l' ? 210 : 297;
        const margin = 10;
        const gap = 10;

        if (orientation === 'p') {
            // Portrait: 3 per page max
            itemsPerPage = 3;
            const w = pageWidth - (margin * 2);
            const h = w * (canvas.height / canvas.width);
            
            getPosition = (idx) => ({
                x: margin,
                y: margin + idx * (h + gap),
                w: w,
                h: h
            });
        } else {
            // Landscape
            if (printFrets <= 6) {
                // 4 per page (2x2 grid) for 5 frets
                itemsPerPage = 4;
                const w = (pageWidth - (margin * 2) - gap) / 2;
                const h = w * (canvas.height / canvas.width);
                
                getPosition = (idx) => ({
                    x: margin + (idx % 2) * (w + gap),
                    y: margin + Math.floor(idx / 2) * (h + gap),
                    w: w,
                    h: h
                });
            } else {
                // 2 per page (Vertical stack) for 12+ frets
                itemsPerPage = 2;
                // Calculate dimensions to fit 2 vertically
                const maxH = (pageHeight - (margin * 2) - gap) / 2;
                let w = pageWidth - (margin * 2);
                let h = w * (canvas.height / canvas.width);
                
                // If height exceeds available space, scale down
                if (h > maxH) {
                    h = maxH;
                    w = h * (canvas.width / canvas.height);
                }
                
                getPosition = (idx) => ({
                    x: (pageWidth - w) / 2, // Center horizontally
                    y: margin + idx * (h + gap),
                    w: w,
                    h: h
                });
            }
        }

        chords.forEach((chord, i) => {
            const pageIndex = Math.floor(i / itemsPerPage);
            const indexOnPage = i % itemsPerPage;
            
            if (indexOnPage === 0 && pageIndex > 0) {
                pdf.addPage();
            }
            
            const nextRoot = (mode === 'progression' && showPassingNotes && i < chords.length - 1) ? chords[i+1].root : (mode === 'progression' && showPassingNotes ? chords[0].root : null);
            const label = `${chord.root} ${chord.type} (${chord.mode})`;
            const effectivePositions = chord.isFiltering
                ? chord.visiblePositions
                : (neckPosition !== null
                    ? getPositionAtFret(chord.root, chord.type, instrument, currentTuning, neckPosition)?.positions || null
                    : null);
            const chordForPdf = { ...chord, visiblePositions: effectivePositions };

            drawFretboardOnCanvas(canvas, chordForPdf, label, nextRoot, printFrets, currentTuning);
            
            const pos = getPosition(indexOnPage);
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', pos.x, pos.y, pos.w, pos.h);
        });
        pdf.save('fretforge-export.pdf');
        setShowPdfOptions(false);
    };

    return (
        <div className="app-container">
            {/* Top Bar */}
            <div className="top-bar">
                <div className="top-bar-content">
                    {/* Header Row */}
                    <div className="top-bar-row">
                        <div className="app-header">
                            <Logo className="app-logo" />
                            <span className="app-title">FretForge</span>
                        </div>

                        <div className="mode-toggle">
                            <button
                                className={`mode-btn ${mode === 'fretboard' ? 'active' : ''}`}
                                onClick={() => switchMode('fretboard')}
                            >Chord Select</button>
                            <button
                                className={`mode-btn ${mode === 'progression' ? 'active' : ''}`}
                                onClick={() => switchMode('progression')}
                            >Progression</button>
                        </div>
                    </div>

                    {/* Utility Bar */}
                    <div className="utility-bar">
                        {/* Instrument */}
                        <button
                            className={`utility-btn ${activeUtilityPanel === 'instrument' ? 'active' : ''}`}
                            onClick={() => setActiveUtilityPanel(activeUtilityPanel === 'instrument' ? null : 'instrument')}
                            title="Select instrument and tuning"
                        >
                            <span className="icon-mask icon-instrument"></span>
                            <span className="utility-label">Instrument</span>
                        </button>

                        {/* Theme */}
                        <button
                            className={`utility-btn ${activeUtilityPanel === 'theme' ? 'active' : ''}`}
                            onClick={() => setActiveUtilityPanel(activeUtilityPanel === 'theme' ? null : 'theme')}
                            title="Change color theme"
                        >
                            <span className="icon-mask icon-palette"></span>
                            <span className="utility-label">Theme</span>
                        </button>

                        {/* Zoom */}
                        <button
                            className={`utility-btn ${activeUtilityPanel === 'zoom' ? 'active' : ''}`}
                            onClick={() => setActiveUtilityPanel(activeUtilityPanel === 'zoom' ? null : 'zoom')}
                            title="Adjust fretboard size"
                        >
                            <span className="icon-mask icon-zoom"></span>
                            <span className="utility-label">Zoom</span>
                        </button>

                        {/* Print/PDF */}
                        <button
                            className={`utility-btn ${activeUtilityPanel === 'print' ? 'active' : ''}`}
                            onClick={() => setActiveUtilityPanel(activeUtilityPanel === 'print' ? null : 'print')}
                            title="Export to PDF"
                        >
                            <span className="icon-mask icon-pdf"></span>
                            <span className="utility-label">Print</span>
                        </button>

                        {/* Mute Toggle */}
                        <button
                            className={`utility-btn ${isMuted ? 'utility-toggle off' : ''}`}
                            onClick={toggleMute}
                            title={isMuted ? "Sound is muted" : "Sound is on"}
                        >
                            <span className={`icon-mask ${isMuted ? 'icon-mute' : 'icon-volume'}`}></span>
                            <span className="utility-label">{isMuted ? 'Muted' : 'Sound'}</span>
                        </button>

                        {/* Scale Notes Toggle */}
                        <button
                            className={`utility-btn utility-toggle ${!showScaleNotes ? 'off' : ''}`}
                            onClick={() => setShowScaleNotes(s => !s)}
                            title={showScaleNotes ? "Scale notes visible" : "Scale notes hidden"}
                        >
                            <span className="icon-mask icon-scale"></span>
                            <span className="utility-label">Scale</span>
                        </button>

                        {/* Passing Notes Toggle - Progression mode only */}
                        {mode === 'progression' && (
                            <button
                                className={`utility-btn utility-toggle ${!showPassingNotes ? 'off' : ''}`}
                                onClick={() => setShowPassingNotes(s => !s)}
                                title={showPassingNotes ? "Passing notes visible" : "Passing notes hidden"}
                            >
                                <span className="icon-mask icon-passing"></span>
                                <span className="utility-label">Passing</span>
                            </button>
                        )}

                        {/* Key/Legend */}
                        <button
                            className={`utility-btn ${activeUtilityPanel === 'key' ? 'active' : ''}`}
                            onClick={() => setActiveUtilityPanel(activeUtilityPanel === 'key' ? null : 'key')}
                            title="Note type legend"
                        >
                            <span className="icon-mask icon-key"></span>
                            <span className="utility-label">Key</span>
                        </button>

                        {/* Reset */}
                        <button
                            className="utility-btn"
                            onClick={resetFretboardSettings}
                            title="Reset view to defaults"
                        >
                            <span className="icon-mask icon-reset"></span>
                            <span className="utility-label">Reset</span>
                        </button>

                        {/* Help */}
                        <button
                            className="utility-btn"
                            onClick={() => window.open('https://canvasback.us/fretforge/howto', '_blank')}
                            title="How to use FretForge"
                        >
                            <span className="icon-mask icon-help"></span>
                            <span className="utility-label">Help</span>
                        </button>

                        {/* Layout Toggle */}
                        <button
                            className={`utility-btn utility-toggle ${viewLayout === 'two-col' ? 'active' : ''}`}
                            onClick={() => setViewLayout(l => l === 'single' ? 'two-col' : 'single')}
                            title={viewLayout === 'single' ? 'Switch to 2-column layout (5 frets)' : 'Switch to single-column layout'}
                        >
                            <span className={`icon-mask ${viewLayout === 'two-col' ? 'icon-layout-2col' : 'icon-layout-1col'}`}></span>
                            <span className="utility-label">{viewLayout === 'two-col' ? '2-col' : '1-col'}</span>
                        </button>

                        {/* Fretboard toggle + position slider — guitar and ukulele only */}
                        {(instrument === 'guitar' || instrument === 'ukulele') && (
                            <>
                                {/* Text toggle: full neck vs position mode (single-col only) */}
                                {viewLayout !== 'two-col' && (
                                    <button
                                        className={`neck-mode-toggle ${neckPosition !== null ? 'active' : ''}`}
                                        onClick={() => setNeckPosition(neckPosition !== null ? null : 0)}
                                        title={neckPosition !== null ? 'Back to full fretboard' : 'Switch to chord position mode'}
                                    >
                                        {neckPosition !== null ? 'POSITION' : 'FULL NECK'}
                                    </button>
                                )}
                                {/* Position slider: visible in position mode (single-col) or always (two-col) */}
                                {(neckPosition !== null || viewLayout === 'two-col') && (
                                    <input
                                        type="range"
                                        className={`position-slider${neckPosition === null ? ' inactive' : ''}`}
                                        min={0}
                                        max={INSTRUMENT_MAX_FRETS[instrument]}
                                        value={neckPosition ?? 0}
                                        onChange={e => setNeckPosition(parseInt(e.target.value))}
                                        onMouseDown={() => { if (neckPosition === null) setNeckPosition(0); }}
                                        onTouchStart={() => { if (neckPosition === null) setNeckPosition(0); }}
                                    />
                                )}
                            </>
                        )}
                    </div>

                    {/* Expandable Utility Panels */}
                    {activeUtilityPanel && (
                        <div className="utility-panel">
                            {/* Instrument Panel */}
                            {activeUtilityPanel === 'instrument' && (
                                <div className="utility-panel-content">
                                    <div className="panel-row">
                                        <label>Instrument</label>
                                        <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
                                            <option value="guitar">Guitar</option>
                                            <option value="bass4">Bass (4-string)</option>
                                            <option value="bass5">Bass (5-string)</option>
                                            <option value="bass6">Bass (6-string)</option>
                                            <option value="ukulele">Ukulele</option>
                                            <option value="mandolin">Mandolin</option>
                                        </select>
                                    </div>
                                    {instrument === 'guitar' && (
                                        <div className="panel-row">
                                            <label>Tuning</label>
                                            <select value={guitarTuning} onChange={(e) => setGuitarTuning(e.target.value)}>
                                                <option value="standard">Standard (EADGBE)</option>
                                                <option value="dropD">Drop D</option>
                                                <option value="dadgad">DADGAD</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Theme Panel */}
                            {activeUtilityPanel === 'theme' && (
                                <div className="utility-panel-content theme-panel">
                                    <div className="theme-grid">
                                        {[
                                            { value: 'default', name: 'Dark Wood', bg: '#3a2a1a', text: '#d4c4a8' },
                                            { value: 'theme-light-wood', name: 'Light Wood', bg: '#c4a77d', text: '#2c1810' },
                                            { value: 'theme-light', name: 'Light', bg: '#f5f5f5', text: '#333333' },
                                            { value: 'theme-high-contrast', name: 'High Contrast', bg: '#000000', text: '#ffff00' },
                                            { value: 'theme-midnight', name: 'Midnight', bg: '#1a1a2e', text: '#a0a0cc' },
                                            { value: 'theme-paper', name: 'Paper', bg: '#f8f4e8', text: '#4a4a4a' },
                                            { value: 'theme-terminal', name: 'Terminal', bg: '#0a0a0a', text: '#00ff00' },
                                            { value: 'theme-oceanic', name: 'Oceanic', bg: '#1a3a4a', text: '#7ec8e3' },
                                            { value: 'theme-sunset', name: 'Sunset', bg: '#2d1b4e', text: '#ff9966' },
                                            { value: 'theme-slate', name: 'Slate', bg: '#2d3748', text: '#a0aec0' },
                                            { value: 'theme-navy', name: 'Navy', bg: '#0a1628', text: '#64b5f6' },
                                            { value: 'theme-berry', name: 'Berry', bg: '#2d1a2d', text: '#e879a9' },
                                            { value: 'theme-forest', name: 'Forest', bg: '#0d2e0d', text: '#4caf50' },
                                            { value: 'theme-vaporwave', name: 'Vaporwave', bg: '#09090b', text: '#f472b6' },
                                            { value: 'theme-ruby', name: 'Ruby', bg: '#5c1515', text: '#ff4444' },
                                            { value: 'theme-magenta', name: 'Magenta', bg: '#6b2477', text: '#ff44ff' },
                                            { value: 'theme-ivory', name: 'Ivory', bg: '#f5f1e8', text: '#5d4e37' },
                                            { value: 'theme-turquoise', name: 'Turquoise', bg: '#1a5c66', text: '#4dd0e1' },
                                            { value: 'theme-sunburst', name: 'Sunburst', bg: '#4a2a0a', text: '#ffa500' },
                                            { value: 'theme-eclipse', name: 'Eclipse', bg: '#1a1a2a', text: '#9090c0' },
                                            { value: 'theme-sapphire', name: 'Sapphire', bg: '#162a4a', text: '#4a9eff' },
                                        ].map(t => (
                                            <button
                                                key={t.value}
                                                className={`theme-btn ${theme === t.value ? 'active' : ''}`}
                                                onClick={() => setTheme(t.value)}
                                                style={{ backgroundColor: t.bg, color: t.text, borderColor: t.text }}
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Zoom Panel */}
                            {activeUtilityPanel === 'zoom' && (
                                <div className="utility-panel-content zoom-panel">
                                    <div className="panel-row">
                                        <input
                                            type="range"
                                            min="50"
                                            max="150"
                                            value={zoom}
                                            onChange={(e) => setZoom(e.target.value)}
                                            className="zoom-slider"
                                        />
                                        <span className="zoom-value">{zoom}%</span>
                                    </div>
                                    <div className="zoom-presets">
                                        <button onClick={() => setZoom(50)}>50%</button>
                                        <button onClick={() => setZoom(75)}>75%</button>
                                        <button onClick={() => setZoom(100)}>100%</button>
                                        <button onClick={() => setZoom(125)}>125%</button>
                                        <button onClick={() => setZoom(150)}>150%</button>
                                    </div>
                                </div>
                            )}

                            {/* Print Panel */}
                            {activeUtilityPanel === 'print' && (
                                <div className="utility-panel-content print-panel">
                                    <div className="panel-row">
                                        <label>Orientation</label>
                                        <div className="orientation-btns">
                                            <button
                                                className={pdfOrientation === 'landscape' ? 'active' : ''}
                                                onClick={() => setPdfOrientation('landscape')}
                                            >
                                                Landscape
                                            </button>
                                            <button
                                                className={pdfOrientation === 'portrait' ? 'active' : ''}
                                                onClick={() => setPdfOrientation('portrait')}
                                            >
                                                Portrait
                                            </button>
                                        </div>
                                        <button className="export-btn" onClick={() => { exportToPDF(); setActiveUtilityPanel(null); }}>
                                            <span className="icon-mask icon-download"></span>
                                            Export PDF
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Key/Legend Panel */}
                            {activeUtilityPanel === 'key' && (
                                <div className="utility-panel-content key-panel">
                                    <div className="key-legend">
                                        <div className="key-item">
                                            <span className="key-indicator root">A</span>
                                            <span className="key-label">Root Note</span>
                                        </div>
                                        <div className="key-item">
                                            <span className="key-indicator chord-tone">C♯</span>
                                            <span className="key-label">Chord Tone</span>
                                        </div>
                                        <div className="key-item">
                                            <span className="key-indicator scale-note">B♭</span>
                                            <span className="key-label">Scale Note</span>
                                        </div>
                                        <div className="key-item">
                                            <span className="key-indicator passing-note">➜</span>
                                            <span className="key-label">Passing Note</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Progression Controls - Only in progression mode */}
                    {mode === 'progression' && (
                        <div className="progression-controls">
                            <div className="prog-selects">
                                <select value={progKey} onChange={(e) => setProgKey(e.target.value)}>
                                    {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => (
                                        <option key={k} value={k}>{k}</option>
                                    ))}
                                </select>
                                <select value={progQuality} onChange={(e) => { setProgQuality(e.target.value); setSelectedProgression(''); }}>
                                    <option value="major">Major</option>
                                    <option value="minor">Minor</option>
                                </select>
                                <select
                                    className="progression-select"
                                    value={selectedProgression}
                                    onChange={(e) => loadProgression(e.target.value)}
                                >
                                    <option value="">Select Progression...</option>
                                    {Progressions.getProgressions(progQuality).map(p => (
                                        <option key={p.value} value={p.value}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button className="playback-button" onClick={() => MIDIPlayer.playProgression(chords, instrument, currentTuning, 'strum')}>
                                Play All
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div 
                className="page-content active" 
                style={{ 
                    transform: `scale(${zoom / 100})`, 
                    transformOrigin: 'top center',
                    marginTop: '20px'
                }}
            >
                <div id="fretboard-container" className={viewLayout === 'two-col' ? 'two-col' : ''}>
                    {chords.map((chord, index) => (
                        <div key={index} className="chord-section">
                            <div className="chord-controls">
                                <div className="chord-label">
                                    {chord.root} {chord.type}
                                    {chord.numeral && ` (${chord.numeral})`}
                                </div>
                                
                                {mode === 'fretboard' && (
                                    <>
                                        {(() => {
                                            const rootLetter = chord.root.substring(0, 1);
                                            const rootAccidental = chord.root.length > 1 ? chord.root.substring(1) : '';
                                            return (
                                                <div className="input-group">
                                                    <select 
                                                        value={rootLetter} 
                                                        onChange={(e) => {
                                                            handleChordChange(index, 'root', e.target.value + rootAccidental);
                                                        }}
                                                    >
                                                        {['C','D','E','F','G','A','B'].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                    <select 
                                                        className="compact"
                                                        value={rootAccidental}
                                                        onChange={(e) => {
                                                            handleChordChange(index, 'root', rootLetter + e.target.value);
                                                        }}
                                                    >
                                                        <option value="">♮</option>
                                                        <option value="#">♯</option>
                                                        <option value="b">♭</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}

                                        <div className="input-group">
                                            <select 
                                                value={chord.type} 
                                                onChange={(e) => handleChordChange(index, 'type', e.target.value)}
                                            >
                                                {Object.keys(MusicTheory.chords).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="input-group">
                                            <select 
                                                value={chord.mode} 
                                                onChange={(e) => handleChordChange(index, 'mode', e.target.value)}
                                            >
                                                {MusicTheory.modeOptions[chord.type]?.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}


                                {/* Remove chord button — fretboard mode, more than 1 chord */}
                                {mode === 'fretboard' && chords.length > 1 && (
                                    <button
                                        className="chord-remove-btn"
                                        onClick={() => removeChord(index)}
                                        title="Remove this chord"
                                    >×</button>
                                )}

                                <div className="chord-tools">
                                    <div className="filter-controls">
                                        {!chord.isFiltering ? (
                                            <button className="filter-btn" onClick={() => toggleFilter(index)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M3 4c2.01 2.59 7 9 7 9v7h4v-7s4.98-6.41 7-9H3z"/>
                                                </svg>
                                                Filter
                                            </button>
                                        ) : (
                                            <>
                                                <button className="filter-btn active" onClick={() => toggleFilter(index)}>
                                                    <span>✓</span> Done
                                                </button>
                                                <button className="filter-btn secondary" onClick={() => handleChordChange(index, 'visiblePositions', new Set())}>Clear</button>
                                            </>
                                        )}
                                    </div>
                                    <div className="playback-controls-compact">
                                        <div className="playback-toggle-group">
                                            <button 
                                                className={`toggle-btn ${playbackMode === 'harmony' ? 'active' : ''}`}
                                                onClick={() => setPlaybackMode('harmony')}
                                                title="Harmony"
                                            >unis</button>
                                            <button 
                                                className={`toggle-btn ${playbackMode === 'strum' ? 'active' : ''}`}
                                                onClick={() => setPlaybackMode('strum')}
                                                title="Strum"
                                            >strum</button>
                                            <button 
                                                className={`toggle-btn ${playbackMode === 'arpeggio' ? 'active' : ''}`}
                                                onClick={() => setPlaybackMode('arpeggio')}
                                                title="Arpeggio"
                                            >arp</button>
                                        </div>
                                        <button className="compact-play-btn" onClick={() => playChord(chord, playbackMode)}>▶</button>
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const effectivePositions = chord.isFiltering
                                    ? chord.visiblePositions
                                    : (neckPosition !== null
                                        ? getPositionAtFret(chord.root, chord.type, instrument, currentTuning, neckPosition)?.positions || null
                                        : null);
                                const fretStart = viewLayout === 'two-col' && neckPosition > 0 ? computeFretStart(effectivePositions) : 0;
                                return (
                                    <Fretboard
                                        tuning={currentTuning}
                                        numFrets={viewLayout === 'two-col' ? 5 : numFrets}
                                        fretStart={fretStart}
                                        root={chord.root}
                                        chordType={chord.type}
                                        mode={chord.mode}
                                        nextChordRoot={mode === 'progression' ? (index < chords.length - 1 ? chords[index+1].root : chords[0].root) : null}
                                        showScaleNotes={showScaleNotes}
                                        showPassingNotes={showPassingNotes}
                                        visiblePositions={effectivePositions}
                                        isFilterMode={chord.isFiltering}
                                        onNoteClick={(s, f) => handleNoteClick(index, s, f)}
                                        instrument={instrument}
                                    />
                                );
                            })()}
                        </div>
                    ))}

                    {/* Add Chord button — fretboard mode only */}
                    {mode === 'fretboard' && chords.length < 12 && (
                        <button className="add-chord-btn" onClick={addChord}>
                            + Add Chord
                        </button>
                    )}
                </div>
            </div>
            <footer className="app-footer">
                &copy; 2026 <a href="https://canvasback.us" target="_blank" rel="noopener noreferrer">Canvasback Solutions</a>
            </footer>
        </div>
    );
}

export default App;