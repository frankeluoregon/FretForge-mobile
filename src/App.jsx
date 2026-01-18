import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from "jspdf";
import Fretboard from './components/Fretboard';
import { MusicTheory } from './utils/musicTheory';
import { MIDIPlayer } from './utils/midi';
import { Progressions } from './utils/progressions';
import Logo from './components/Logo';

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
    const [showLeadingNotes, setShowLeadingNotes] = useState(savedSettings.showLeadingNotes ?? true);
    const [theme, setTheme] = useState(savedSettings.theme || 'default');
    const [zoom, setZoom] = useState(savedSettings.zoom || 100);
    const [playbackMode, setPlaybackMode] = useState(savedSettings.playbackMode || 'strum');
    const [isMuted, setIsMuted] = useState(false);
    const [pdfOrientation, setPdfOrientation] = useState('landscape');
    const [showPdfOptions, setShowPdfOptions] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);

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

    // Persistence Effect
    useEffect(() => {
        const settings = {
            mode, instrument, guitarTuning, numFrets, showScaleNotes, showLeadingNotes,
            theme, zoom, playbackMode, progKey, progQuality, selectedProgression,
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
    }, [mode, instrument, guitarTuning, numFrets, showScaleNotes, showLeadingNotes, theme, zoom, playbackMode, progKey, progQuality, selectedProgression, chords]);

    // Derived State
    const currentTuning = useMemo(() => {
        if (instrument === 'guitar') {
            return TUNINGS.guitar[guitarTuning] || TUNINGS.guitar.standard;
        }
        return TUNINGS[instrument] || TUNINGS.guitar.standard;
    }, [instrument, guitarTuning]);

    // Effects
    useEffect(() => {
        document.body.className = theme !== 'default' ? theme : '';
    }, [theme]);

    // Mobile Optimization Effect
    useEffect(() => {
        const handleResize = () => {
            // Only apply on mobile devices
            if (window.innerWidth <= 768) {
                // Update fret count based on orientation
                // Portrait: 5 frets, Landscape: 12 frets
                const isLandscape = window.innerWidth > window.innerHeight;
                setNumFrets(isLandscape ? 12 : 5);
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

    // Effect to close popups on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showZoomPopup && !event.target.closest('.zoom-wrapper')) {
                setShowZoomPopup(false);
            }
            if (showInstrumentPopup && !event.target.closest('.instrument-wrapper')) {
                setShowInstrumentPopup(false);
            }
            if (showThemePopup && !event.target.closest('.theme-wrapper')) {
                setShowThemePopup(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showZoomPopup, showInstrumentPopup, showThemePopup]);

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
        
        // Reset filter if parameters change
        if (field === 'root' || field === 'type' || field === 'mode') {
            newChords[index].visiblePositions = null;
            newChords[index].isFiltering = false;
            
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

    const loadProgression = (value) => {
        if (!value) return;
        const option = Progressions.getProgressions().find(p => p.value === value);
        if (option) {
            const newChords = Progressions.parseProgression(value, progKey, progQuality, option.use7ths);
            setChords(newChords.map(c => ({ ...c, visiblePositions: null, isFiltering: false })));
            setSelectedProgression(value);
        }
    };

    const playChord = (chord, mode) => {
        if (mode === 'harmony') MIDIPlayer.playChordHarmony(chord, instrument, currentTuning);
        if (mode === 'strum') MIDIPlayer.playChordStrum(chord, instrument, currentTuning);
        if (mode === 'arpeggio') MIDIPlayer.playChordArpeggio(chord, instrument, currentTuning);
    };

    const resetFretboardSettings = () => {
        if (window.confirm('Reset fretboard view settings to default?')) {
            setNumFrets(window.innerWidth > window.innerHeight ? 12 : 5);
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
                const leadingNote = nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                const isLeadingNote = leadingNote && MusicTheory.areNotesEqual(note, leadingNote);

                // Only draw if it's a valid note type and visibility settings allow it
                if (isChordTone || (showScaleNotes && isScaleNote) || isLeadingNote) {
                    const x = 50 + (fret === 0 ? 0 : fret * fretSpacing - fretSpacing / 2);
                    const y = fretboardTop + stringIndex * stringSpacing;
                    const size = 14;

                    let fillColor, strokeColor, lineWidth, shape, textColor;

                    if (isRoot) {
                        fillColor = '#000000'; strokeColor = '#FFFFFF'; textColor = '#FFFFFF'; lineWidth = 3; shape = 'square';
                    } else if (isLeadingNote) {
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
            
            const nextRoot = (mode === 'progression' && showLeadingNotes && i < chords.length - 1) ? chords[i+1].root : (mode === 'progression' && showLeadingNotes ? chords[0].root : null);
            const label = `${chord.root} ${chord.type} (${chord.mode})`;
            
            drawFretboardOnCanvas(canvas, chord, label, nextRoot, printFrets, currentTuning);
            
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
                    <div className="top-bar-row">
                        <div className="app-header">
                            <Logo className="app-logo" />
                            <span className="app-title">FretForge</span>
                        </div>
                        
                        <div className={`primary-controls ${mode === 'fretboard' ? 'centered-mode' : ''}`}>
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

                            <div className="toggles-wrapper">
                                <button
                                    className={`filter-toggle-btn ${showScaleNotes ? 'active' : ''}`}
                                    onClick={() => setShowScaleNotes(s => !s)}
                                    title="Toggle Scale Notes"
                                >
                                    Scale Notes
                                </button>

                                {mode === 'progression' && (
                                    <button
                                        className={`filter-toggle-btn ${showLeadingNotes ? 'active' : ''}`}
                                        onClick={() => setShowLeadingNotes(s => !s)}
                                        title="Toggle Leading Notes"
                                    >
                                        Leading Notes
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="top-row-controls">
                            {/* Mute Button */}
                            <div className="input-group">
                                <button className="toolbar-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                                    {isMuted ? (
                                        <svg className="control-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <line x1="23" y1="9" x2="17" y2="15"></line>
                                            <line x1="17" y1="9" x2="23" y2="15"></line>
                                        </svg>
                                    ) : (
                                        <svg className="control-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                    )}
                                </button>
                            </div>

                            {/* PDF Export Button */}
                            <div className="input-group">
                                {!showPdfOptions ? (
                                    <button className="toolbar-btn" onClick={() => setShowPdfOptions(true)} title="Export PDF">
                                        <svg className="control-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                    </button>
                                ) : (
                                    <div className="toolbar-group">
                                        <select
                                            className="pdf-select"
                                            value={pdfOrientation}
                                            onChange={(e) => setPdfOrientation(e.target.value)}
                                        >
                                            <option value="landscape">Land</option>
                                            <option value="portrait">Port</option>
                                        </select>
                                        <button className="toolbar-btn" onClick={exportToPDF} title="Download">
                                            <span style={{ fontSize: '18px' }}>⬇</span>
                                        </button>
                                        <button className="toolbar-btn" onClick={() => setShowPdfOptions(false)} title="Cancel">
                                            <span style={{ fontSize: '18px' }}>✕</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Settings Menu Button */}
                            <div className="input-group settings-menu-wrapper">
                                <button className="toolbar-btn" onClick={() => setShowSettingsMenu(s => !s)} title="Settings">
                                    <svg className="control-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3"></circle>
                                        <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24M19.78 19.78l-4.24-4.24m-5.08-5.08l-4.24-4.24"></path>
                                    </svg>
                                </button>
                                {showSettingsMenu && (
                                    <div className="settings-menu">
                                        <div className="settings-menu-section">
                                            <div className="settings-menu-item">
                                                <img src="/instrument.svg" alt="Instrument" className="settings-icon" />
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
                                                <div className="settings-menu-item">
                                                    <select value={guitarTuning} onChange={(e) => setGuitarTuning(e.target.value)}>
                                                        <option value="standard">Standard</option>
                                                        <option value="dropD">Drop D</option>
                                                        <option value="dadgad">DADGAD</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="settings-menu-section">
                                            <div className="settings-menu-item">
                                                <svg className="settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <path d="m21 21-4.35-4.35"></path>
                                                </svg>
                                                <div className="zoom-control">
                                                    <input type="range" min="50" max="150" value={zoom} onChange={(e) => setZoom(e.target.value)} className="zoom-slider" />
                                                    <span className="zoom-value">{zoom}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="settings-menu-section">
                                            <div className="settings-menu-item">
                                                <svg className="settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                                                </svg>
                                                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                                                    <option value="default">Dark Wood</option>
                                                    <option value="theme-light-wood">Light Wood</option>
                                                    <option value="theme-light">Light</option>
                                                    <option value="theme-high-contrast">High Contrast</option>
                                                    <option value="theme-midnight">Midnight</option>
                                                    <option value="theme-paper">Paper</option>
                                                    <option value="theme-terminal">Terminal</option>
                                                    <option value="theme-oceanic">Oceanic</option>
                                                    <option value="theme-sunset">Sunset</option>
                                                    <option value="theme-slate">Slate</option>
                                                    <option value="theme-navy">Navy</option>
                                                    <option value="theme-berry">Berry</option>
                                                    <option value="theme-forest">Forest</option>
                                                    <option value="theme-vaporwave">Vaporwave</option>
                                                    <option value="theme-ruby">Ruby</option>
                                                    <option value="theme-magenta">Magenta</option>
                                                    <option value="theme-ivory">Ivory</option>
                                                    <option value="theme-turquoise">Turquoise</option>
                                                    <option value="theme-sunburst">Sunburst</option>
                                                    <option value="theme-eclipse">Eclipse</option>
                                                    <option value="theme-sapphire">Sapphire</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="settings-menu-section">
                                            <button className="settings-menu-item reset-btn" onClick={resetFretboardSettings}>
                                                <svg className="settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="23 4 23 10 17 10"></polyline>
                                                    <path d="M20.49 15a9 9 0 1 1-2-8.94"></path>
                                                </svg>
                                                <span>Reset View</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controls bar - Scale Notes always visible, Leading Notes only in progression mode */}
                    <div className="controls-bar">
                        {mode === 'progression' && (
                            <div className="progression-controls-left">
                                <div className="input-group">
                                    <select value={progKey} onChange={(e) => setProgKey(e.target.value)}>
                                        {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(k => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                    <select value={progQuality} onChange={(e) => setProgQuality(e.target.value)}>
                                        <option value="major">Major</option>
                                        <option value="minor">Minor</option>
                                    </select>
                                </div>
                                <select
                                    className="progression-select"
                                    value={selectedProgression}
                                    onChange={(e) => loadProgression(e.target.value)}
                                >
                                    <option value="">Select Progression...</option>
                                    {Progressions.getProgressions().map(p => (
                                        <option key={p.value} value={p.value}>{p.name}</option>
                                    ))}
                                </select>
                                <button className="playback-button" onClick={() => MIDIPlayer.playProgression(chords, instrument, currentTuning, 'strum')}>
                                    Play All
                                </button>
                            </div>
                        )}
                        <div className="filter-toggles-bar">
                            <button
                                className={`filter-toggle-btn ${showScaleNotes ? 'active' : ''}`}
                                onClick={() => setShowScaleNotes(s => !s)}
                                title="Toggle Scale Notes"
                            >
                                Scale Notes
                            </button>
                            {mode === 'progression' && (
                                <button
                                    className={`filter-toggle-btn ${showLeadingNotes ? 'active' : ''}`}
                                    onClick={() => setShowLeadingNotes(s => !s)}
                                    title="Toggle Leading Notes"
                                >
                                    Leading Notes
                                </button>
                            )}
                        </div>
                    </div>
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
                <div id="fretboard-container">
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

                            <Fretboard 
                                tuning={currentTuning}
                                numFrets={numFrets}
                                root={chord.root}
                                chordType={chord.type}
                                mode={chord.mode}
                                nextChordRoot={mode === 'progression' ? (index < chords.length - 1 ? chords[index+1].root : chords[0].root) : null}
                                showScaleNotes={showScaleNotes}
                                showLeadingNotes={showLeadingNotes}
                                visiblePositions={chord.visiblePositions}
                                isFilterMode={chord.isFiltering}
                                onNoteClick={(s, f) => handleNoteClick(index, s, f)}
                                instrument={instrument}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <footer className="app-footer">
                &copy; 2026 Rik Frankel
            </footer>
        </div>
    );
}

export default App;