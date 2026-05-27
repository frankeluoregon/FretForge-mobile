/**
 * ChordPro file parser.
 * Takes raw .chopro text and returns a structured song object.
 */

const DIRECTIVE_RE = /^\{(\w+)(?::?\s*(.+?))?\}\s*$/;
const CHORD_RE = /\[([^\]]+)\]/g;
const DEFINE_RE = /^define:?\s+(\S+)\s+base-fret\s+(\d+)\s+frets\s+(.+)$/i;

/**
 * Parse a ChordPro text string into a structured song object.
 *
 * @param {string} text  Raw .chopro file content
 * @returns {{
 *   metadata: { title: string|null, artist: string|null, key: string|null, capo: number|null },
 *   customDefinitions: Array<{ name: string, baseFret: number, frets: number[] }>,
 *   sections: Array<{ label: string|null, lines: Array<{ type: string, text?: string, segments?: Array<{ chord: string|null, text: string }> }> }>,
 *   uniqueChords: string[]
 * }}
 */
export function parseChordPro(text) {
    const metadata = { title: null, artist: null, key: null, capo: null };
    const customDefinitions = [];
    const sections = [];
    const chordSet = new Set();
    const chordOrder = [];

    let currentSection = { label: null, lines: [] };
    sections.push(currentSection);

    const lines = text.replace(/\r\n/g, '\n').split('\n');

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();

        // Skip hash comments
        if (line.startsWith('#')) continue;

        // Check for directive
        const dirMatch = line.match(DIRECTIVE_RE);
        if (dirMatch) {
            const [, directive, value] = dirMatch;
            const dir = directive.toLowerCase();
            const val = value?.trim() ?? '';

            // Metadata directives
            if (dir === 'title' || dir === 't') {
                metadata.title = val;
            } else if (dir === 'subtitle' || dir === 'st' || dir === 'artist') {
                metadata.artist = val;
            } else if (dir === 'key') {
                metadata.key = val;
            } else if (dir === 'capo') {
                const n = parseInt(val, 10);
                if (!isNaN(n)) metadata.capo = n;
            } else if (dir === 'define') {
                const defMatch = val.match(DEFINE_RE) || dirMatch[0].match(/\{define:?\s+(\S+)\s+base-fret\s+(\d+)\s+frets\s+(.+?)\}/i);
                if (defMatch) {
                    const [, name, baseFretStr, fretsStr] = defMatch;
                    customDefinitions.push({
                        name,
                        baseFret: parseInt(baseFretStr, 10),
                        frets: fretsStr.trim().split(/\s+/).map(f =>
                            f.toLowerCase() === 'x' ? -1 : parseInt(f, 10)
                        ),
                    });
                }
            } else if (dir === 'comment' || dir === 'c' || dir === 'ci') {
                // Comment becomes a section label or inline comment
                if (currentSection.lines.length === 0 && currentSection.label === null) {
                    currentSection.label = val;
                } else {
                    // Start new section with this label
                    currentSection = { label: val, lines: [] };
                    sections.push(currentSection);
                }
            } else if (dir === 'start_of_chorus' || dir === 'soc') {
                currentSection = { label: val || 'Chorus', lines: [] };
                sections.push(currentSection);
            } else if (dir === 'start_of_verse' || dir === 'sov') {
                currentSection = { label: val || 'Verse', lines: [] };
                sections.push(currentSection);
            } else if (dir === 'start_of_bridge' || dir === 'sob') {
                currentSection = { label: val || 'Bridge', lines: [] };
                sections.push(currentSection);
            } else if (dir === 'end_of_chorus' || dir === 'eoc' ||
                       dir === 'end_of_verse' || dir === 'eov' ||
                       dir === 'end_of_bridge' || dir === 'eob') {
                // End of section — start a new unlabeled section
                currentSection = { label: null, lines: [] };
                sections.push(currentSection);
            }
            continue;
        }

        // Blank line
        if (line.trim() === '') {
            currentSection.lines.push({ type: 'blank' });
            continue;
        }

        // Lyric line with optional chords
        const segments = [];
        let lastIndex = 0;
        let match;

        CHORD_RE.lastIndex = 0;
        while ((match = CHORD_RE.exec(line)) !== null) {
            // Text before this chord
            const textBefore = line.slice(lastIndex, match.index);
            if (textBefore || segments.length === 0) {
                if (segments.length === 0 && textBefore) {
                    segments.push({ chord: null, text: textBefore });
                } else if (segments.length > 0) {
                    // Append to previous segment's text
                    segments[segments.length - 1].text += textBefore;
                }
            }

            const chord = match[1];
            segments.push({ chord, text: '' });

            // Track unique chords
            if (!chordSet.has(chord)) {
                chordSet.add(chord);
                chordOrder.push(chord);
            }

            lastIndex = match.index + match[0].length;
        }

        // Remaining text after last chord
        const remaining = line.slice(lastIndex);
        if (segments.length > 0) {
            segments[segments.length - 1].text += remaining;
        } else {
            // No chords in this line — plain lyrics
            segments.push({ chord: null, text: remaining });
        }

        currentSection.lines.push({ type: 'lyrics', segments });
    }

    // Clean up empty sections
    const cleanedSections = sections.filter(
        s => s.label !== null || s.lines.some(l => l.type !== 'blank')
    );

    return {
        metadata,
        customDefinitions,
        sections: cleanedSections.length > 0 ? cleanedSections : sections,
        uniqueChords: chordOrder,
    };
}
