import { useMemo } from 'react';
import { normalizeChordName, transposeNormalizedChord } from '../utils/chordNameNormalizer.js';
import Fretboard from './Fretboard.jsx';
import { MusicTheory } from '../utils/musicTheory.js';
import { getPositionsForChord, fingeringsToPositionEntries, INSTRUMENT_MAX_FRETS } from '../utils/positions.js';
import { getChordFingerings, STRUMMED_INSTRUMENTS } from '../utils/chordsDb.js';

const STANDARD_TUNINGS = {
    guitar:   ['E', 'B', 'G', 'D', 'A', 'E'],
    ukulele:  ['A', 'E', 'C', 'G'],
    mandolin: ['E', 'E', 'A', 'A', 'D', 'D', 'G', 'G'],
};

/**
 * Hook that builds chord chart and lyrics elements from parsed ChordPro data.
 * Returns { chordChart, lyrics } for the caller to place in its own layout.
 */
export function useChordSheet({
    songData, transpose = 0, fontSize = 16,
    instrument, currentTuning, capo = 0, neckPosition = 0,
    onChordTap,
}) {
    const { sections, uniqueChords } = songData;

    const chordDisplayMap = useMemo(() => {
        const map = {};
        for (const original of uniqueChords) {
            const normalized = normalizeChordName(original);
            if (!normalized) {
                map[original] = original;
                continue;
            }
            if (transpose === 0) {
                map[original] = original;
            } else {
                const transposed = transposeNormalizedChord(normalized, transpose);
                const origRoot = original.match(/^[A-G][b#]?/)?.[0] || '';
                const suffix = original.slice(origRoot.length);
                let displaySuffix = suffix;
                if (normalized.bass) {
                    const slashIdx = suffix.lastIndexOf('/');
                    if (slashIdx >= 0) {
                        displaySuffix = suffix.slice(0, slashIdx) + '/' + transposed.bass;
                    }
                }
                map[original] = transposed.root + displaySuffix;
            }
        }
        return map;
    }, [uniqueChords, transpose]);

    const normalizedChords = useMemo(() => {
        const result = [];
        const seen = new Set();
        for (const original of uniqueChords) {
            let normalized = normalizeChordName(original);
            if (!normalized) continue;
            if (transpose !== 0) {
                normalized = transposeNormalizedChord(normalized, transpose);
            }
            const key = `${normalized.root}-${normalized.type}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({ ...normalized, displayName: chordDisplayMap[original] || original });
        }
        return result;
    }, [uniqueChords, transpose, chordDisplayMap]);

    const chordVoicings = useMemo(() => {
        const isStrummed = STRUMMED_INSTRUMENTS.has(instrument);
        const voicingIndex = neckPosition ?? 0;

        return normalizedChords.map(chord => {
            let allPositions;
            if (isStrummed) {
                const dbFingerings = getChordFingerings(instrument, chord.root, chord.type);
                const standardTuning = STANDARD_TUNINGS[instrument];
                const entries = fingeringsToPositionEntries(
                    dbFingerings, capo, standardTuning, currentTuning, INSTRUMENT_MAX_FRETS[instrument]
                );
                allPositions = entries || getPositionsForChord(chord.root, chord.type, instrument, currentTuning);
            } else {
                allPositions = getPositionsForChord(chord.root, chord.type, instrument, currentTuning);
            }

            const selected = allPositions.length > 0
                ? allPositions[Math.min(voicingIndex, allPositions.length - 1)]
                : null;
            const positions = selected?.positions ?? null;
            const mutedStrings = selected?.mutedStrings ?? null;
            const isOpen = selected?.shape === 'open';

            let fretStart = 0;
            if (positions) {
                const frets = Array.from(positions).map(k => parseInt(k.split('-')[1])).filter(f => f > 0);
                if (frets.length > 0) {
                    const maxFret = Math.max(...frets);
                    if (maxFret > 5) {
                        fretStart = Math.max(0, Math.min(...frets) - 1);
                    }
                }
            }

            return { positions, mutedStrings, isOpen, fretStart };
        });
    }, [normalizedChords, instrument, currentTuning, capo, neckPosition]);

    const chordChart = normalizedChords.length > 0 ? (
        <div className="song-chord-chart">
            {normalizedChords.map((chord, i) => {
                const voicing = chordVoicings[i];
                const defaultMode = MusicTheory.modeOptions[chord.type]?.[0]?.value || 'ionian';
                return (
                    <div
                        key={i}
                        className="song-chord-card"
                        onClick={() => onChordTap?.(chord)}
                    >
                        <div className="song-chord-card-name">{chord.displayName}</div>
                        <div className="song-chord-fretboard">
                            <Fretboard
                                tuning={currentTuning}
                                numFrets={5}
                                fretStart={voicing.fretStart}
                                root={chord.root}
                                chordType={chord.type}
                                mode={defaultMode}
                                nextChordRoot={null}
                                showScaleNotes={false}
                                showPassingNotes={false}
                                visiblePositions={voicing.positions}
                                mutedStrings={voicing.mutedStrings}
                                isFilterMode={false}
                                onNoteClick={() => {}}
                                instrument={instrument}
                                capoFret={capo}
                                isOpenChord={voicing.isOpen}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    ) : null;

    const lyrics = (
        <div className="chord-sheet" style={{ fontSize: `${fontSize}px` }}>
            {sections.map((section, si) => (
                <div key={si} className="chord-sheet-section">
                    {section.label && (
                        <div className="section-label">{section.label}</div>
                    )}
                    {section.lines.map((line, li) => {
                        if (line.type === 'blank') {
                            return <div key={li} className="chord-line-blank" />;
                        }
                        const hasChords = line.segments?.some(s => s.chord);
                        return (
                            <div key={li} className="chord-line">
                                {line.segments?.map((seg, si2) => (
                                    <span key={si2} className="chord-segment">
                                        {(hasChords) && (
                                            <span className="chord-name">
                                                {seg.chord ? (chordDisplayMap[seg.chord] || seg.chord) : '\u00A0'}
                                            </span>
                                        )}
                                        <span className="lyric-text">{seg.text || '\u00A0'}</span>
                                    </span>
                                ))}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );

    return { chordChart, lyrics };
}
