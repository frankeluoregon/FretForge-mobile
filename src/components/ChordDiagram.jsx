import React, { useMemo } from 'react';
import Chord from '@techies23/react-chords';
import { getRawDbPositions, CHORD_DIAGRAM_CONFIGS } from '../utils/chordsDb';

/**
 * Renders a chord box diagram using @techies23/react-chords.
 * Displays the voicing at positionIndex from @tombatossals/chords-db.
 * Index is clamped to the available range — no own navigation.
 *
 * Props:
 *   instrument    'guitar' | 'ukulele'
 *   root          note name, e.g. 'C', 'F#'
 *   chordType     FretForge chord type, e.g. 'major', 'minor7'
 *   positionIndex voicing index (0 = open/lowest barre by default)
 */
const ChordDiagram = ({ instrument, root, chordType, positionIndex = 0 }) => {
    const positions = useMemo(
        () => getRawDbPositions(instrument, root, chordType) ?? [],
        [instrument, root, chordType]
    );

    const config = CHORD_DIAGRAM_CONFIGS[instrument];
    if (!config || positions.length === 0) return null;

    const idx = Math.min(positionIndex, positions.length - 1);
    const pos = positions[idx];

    return (
        <div className="chord-diagram">
            <div className="chord-diagram-svg">
                <Chord chord={pos} instrument={config} />
            </div>
            {positions.length > 1 && (
                <div className="chord-diagram-counter">{idx + 1}/{positions.length}</div>
            )}
        </div>
    );
};

export default ChordDiagram;
