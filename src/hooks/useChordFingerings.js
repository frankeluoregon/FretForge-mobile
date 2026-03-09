import { useMemo } from 'react';
import { getChordFingerings, STRUMMED_INSTRUMENTS } from '../utils/chordsDb';

/**
 * Returns preferred chord fingerings from the local @tombatossals/chords-db database.
 * Synchronous — no network requests.
 *
 * Returns:
 *   fingerings: { open: Fingering[], barre: Fingering[] }
 *   loading:    always false (kept for API compatibility)
 *   error:      null when found, message when instrument/chord not in database
 */
export function useChordFingerings(instrument, root, chordType) {
    const fingerings = useMemo(() => {
        if (!STRUMMED_INSTRUMENTS.has(instrument) || !root || !chordType) {
            return { open: [], barre: [] };
        }
        return getChordFingerings(instrument, root, chordType);
    }, [instrument, root, chordType]);

    const hasData = fingerings.open.length > 0 || fingerings.barre.length > 0;

    return {
        fingerings,
        loading: false,
        error: (!hasData && STRUMMED_INSTRUMENTS.has(instrument))
            ? `No fingerings in database for ${root} ${chordType} on ${instrument}`
            : null,
    };
}
