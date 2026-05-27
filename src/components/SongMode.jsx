import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { listChoProFiles, loadChoProFile } from '../utils/choproFileService.js';
import { parseChordPro } from '../utils/chordProParser.js';
import { useChordSheet } from './ChordSheet.jsx';

/**
 * Song Mode container: file browser + chord sheet display.
 */
const SongMode = ({
    songData, setSongData,
    songFile, setSongFile,
    transpose, setTranspose,
    fontSize, setFontSize,
    instrument,
    currentTuning,
    capo,
    neckPosition,
    onChordTap,
}) => {
    // ─── All hooks must be declared before any conditional returns ───
    const [files, setFiles] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [autoScroll, setAutoScroll] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(30); // ms interval — lower = faster
    const [activeLetter, setActiveLetter] = useState(null);
    const [collapsedArtists, setCollapsedArtists] = useState(new Set());
    const scrollRef = useRef(null);
    const searchTimeout = useRef(null);

    // Fetch file list
    const fetchFiles = useCallback(async (query) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listChoProFiles(query || undefined);
            setFiles(result);
        } catch (err) {
            setError('Could not connect to ChordPro server. Run: node server/choproApi.js');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        if (!songData) fetchFiles('');
    }, [songData, fetchFiles]);

    // Reset letter when search changes or files reload
    useEffect(() => { setActiveLetter(null); }, [files]);

    // Auto-scroll effect — speed is inversely mapped: slider 1(fast)–100(slow) → interval 10ms–200ms
    useEffect(() => {
        if (!autoScroll || !scrollRef.current) return;
        const el = scrollRef.current;
        const intervalMs = 10 + (scrollSpeed / 100) * 190; // 10ms–200ms
        let prevTop = el.scrollTop;
        const interval = setInterval(() => {
            el.scrollTop += 1;
            // Only stop if scroll position didn't change (truly at bottom)
            if (el.scrollTop === prevTop) {
                setAutoScroll(false);
            }
            prevTop = el.scrollTop;
        }, intervalMs);
        return () => clearInterval(interval);
    }, [autoScroll, scrollSpeed]);

    // Group files by artist, sorted A-Z, then by first letter
    const { letterGroups, availableLetters } = useMemo(() => {
        const groups = {};
        for (const file of files) {
            const artist = file.artist || 'Unknown Artist';
            if (!groups[artist]) groups[artist] = [];
            groups[artist].push(file);
        }
        const sortedArtists = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        const byLetter = {};
        for (const artist of sortedArtists) {
            const firstChar = artist[0]?.toUpperCase() || '#';
            const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
            if (!byLetter[letter]) byLetter[letter] = [];
            byLetter[letter].push({
                artist,
                songs: groups[artist].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
            });
        }
        const letters = Object.keys(byLetter).sort((a, b) => {
            if (a === '#') return 1;
            if (b === '#') return -1;
            return a.localeCompare(b);
        });
        return { letterGroups: byLetter, availableLetters: letters };
    }, [files]);

    const visibleArtistGroups = activeLetter
        ? (letterGroups[activeLetter] || [])
        : availableLetters.flatMap(l => letterGroups[l]);

    // Always call hook (React rules) — use dummy when no song loaded
    const EMPTY_SONG = { metadata: {}, sections: [], uniqueChords: [], customDefinitions: [] };
    const { chordChart, lyrics } = useChordSheet({
        songData: songData || EMPTY_SONG,
        transpose,
        fontSize,
        instrument,
        currentTuning,
        capo,
        neckPosition,
        onChordTap,
    });

    // ─── Handlers ───
    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearch(val);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchFiles(val), 300);
    };

    const handleFileSelect = async (filename) => {
        setLoading(true);
        setError(null);
        try {
            const content = await loadChoProFile(filename);
            const parsed = parseChordPro(content);
            setSongData(parsed);
            setSongFile(filename);
            setTranspose(0);
        } catch (err) {
            setError(`Failed to load ${filename}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setSongData(null);
        setSongFile(null);
        setTranspose(0);
    };

    const toggleArtist = (artist) => {
        setCollapsedArtists(prev => {
            const next = new Set(prev);
            if (next.has(artist)) next.delete(artist);
            else next.add(artist);
            return next;
        });
    };

    // ─── Chord Sheet View ───
    if (songData) {
        const songControls = (
            <div className="song-controls song-controls-inline">
                <div className="song-transpose-controls">
                    <button
                        className="song-control-btn"
                        onClick={() => setTranspose(t => t - 1)}
                        title="Transpose down"
                    >-</button>
                    <span className="transpose-label">
                        {transpose === 0 ? 'Original' : `${transpose > 0 ? '+' : ''}${transpose}`}
                    </span>
                    <button
                        className="song-control-btn"
                        onClick={() => setTranspose(t => t + 1)}
                        title="Transpose up"
                    >+</button>
                </div>
                <div className="song-font-controls">
                    <button
                        className="song-control-btn"
                        onClick={() => setFontSize(s => Math.max(10, s - 2))}
                        title="Smaller text"
                    >-</button>
                    <button
                        className="song-control-btn"
                        onClick={() => setFontSize(s => Math.min(28, s + 2))}
                        title="Larger text"
                    >+</button>
                </div>
                <div className="song-scroll-controls">
                    <button
                        className={`song-control-btn ${autoScroll ? 'active' : ''}`}
                        onClick={() => setAutoScroll(a => !a)}
                        title="Auto-scroll"
                    >{autoScroll ? 'Scrolling' : 'Scroll'}</button>
                    <input
                        type="range"
                        className={`scroll-speed-slider${!autoScroll ? ' disabled' : ''}`}
                        min="1"
                        max="100"
                        value={101 - scrollSpeed}
                        onChange={(e) => setScrollSpeed(101 - Number(e.target.value))}
                        disabled={!autoScroll}
                        title={`Speed: ${101 - scrollSpeed}%`}
                    />
                </div>
            </div>
        );

        return (
            <div className="song-mode">
                <div className="song-controls song-controls-top">
                    <button className="song-control-btn library-btn" onClick={handleBack}>
                        ← Library
                    </button>
                    {songData.metadata?.title && (
                        <span className="song-topline-title">{songData.metadata.title}</span>
                    )}
                    {songData.metadata?.artist && (
                        <span className="song-topline-artist">{songData.metadata.artist}</span>
                    )}
                </div>
                {chordChart}
                {songControls}
                <div className="song-sheet-container" ref={scrollRef}>
                    {lyrics}
                </div>
            </div>
        );
    }

    // ─── File Browser View ───
    return (
        <div className="song-mode">
            <div className="file-browser">
                <div className="file-browser-header">
                    <input
                        type="text"
                        className="file-search-input"
                        placeholder="Search songs..."
                        value={search}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                    {files.length > 0 && (
                        <span className="file-count">{files.length} songs</span>
                    )}
                </div>

                {/* Letter pagination */}
                {!search && availableLetters.length > 1 && (
                    <div className="letter-nav">
                        <button
                            className={`letter-btn ${activeLetter === null ? 'active' : ''}`}
                            onClick={() => setActiveLetter(null)}
                        >All</button>
                        {availableLetters.map(letter => (
                            <button
                                key={letter}
                                className={`letter-btn ${activeLetter === letter ? 'active' : ''}`}
                                onClick={() => setActiveLetter(letter)}
                            >{letter}</button>
                        ))}
                    </div>
                )}

                {error && <div className="file-browser-error">{error}</div>}
                {loading && !files.length && <div className="file-browser-loading">Loading...</div>}

                <div className="file-list">
                    {visibleArtistGroups.map(({ artist, songs }) => (
                        <div key={artist} className="artist-group">
                            <div
                                className="artist-group-header"
                                onClick={() => toggleArtist(artist)}
                            >
                                <span className="artist-group-toggle">
                                    {collapsedArtists.has(artist) ? '▸' : '▾'}
                                </span>
                                <span className="artist-group-name">{artist}</span>
                                <span className="artist-group-count">{songs.length}</span>
                            </div>
                            {!collapsedArtists.has(artist) && songs.map((file) => (
                                <div
                                    key={file.filename}
                                    className="file-list-item"
                                    onClick={() => handleFileSelect(file.filename)}
                                >
                                    <span className="file-title">{file.title}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SongMode;
