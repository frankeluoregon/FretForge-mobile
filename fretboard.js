// Fretboard Module
const Fretboard = {
    // Tuning configurations
    tunings: {
        guitar: ['E', 'B', 'G', 'D', 'A', 'E'],      // 6-string guitar (high to low)
        bass4: ['G', 'D', 'A', 'E'],                  // 4-string bass
        bass5: ['G', 'D', 'A', 'E', 'B'],            // 5-string bass (high to low)
        bass6: ['C', 'G', 'D', 'A', 'E', 'B'],       // 6-string bass (high to low)
        ukulele: ['A', 'E', 'C', 'G'],                // Ukulele (high to low, reentrant tuning)
        mandolin: ['E', 'E', 'A', 'A', 'D', 'D', 'G', 'G'],  // Mandolin (4 courses, paired strings, high to low: EADG tuned in 5ths)
        banjo: ['D', 'B', 'G', 'D', 'G']              // 5-string banjo (high to low, with short 5th string)
    },
    // Guitar alternate tunings
    guitarTunings: {
        standard: ['E', 'B', 'G', 'D', 'A', 'E'],    // Standard tuning
        dropD: ['E', 'B', 'G', 'D', 'A', 'D'],       // Drop D
        dropC: ['D', 'A', 'F', 'C', 'G', 'C'],       // Drop C
        openD: ['D', 'A', 'F#', 'D', 'A', 'D'],      // Open D
        openG: ['D', 'B', 'G', 'D', 'G', 'D'],       // Open G
        openC: ['E', 'C', 'G', 'C', 'G', 'C'],       // Open C
        openE: ['E', 'B', 'G#', 'E', 'B', 'E'],      // Open E
        openAm: ['E', 'C', 'A', 'E', 'A', 'E'],      // Open A Minor
        dadgad: ['D', 'A', 'G', 'D', 'A', 'D']       // DADGAD
    },
    currentInstrument: 'guitar',
    currentGuitarTuning: 'standard',
    tuning: ['E', 'B', 'G', 'D', 'A', 'E'],  // Default to guitar
    numFrets: 12,
    displayFrets: 12,  // For PDF export, can be different from numFrets

    /**
     * Set the instrument type
     */
    setInstrument(instrument) {
        this.currentInstrument = instrument;
        if (instrument === 'guitar') {
            // For guitar, use the current guitar tuning
            this.tuning = this.guitarTunings[this.currentGuitarTuning];
        } else {
            this.tuning = this.tunings[instrument];
        }
    },

    /**
     * Set the guitar tuning (only for guitar instrument)
     */
    setGuitarTuning(tuningName) {
        if (this.currentInstrument === 'guitar' && this.guitarTunings[tuningName]) {
            this.currentGuitarTuning = tuningName;
            this.tuning = this.guitarTunings[tuningName];
        }
    },

    /**
     * Get the note at a specific string and fret
     */
    getNoteAtPosition(stringIndex, fret) {
        const openNote = this.tuning[stringIndex];
        return MusicTheory.transposeNote(openNote, fret);
    },

    /**
     * Check if this is a mandolin paired string (second string of a course)
     */
    isMandolinPairedString(stringIndex) {
        return this.currentInstrument === 'mandolin' && stringIndex % 2 === 1;
    },

    /**
     * Create the fretboard HTML structure in a specific container
     */
    createFretboard(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'fretboard-grid';
        // Add mandolin class if needed
        if (this.currentInstrument === 'mandolin') {
            grid.classList.add('mandolin-fretboard');
        }
        // Dynamically set grid columns: label column + (numFrets + 1) for open string and frets
        grid.style.gridTemplateColumns = `60px repeat(${this.numFrets + 1}, 1fr)`;

        // Create grid: strings (rows) x frets (columns)
        for (let stringIndex = 0; stringIndex < this.tuning.length; stringIndex++) {
            // String label
            const label = document.createElement('div');
            label.className = 'string-label';
            // For mandolin paired strings (odd indices), add special class
            if (this.isMandolinPairedString(stringIndex)) {
                label.classList.add('mandolin-paired-string');
            }
            label.textContent = this.tuning[stringIndex];
            grid.appendChild(label);

            // Frets for this string
            for (let fret = 0; fret <= this.numFrets; fret++) {
                const cell = document.createElement('div');
                cell.className = `fret-cell fret-${fret}`;
                // For mandolin paired strings, add special class
                if (this.isMandolinPairedString(stringIndex)) {
                    cell.classList.add('mandolin-paired-string');
                }
                cell.dataset.string = stringIndex;
                cell.dataset.fret = fret;

                // Add fret markers for last string only (bottom)
                if (stringIndex === this.tuning.length - 1 && fret > 0) {
                    const fretNum = document.createElement('div');
                    fretNum.className = 'fret-number';
                    fretNum.textContent = fret;
                    cell.appendChild(fretNum);

                    // Add position marker dots
                    if ([3, 5, 7, 9, 15, 17].includes(fret)) {
                        const inlay = document.createElement('div');
                        inlay.className = 'fret-inlay';
                        cell.appendChild(inlay);
                    }

                    // Double dots for 12th and 24th fret (though 24 is beyond our range)
                    if ([12, 24].includes(fret)) {
                        const inlay1 = document.createElement('div');
                        inlay1.className = 'fret-inlay';
                        inlay1.style.left = '30%';
                        const inlay2 = document.createElement('div');
                        inlay2.className = 'fret-inlay';
                        inlay2.style.left = '60%';
                        cell.appendChild(inlay1);
                        cell.appendChild(inlay2);
                    }
                }

                grid.appendChild(cell);
            }
        }

        container.appendChild(grid);
    },

    /**
     * Update the fretboard with note markers
     */
    updateFretboard(containerId, rootNote, chordType, scaleType, nextChordRoot = null, showLeadingNotes = false, showScaleNotes = true, visiblePositions = null, isFilterMode = false, onNoteClick = null) {
        const container = document.getElementById(containerId);
        const chordNotes = MusicTheory.getChordNotes(rootNote, chordType);
        const scaleNotes = MusicTheory.getScaleNotes(rootNote, scaleType);

        // Clear all existing markers in this container
        container.querySelectorAll('.fret-marker').forEach(marker => marker.remove());

        // Iterate through all positions
        for (let stringIndex = 0; stringIndex < this.tuning.length; stringIndex++) {
            // For mandolin, skip the paired strings (odd indices) - only show markers on the first string of each course
            if (this.isMandolinPairedString(stringIndex)) {
                continue;
            }

            for (let fret = 0; fret <= this.numFrets; fret++) {
                const note = this.getNoteAtPosition(stringIndex, fret);
                const cell = container.querySelector(
                    `.fret-cell[data-string="${stringIndex}"][data-fret="${fret}"]`
                );

                if (!cell) continue;

                const isChordTone = chordNotes.some(chordNote =>
                    MusicTheory.areNotesEqual(note, chordNote)
                );
                const isScaleNote = scaleNotes.some(scaleNote =>
                    MusicTheory.areNotesEqual(note, scaleNote)
                );
                const isRoot = MusicTheory.areNotesEqual(note, rootNote);
                // Leading note is a half step below the next chord's root (only in progression mode)
                const leadingNote = showLeadingNotes && nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                const isLeadingNote = leadingNote && MusicTheory.areNotesEqual(note, leadingNote);

                // Determine if this note is theoretically valid for the current settings
                const shouldShowScaleNote = showScaleNotes && isScaleNote && !isChordTone;
                const isValidNote = isChordTone || shouldShowScaleNote || isLeadingNote;

                if (!isValidNote) continue;

                // Filter Logic:
                // 1. If in Filter Mode: Show ALL valid notes. Check if they are currently selected in the filter.
                // 2. If in View Mode (Normal): Only show notes that are in the filter (if a filter exists).
                const posKey = `${stringIndex}-${fret}`;
                const isSelected = visiblePositions ? visiblePositions.has(posKey) : true;
                
                // Render if we are in filter mode (to show options) OR if the note is selected
                if (isFilterMode || isSelected) {
                    const marker = document.createElement('div');
                    marker.className = 'fret-marker';

                    // Determine what to display
                    if (isRoot) {
                        const noteName = note.replace('#', '<sup>♯</sup>');
                        marker.innerHTML = `<span class="note-name">${noteName}</span><span class="interval">R</span>`;
                    } else if (isLeadingNote) {
                        // Leading note displays arrow via CSS ::before
                        marker.innerHTML = '';
                    } else if (isChordTone) {
                        const interval = MusicTheory.getChordIntervalLabel(rootNote, note, chordType);
                        const noteName = note.replace('#', '<sup>♯</sup>');
                        marker.innerHTML = `<span class="note-name">${noteName}</span><span class="interval">${interval}</span>`;
                    } else if (isScaleNote) {
                        const degree = MusicTheory.getScaleDegreeLabel(rootNote, note, scaleType);
                        const noteName = note.replace('#', '<sup>♯</sup>');
                        marker.innerHTML = `<span class="note-name">${noteName}</span><span class="interval">${degree}</span>`;
                    }

                    // Apply styling - priority: Root > Leading Note > Chord Tone > Scale Note
                    if (isRoot) {
                        marker.classList.add('root');
                        if (isChordTone) {
                            marker.classList.add('chord-tone');
                        }
                    } else if (isLeadingNote) {
                        // All leading notes use triangle, regardless of whether they're chord tones
                        marker.classList.add('leading-note');
                    } else if (isChordTone) {
                        marker.classList.add('chord-tone');
                    } else if (isScaleNote) {
                        marker.classList.add('scale-note');
                    }

                    // Make all markers interactive if a click handler is present
                    if (onNoteClick) {
                        marker.classList.add('interactive');
                        marker.addEventListener('click', (e) => {
                            e.stopPropagation();
                            onNoteClick(stringIndex, fret);
                        });
                    }

                    // Apply Filter Mode specific styling
                    if (isFilterMode) {
                        if (!isSelected) {
                            marker.classList.add('dimmed');
                        } else {
                            marker.classList.add('selected');
                        }
                    }

                    cell.appendChild(marker);
                }
            }
        }
    },

    /**
     * Render a complete fretboard (create + update)
     */
    renderFretboard(containerId, rootNote, chordType, scaleType, nextChordRoot = null, showLeadingNotes = false, showScaleNotes = true, visiblePositions = null, isFilterMode = false, onNoteClick = null) {
        this.createFretboard(containerId);
        this.updateFretboard(containerId, rootNote, chordType, scaleType, nextChordRoot, showLeadingNotes, showScaleNotes, visiblePositions, isFilterMode, onNoteClick);
    }
};
