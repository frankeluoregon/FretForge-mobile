import React, { useState, useMemo } from 'react';
import Chord from '@techies23/react-chords';
import { getRawDbPositions, CHORD_DIAGRAM_CONFIGS } from '../utils/chordsDb';

/**
 * Renders a chord box diagram using @techies23/react-chords.
 * Displays the preferred fingering from @tombatossals/chords-db with
 * prev/next navigation between all available positions.
 *
 * Props:
 *   instrument  'guitar' | 'ukulele' (mandolin not in chords-db)
 *   root        note name, e.g. 'C', 'F#'
 *   chordType   FretForge chord type, e.g. 'major', 'minor7'
 *   capo        capo fret (0 = none) — shown as a label; open shapes are preferred
 *   onSelect    optional callback(positionIndex) when user navigates diagrams
 */
const ChordDiagram = ({ instrument, root, chordType, capo = 0, onSelect }) => {
    const [idx, setIdx] = useState(0);

    const positions = useMemo(
        () => getRawDbPositions(instrument, root, chordType) ?? [],
        [instrument, root, chordType]
    );

    // Reset to first position when chord changes
    React.useEffect(() => { setIdx(0); }, [instrument, root, chordType]);

    const config = CHORD_DIAGRAM_CONFIGS[instrument];
    if (!config || positions.length === 0) return null;

    const pos = positions[idx];

    const prev = () => {
        const next = (idx - 1 + positions.length) % positions.length;
        setIdx(next);
        onSelect?.(next);
    };
    const next = () => {
        const n = (idx + 1) % positions.length;
        setIdx(n);
        onSelect?.(n);
    };

    return (
        <div className="chord-diagram">
            {positions.length > 1 && (
                <button className="chord-diagram-nav" onClick={prev} title="Previous fingering">‹</button>
            )}
            <div className="chord-diagram-svg">
                <Chord chord={pos} instrument={config} />
                {capo > 0 && (
                    <div className="chord-diagram-capo-badge" title={`Capo ${capo}`}>
                        ∩{capo}
                    </div>
                )}
            </div>
            {positions.length > 1 && (
                <button className="chord-diagram-nav" onClick={next} title="Next fingering">›</button>
            )}
            {positions.length > 1 && (
                <div className="chord-diagram-counter">{idx + 1}/{positions.length}</div>
            )}
        </div>
    );
};

export default ChordDiagram;
