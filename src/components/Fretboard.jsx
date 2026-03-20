import React, { useMemo } from 'react';
import { MusicTheory } from '../utils/musicTheory';

const Fretboard = ({
    tuning,
    numFrets,
    fretStart = 0,
    root,
    chordType,
    mode,
    nextChordRoot,
    showScaleNotes,
    showPassingNotes,
    visiblePositions,
    mutedStrings,
    isFilterMode,
    onNoteClick,
    instrument,
    capoFret = 0,
    isOpenChord = false,
}) => {
    const chordNotes = useMemo(() => MusicTheory.getChordNotes(root, chordType), [root, chordType]);
    const scaleNotes = useMemo(() => MusicTheory.getScaleNotes(root, mode), [root, mode]);

    // Barre fret: lowest non-zero fret shared by 2+ strings (null for open chords or single-finger positions)
    const barFret = useMemo(() => {
        if (isOpenChord) return null;
        if (!visiblePositions || visiblePositions.size === 0) return null;
        const frets = Array.from(visiblePositions).map(k => parseInt(k.split('-')[1])).filter(f => f > 0);
        if (frets.length === 0) return null;
        const minFret = Math.min(...frets);
        if (frets.filter(f => f === minFret).length < 2) return null;
        return minFret;
    }, [visiblePositions, isOpenChord]);

    // First and last non-paired string indices — bar spans the full column
    const firstBarreStringIndex = useMemo(() => {
        if (barFret === null) return null;
        return tuning.findIndex((_, i) => !(instrument === 'mandolin' && i % 2 === 1));
    }, [barFret, tuning, instrument]);

    const lastBarreStringIndex = useMemo(() => {
        if (barFret === null) return null;
        for (let i = tuning.length - 1; i >= 0; i--) {
            if (!(instrument === 'mandolin' && i % 2 === 1)) return i;
        }
        return null;
    }, [barFret, tuning, instrument]);

    // Helper to check if string is a mandolin paired string (odd indices)
    const isMandolinPaired = (index) => instrument === 'mandolin' && index % 2 === 1;

    return (
        <div
            className={`fretboard-grid ${instrument === 'mandolin' ? 'mandolin-fretboard' : ''}`}
            style={{ gridTemplateColumns: `60px repeat(${numFrets + 1}, minmax(35px, 1fr))` }}
        >
            {tuning.map((openNote, stringIndex) => {
                const isPaired = isMandolinPaired(stringIndex);
                const isMuted = mutedStrings?.has(stringIndex) ?? false;

                return (
                    <React.Fragment key={stringIndex}>
                        {/* String Label */}
                        <div className={`string-label ${isPaired ? 'mandolin-paired-string' : ''} ${isMuted ? 'muted-string' : ''}`}>
                            {openNote}
                        </div>

                        {/* Frets */}
                        {Array.from({ length: numFrets + 1 }).map((_, fretIdx) => {
                            const fret = fretStart + fretIdx;
                            const note = MusicTheory.transposeNote(openNote, fret);

                            // Logic for markers
                            const isChordTone = chordNotes.some(n => MusicTheory.areNotesEqual(note, n));
                            const isScaleNote = scaleNotes.some(n => MusicTheory.areNotesEqual(note, n));
                            const isRoot = MusicTheory.areNotesEqual(note, root);

                            const passingNote = showPassingNotes && nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                            const isPassingNote = passingNote && MusicTheory.areNotesEqual(note, passingNote);

                            const shouldShowScaleNote = showScaleNotes && isScaleNote && !isChordTone;
                            const isValidNote = isChordTone || shouldShowScaleNote || isPassingNote;

                            // Filter logic
                            const posKey = `${stringIndex}-${fret}`;
                            const isSelected = visiblePositions ? visiblePositions.has(posKey) : true;
                            const shouldRenderMarker = (isFilterMode || isSelected) && isValidNote && !isPaired;

                            const isBarreFret = barFret !== null && fret === barFret;

                            return (
                                <div
                                    key={fret}
                                    className={`fret-cell fret-${fretIdx} ${fret === 0 ? 'nut' : ''} ${isPaired ? 'mandolin-paired-string' : ''} ${isMuted ? 'muted-string' : ''} ${isBarreFret ? 'barre-fret' : ''}`}
                                    onClick={() => onNoteClick && onNoteClick(stringIndex, fret)}
                                >
                                    {isMuted && (barFret !== null ? isBarreFret : fret === 0) && !isPaired && (
                                        <div className="fret-marker muted-x" style={{ zIndex: 2 }}>✕</div>
                                    )}
                                    {isBarreFret && !isPaired && (
                                        <div className={`barre-bar${stringIndex === firstBarreStringIndex ? ' barre-top' : ''}${stringIndex === lastBarreStringIndex ? ' barre-bottom' : ''}`} />
                                    )}
                                    {capoFret > 0 && fret === capoFret && !isPaired && <div className="capo-bar" />}
                                    {shouldRenderMarker && (
                                        <div className={`fret-marker
                                            ${isRoot ? 'root' : ''}
                                            ${isChordTone ? 'chord-tone' : ''}
                                            ${isScaleNote && !isChordTone ? 'scale-note' : ''}
                                            ${isPassingNote && !isChordTone ? 'passing-note' : ''}
                                            ${isPassingNote && isChordTone && !isRoot ? 'chord-tone-passing' : ''}
                                            ${isFilterMode && !isSelected ? 'dimmed' : ''}
                                            ${isFilterMode && isSelected ? 'selected' : ''}
                                            ${onNoteClick ? 'interactive' : ''}
                                        `}>
                                            {isRoot && (
                                                <>
                                                    <span className="note-name" dangerouslySetInnerHTML={{__html: note.replace('#', '<sup>♯</sup>')}} />
                                                    <span className="interval">R</span>
                                                </>
                                            )}
                                            {!isRoot && isChordTone && (
                                                <>
                                                    <span className="note-name" dangerouslySetInnerHTML={{__html: note.replace('#', '<sup>♯</sup>')}} />
                                                    <span className="interval">{MusicTheory.getChordIntervalLabel(root, note, chordType)}</span>
                                                    {isPassingNote && <span className="passing-arrow">➜</span>}
                                                </>
                                            )}
                                            {!isRoot && !isChordTone && isPassingNote && (
                                                // Passing note arrow handled by CSS ::before
                                                <span />
                                            )}
                                            {!isRoot && !isChordTone && !isPassingNote && isScaleNote && (
                                                <>
                                                    <span className="note-name" dangerouslySetInnerHTML={{__html: note.replace('#', '<sup>♯</sup>')}} />
                                                    <span className="interval">{MusicTheory.getScaleDegreeLabel(root, note, mode)}</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Fret Numbers and Inlays (only on last string) */}
                                    {stringIndex === tuning.length - 1 && (
                                        <>
                                            {fret === 0 && <div className="fret-number">O</div>}
                                            {fret > 0 && <div className="fret-number">{fret}</div>}
                                            {fret > 0 && [3, 5, 7, 9, 15, 17].includes(fret) && <div className="fret-inlay" />}
                                            {fret > 0 && [12, 24].includes(fret) && (
                                                <><div className="fret-inlay" style={{left: '30%'}} /><div className="fret-inlay" style={{left: '60%'}} /></>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default Fretboard;