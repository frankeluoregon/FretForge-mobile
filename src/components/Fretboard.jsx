import React, { useMemo } from 'react';
import { MusicTheory } from '../utils/musicTheory';

const Fretboard = ({
    tuning,
    numFrets,
    root,
    chordType,
    mode,
    nextChordRoot,
    showScaleNotes,
    showPassingNotes,
    visiblePositions,
    isFilterMode,
    onNoteClick,
    instrument
}) => {
    const chordNotes = useMemo(() => MusicTheory.getChordNotes(root, chordType), [root, chordType]);
    const scaleNotes = useMemo(() => MusicTheory.getScaleNotes(root, mode), [root, mode]);

    // Helper to check if string is a mandolin paired string (odd indices)
    const isMandolinPaired = (index) => instrument === 'mandolin' && index % 2 === 1;

    return (
        <div 
            className={`fretboard-grid ${instrument === 'mandolin' ? 'mandolin-fretboard' : ''}`}
            style={{ gridTemplateColumns: `60px repeat(${numFrets + 1}, minmax(35px, 1fr))` }}
        >
            {tuning.map((openNote, stringIndex) => {
                const isPaired = isMandolinPaired(stringIndex);
                
                return (
                    <React.Fragment key={stringIndex}>
                        {/* String Label */}
                        <div className={`string-label ${isPaired ? 'mandolin-paired-string' : ''}`}>
                            {openNote}
                        </div>

                        {/* Frets */}
                        {Array.from({ length: numFrets + 1 }).map((_, fret) => {
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

                            return (
                                <div 
                                    key={fret}
                                    className={`fret-cell fret-${fret} ${isPaired ? 'mandolin-paired-string' : ''}`}
                                    onClick={() => onNoteClick && onNoteClick(stringIndex, fret)}
                                >
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