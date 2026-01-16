// Main Application
const App = {
    // Default settings
    currentMode: 'fretboard', // 'fretboard' or 'progression'
    currentInstrument: 'guitar',
    numChords: 4,
    chords: [],
    currentTheme: 'default',
    pdfOrientation: 'landscape', // 'portrait' or 'landscape'

    // Progression mode settings
    progressionKey: 'C',
    progressionQuality: 'major',
    showLeadingNotes: true,
    showScaleNotes: true,

    /**
     * Initialize the application
     */
    init() {
        // Load saved settings
        this.loadSettings();

        // Initialize chord progression with defaults
        this.initializeChords();

        // Show guitar tuning selector by default (since guitar is the default instrument)
        document.getElementById('guitar-tuning-group').style.display = 'flex';

        // Set up event listeners
        this.setupEventListeners();

        // Set initial padding based on menu bar height
        this.updatePadding();

        // Setup responsive fret limiting
        this.setupResponsiveFrets();

        // Setup mobile toolbar auto-hide
        this.setupMobileToolbarAutoHide();

        // Update padding on window resize
        window.addEventListener('resize', () => this.updatePadding());

        // Render the initial mode
        this.renderFretboards();

        // Ensure favicon matches theme
        this.updateFavicon();
    },

    /**
     * Setup responsive fret limiting based on viewport
     */
    setupResponsiveFrets() {
        const handleViewportChange = () => {
            // Only apply on smaller screens (mobile/tablet)
            if (window.innerWidth <= 768) {
                const isPortrait = window.innerHeight > window.innerWidth;
                const numFretsSelect = document.getElementById('num-frets');

                if (isPortrait) {
                    // Portrait: limit to 5 frets
                    Fretboard.numFrets = 5;
                    if (numFretsSelect) numFretsSelect.value = '5';
                } else {
                    // Landscape: allow up to 12 frets, default to 12
                    Fretboard.numFrets = 12;
                    if (numFretsSelect) numFretsSelect.value = '12';
                }

                // Re-render if already initialized
                if (this.chords && this.chords.length > 0) {
                    if (this.currentMode === 'fretboard') {
                        this.renderFretboards();
                    } else {
                        this.renderProgressionDisplay();
                    }
                }
            }
        };

        // Initial setup with slight delay to ensure DOM is ready
        setTimeout(() => handleViewportChange(), 100);

        // Listen for orientation and resize changes
        window.addEventListener('orientationchange', handleViewportChange);
        window.addEventListener('resize', handleViewportChange);
    },

    /**
     * Setup mobile toolbar auto-hide on scroll
     */
    setupMobileToolbarAutoHide() {
        // Only apply on mobile screens
        if (window.innerWidth > 768) return;

        const topBar = document.querySelector('.top-bar');
        if (!topBar) return;

        // Create pull-down tab
        const toolbarTab = document.createElement('div');
        toolbarTab.className = 'toolbar-tab';
        toolbarTab.innerHTML = '<span class="tab-label">MENU</span><span class="tab-arrow">▼</span>';
        document.body.appendChild(toolbarTab);

        let lastScrollTop = 0;
        let scrollTimeout = null;

        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // Clear any pending timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            // Scrolling down and past threshold - hide toolbar
            if (scrollTop > lastScrollTop && scrollTop > 50) {
                topBar.classList.add('hidden');
                toolbarTab.classList.add('visible');
            }

            lastScrollTop = scrollTop;
        };

        // Handle tab click to reveal toolbar
        toolbarTab.addEventListener('click', () => {
            topBar.classList.remove('hidden');
            toolbarTab.classList.remove('visible');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Listen for scroll events (throttled)
        window.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                scrollTimeout = setTimeout(() => {
                    handleScroll();
                    scrollTimeout = null;
                }, 50);
            }
        }, { passive: true });

        // Re-check on orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                topBar.classList.remove('hidden');
                toolbarTab.classList.remove('visible');
                lastScrollTop = 0;
            }, 300);
        });
    },

    /**
     * Initialize chord objects
     */
    initializeChords() {
        const defaultChords = [
            { root: 'C', type: 'major', mode: 'ionian' },
            { root: 'A', type: 'minor', mode: 'aeolian' },
            { root: 'F', type: 'major', mode: 'ionian' },
            { root: 'G', type: 'major', mode: 'mixolydian' }
        ];

        this.chords = [];
        for (let i = 0; i < this.numChords; i++) {
            if (i < defaultChords.length) {
                this.chords.push({ ...defaultChords[i] });
            } else {
                this.chords.push({ root: 'C', type: 'major', mode: 'ionian' });
            }
        }
    },

    /**
     * Set up event listeners for controls
     */
    setupEventListeners() {
        // Mode toggle
        document.getElementById('fretboard-mode-btn').addEventListener('click', () => {
            this.switchMode('fretboard');
        });

        document.getElementById('progression-mode-btn').addEventListener('click', () => {
            this.switchMode('progression');
        });

        // Global controls
        const instrumentSelect = document.getElementById('instrument');
        const numChordsSelect = document.getElementById('num-chords');

        instrumentSelect.addEventListener('change', (e) => {
            this.currentInstrument = e.target.value;
            Fretboard.setInstrument(this.currentInstrument);
            this.saveSettings();

            // Show/hide guitar tuning selector
            const guitarTuningGroup = document.getElementById('guitar-tuning-group');
            if (this.currentInstrument === 'guitar') {
                guitarTuningGroup.style.display = 'flex';
            } else {
                guitarTuningGroup.style.display = 'none';
            }

            if (this.currentMode === 'fretboard') {
                this.renderFretboards();
            } else {
                this.renderProgressionDisplay();
            }
        });

        // Guitar tuning selector
        const guitarTuningSelect = document.getElementById('guitar-tuning');
        guitarTuningSelect.addEventListener('change', (e) => {
            Fretboard.setGuitarTuning(e.target.value);
            this.saveSettings();
            if (this.currentMode === 'fretboard') {
                this.renderFretboards();
            } else {
                this.renderProgressionDisplay();
            }
        });

        numChordsSelect.addEventListener('change', (e) => {
            this.numChords = parseInt(e.target.value);
            this.initializeChords();
            this.renderFretboards();
        });

        // Fret count selector
        document.getElementById('num-frets').addEventListener('change', (e) => {
            Fretboard.numFrets = parseInt(e.target.value);
            if (this.currentMode === 'fretboard') {
                this.renderFretboards();
            } else {
                this.renderProgressionDisplay();
            }
        });

        // PDF orientation selector - now triggers export on change
        document.getElementById('pdf-orientation').addEventListener('change', (e) => {
            this.pdfOrientation = e.target.value;
        });

        // Zoom slider
        const zoomSlider = document.getElementById('zoom-slider');
        const zoomValue = document.getElementById('zoom-value');
        zoomSlider.addEventListener('input', (e) => {
            const zoom = e.target.value;
            zoomValue.textContent = `${zoom}%`;

            // Apply zoom to both fretboard and progression containers
            const fretboardContainer = document.getElementById('fretboard-container');
            const progressionDisplay = document.getElementById('progression-display');

            fretboardContainer.style.transform = `scale(${zoom / 100})`;
            fretboardContainer.style.transformOrigin = 'top center';

            progressionDisplay.style.transform = `scale(${zoom / 100})`;
            progressionDisplay.style.transformOrigin = 'top center';
        });

        // Chord select mode scale notes toggle
        document.getElementById('chord-select-show-scale').addEventListener('change', (e) => {
            this.showScaleNotes = e.target.checked;
            if (this.currentMode === 'fretboard') {
                this.renderFretboards();
            }
        });

        // Progression mode controls - split key selector
        document.getElementById('progression-key-letter').addEventListener('change', (e) => {
            const accidental = document.getElementById('progression-key-accidental').value;
            this.progressionKey = e.target.value + accidental;
        });

        document.getElementById('progression-key-accidental').addEventListener('change', (e) => {
            const letter = document.getElementById('progression-key-letter').value;
            this.progressionKey = letter + e.target.value;
        });

        document.getElementById('progression-quality').addEventListener('change', (e) => {
            this.progressionQuality = e.target.value;
        });

        // Progression toggle for leading notes
        document.getElementById('show-leading-notes').addEventListener('change', (e) => {
            this.showLeadingNotes = e.target.checked;
            if (this.currentMode === 'progression') {
                this.renderProgressionDisplay();
            }
        });

        // Progression selector dropdown
        const progressionSelect = document.getElementById('progression-select');
        progressionSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const progression = selectedOption.value;

            if (!progression) return; // Skip if "Select a progression..." is chosen

            const quality = selectedOption.dataset.quality;
            const use7ths = selectedOption.dataset.use7ths === 'true';

            // Update the quality selector to match the progression
            if (quality) {
                document.getElementById('progression-quality').value = quality;
                this.progressionQuality = quality;
            }

            this.loadProgression(progression, use7ths);
        });

        // Progression playback controls in toolbar
        const progressionToggleGroup = document.getElementById('progression-mode-toggle');
        const playProgressionBtn = document.getElementById('play-progression-btn');

        // Toggle buttons logic
        progressionToggleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                progressionToggleGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        playProgressionBtn.addEventListener('click', (e) => {
            const activeBtn = progressionToggleGroup.querySelector('.toggle-btn.active');
            const mode = activeBtn ? activeBtn.dataset.mode : 'strum';
            this.playProgression(mode);
        });

        // Export to PDF button - now shows orientation selector
        document.getElementById('export-pdf-btn').addEventListener('click', () => {
            const orientationGroup = document.getElementById('pdf-orientation-group');
            const exportBtn = document.getElementById('export-pdf-btn');
            const confirmBtn = document.getElementById('confirm-pdf-btn');

            orientationGroup.style.display = 'flex';
            exportBtn.style.display = 'none';
            confirmBtn.style.display = 'inline-block';
            
            document.getElementById('pdf-orientation').focus();
        });

        // Confirm PDF Export button
        document.getElementById('confirm-pdf-btn').addEventListener('click', () => {
            const orientationGroup = document.getElementById('pdf-orientation-group');
            const exportBtn = document.getElementById('export-pdf-btn');
            const confirmBtn = document.getElementById('confirm-pdf-btn');

            this.exportToPDF();

            // Reset UI
            orientationGroup.style.display = 'none';
            confirmBtn.style.display = 'none';
            exportBtn.style.display = 'inline-block';
        });

        // Theme Menu Logic
        const themeBtn = document.getElementById('theme-btn');
        const themeMenu = document.getElementById('theme-menu');

        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeMenu.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.theme-wrapper')) {
                themeMenu.classList.remove('visible');
            }
        });

        themeMenu.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.setTheme(theme);
                themeMenu.classList.remove('visible');
            });
        });
    },

    /**
     * Switch between modes
     */
    switchMode(mode) {
        this.currentMode = mode;

        // Update button states
        document.getElementById('fretboard-mode-btn').classList.toggle('active', mode === 'fretboard');
        document.getElementById('progression-mode-btn').classList.toggle('active', mode === 'progression');

        // Update page visibility
        document.getElementById('fretboard-page').classList.toggle('active', mode === 'fretboard');
        document.getElementById('progression-page').classList.toggle('active', mode === 'progression');

        // Show/hide controls based on mode
        const isProgressionMode = mode === 'progression';
        document.getElementById('num-chords-group').style.display = mode === 'fretboard' ? 'flex' : 'none';
        document.getElementById('progression-key-group').style.display = isProgressionMode ? 'flex' : 'none';
        document.getElementById('progression-quality-group').style.display = isProgressionMode ? 'flex' : 'none';
        document.getElementById('show-leading-notes-group').style.display = isProgressionMode ? 'flex' : 'none';
        document.getElementById('progression-select-group').style.display = isProgressionMode ? 'flex' : 'none';

        // Load first progression when entering progression mode
        if (isProgressionMode) {
            const progressionSelect = document.getElementById('progression-select');
            const hasProgression = this.chords.length > 0 && this.chords[0].progressionName;

            // Only auto-load if no progression is currently loaded
            if (!hasProgression && progressionSelect.options.length > 1) {
                // Select the first real progression (index 1, skipping "Select a progression...")
                progressionSelect.selectedIndex = 1;
                const firstOption = progressionSelect.options[1];
                const progression = firstOption.value;
                const quality = firstOption.dataset.quality;
                const use7ths = firstOption.dataset.use7ths === 'true';

                // Update quality selector
                if (quality) {
                    document.getElementById('progression-quality').value = quality;
                    this.progressionQuality = quality;
                }

                this.loadProgression(progression, use7ths);
            } else if (hasProgression) {
                // If a progression is already loaded, just render it
                this.renderProgressionDisplay();
            }
        } else {
            this.renderFretboards();
        }

        // Update padding after controls visibility changes (affects menu height)
        setTimeout(() => this.updatePadding(), 0);
    },

    /**
     * Update padding based on menu bar height
     */
    updatePadding() {
        const topBar = document.querySelector('.top-bar');
        if (!topBar) return;

        // Get the actual height of the top bar
        const topBarHeight = topBar.offsetHeight;
        const paddingValue = topBarHeight + 20;

        // Set CSS variable for padding
        document.documentElement.style.setProperty('--topbar-offset', `${paddingValue}px`);
    },

    /**
     * Load a progression
     */
    loadProgression(progressionString, use7ths = false) {
        const chords = Progressions.parseProgression(progressionString, this.progressionKey, this.progressionQuality, use7ths);
        // Mark each chord with the progression name so we know a progression was loaded
        chords.forEach(chord => chord.progressionName = progressionString);
        this.chords = chords;
        this.numChords = chords.length;
        this.renderProgressionDisplay();
    },

    /**
     * Render progression display
     */
    renderProgressionDisplay() {
        const container = document.getElementById('progression-display');
        container.innerHTML = '';

        // Check if we have a valid progression loaded (not just default chords)
        const hasProgression = this.chords.length > 0 && this.chords[0].progressionName;

        if (!hasProgression) {
            // Show placeholder with empty fretboard background
            const placeholder = document.createElement('div');
            placeholder.className = 'progression-placeholder';
            placeholder.innerHTML = `
                <div class="placeholder-fretboard"></div>
                <div class="placeholder-content">
                    <div class="placeholder-arrow">↑</div>
                    <h2>Select a Chord Progression</h2>
                    <p>Choose a progression from the dropdown above</p>
                </div>
            `;
            container.appendChild(placeholder);
            return;
        }

        for (let i = 0; i < this.numChords; i++) {
            const chordSection = this.createProgressionChordSection(i);
            container.appendChild(chordSection);
        }

        // Render fretboards after DOM is ready
        setTimeout(() => {
            for (let i = 0; i < this.numChords; i++) {
                const chord = this.chords[i];
                const nextChordRoot = i < this.numChords - 1 
                    ? this.chords[i + 1].root 
                    : (this.numChords > 0 ? this.chords[0].root : null);
                Fretboard.renderFretboard(
                    `prog-fretboard-${i}`,
                    chord.root,
                    chord.type,
                    chord.mode,
                    nextChordRoot,
                    this.showLeadingNotes,  // Use toggle value
                    this.showScaleNotes,    // Use toggle value
                    chord.visiblePositions, // Filter set
                    chord.isFiltering,      // Filter mode active?
                    (s, f) => this.handleNoteClick(i, s, f) // Click handler
                );

                // Add controls to header
                const fretboardContainer = document.getElementById(`prog-fretboard-${i}`);
                if (fretboardContainer) {
                    const section = fretboardContainer.closest('.chord-section');
                    const header = section.querySelector('.chord-header');
                    
                    const tools = document.createElement('div');
                    tools.className = 'chord-tools';
                    
                    tools.appendChild(this.createFilterControls(i));
                    tools.appendChild(this.createPlaybackControls(i, 'prog'));
                    
                    if (header) header.appendChild(tools);
                }
            }
        }, 10);
    },

    /**
     * Create a chord section for progression mode (no controls)
     */
    createProgressionChordSection(index) {
        const section = document.createElement('div');
        section.className = 'chord-section';
        section.dataset.index = index;

        // Create header for label and controls
        const header = document.createElement('div');
        header.className = 'chord-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '10px';

        // Create label showing chord numeral and name
        const label = document.createElement('div');
        label.className = 'chord-label';
        const chord = this.chords[index];
        label.textContent = `${chord.numeral || index + 1} - ${chord.root} ${this.getChordTypeName(chord.type)} (${this.getModeName(chord.mode)})`;
        section.appendChild(label);
        header.appendChild(label);
        section.appendChild(header);

        // Create fretboard container
        const fretboardContainer = document.createElement('div');
        fretboardContainer.id = `prog-fretboard-${index}`;
        fretboardContainer.className = 'fretboard-container';
        section.appendChild(fretboardContainer);

        // Playback controls will be added after fretboard is rendered
        return section;
    },

    /**
     * Render fretboards for fretboard mode
     */
    renderFretboards() {
        const container = document.getElementById('fretboard-container');
        container.innerHTML = '';

        for (let i = 0; i < this.numChords; i++) {
            const chordSection = this.createChordSection(i);
            container.appendChild(chordSection);
        }
    },

    /**
     * Create a chord section with controls
     */
    createChordSection(index) {
        const section = document.createElement('div');
        section.className = 'chord-section';
        section.dataset.index = index;

        // Create controls
        const controls = document.createElement('div');
        controls.className = 'chord-controls';

        // Chord name label
        const label = document.createElement('div');
        label.className = 'chord-label';
        label.id = `chord-label-${index}`;
        label.textContent = this.formatChordName(this.chords[index]);
        controls.appendChild(label);

        // Root note letter selector
        const currentRoot = this.chords[index].root;
        const rootLetter = currentRoot.replace('#', '');
        const rootAccidental = currentRoot.includes('#') ? '#' : '';

        const rootLetterGroup = this.createSelect(
            `root-letter-${index}`,
            'Root:',
            [
                { value: 'C', label: 'C' },
                { value: 'D', label: 'D' },
                { value: 'E', label: 'E' },
                { value: 'F', label: 'F' },
                { value: 'G', label: 'G' },
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' }
            ],
            rootLetter,
            (e) => {
                const accidental = document.getElementById(`root-accidental-${index}`).value;
                this.chords[index].root = e.target.value + accidental;
                this.resetFilter(index);
                this.updateChordLabel(index);
                this.updateFretboard(index);
            }
        );
        controls.appendChild(rootLetterGroup);

        // Root accidental selector
        const rootAccidentalGroup = this.createSelect(
            `root-accidental-${index}`,
            '',
            [
                { value: '', label: '♮' },
                { value: '#', label: '♯' },
                { value: 'b', label: '♭' }
            ],
            rootAccidental,
            (e) => {
                const letter = document.getElementById(`root-letter-${index}`).value;
                this.chords[index].root = letter + e.target.value;
                this.resetFilter(index);
                this.updateChordLabel(index);
                this.updateFretboard(index);
            }
        );
        rootAccidentalGroup.classList.add('compact-group');
        controls.appendChild(rootAccidentalGroup);

        // Chord type selector
        const chordGroup = this.createSelect(
            `chord-type-${index}`,
            'Type:',
            [
                { value: 'major', label: 'Major' },
                { value: 'minor', label: 'Minor' },
                { value: 'dominant7', label: 'Dom 7' },
                { value: 'major7', label: 'Maj 7' },
                { value: 'minor7', label: 'Min 7' },
                { value: 'diminished', label: 'Dim' },
                { value: 'augmented', label: 'Aug' }
            ],
            this.chords[index].type,
            (e) => {
                this.chords[index].type = e.target.value;
                this.resetFilter(index);
                this.updateChordLabel(index);
                this.updateModeOptions(index);
                this.updateFretboard(index);
            }
        );
        controls.appendChild(chordGroup);

        // Mode selector
        const modeGroup = document.createElement('div');
        modeGroup.className = 'input-group';
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Mode:';
        modeLabel.htmlFor = `mode-type-${index}`;
        const modeSelect = document.createElement('select');
        modeSelect.id = `mode-type-${index}`;
        modeSelect.addEventListener('change', (e) => {
            this.chords[index].mode = e.target.value;
            this.resetFilter(index);
            this.updateFretboard(index);
        });
        modeGroup.appendChild(modeLabel);
        modeGroup.appendChild(modeSelect);
        controls.appendChild(modeGroup);

        // Create tools wrapper for right alignment
        const tools = document.createElement('div');
        tools.className = 'chord-tools';
        tools.appendChild(this.createFilterControls(index));
        tools.appendChild(this.createPlaybackControls(index, 'fretboard'));
        controls.appendChild(tools);

        section.appendChild(controls);

        // Create fretboard container
        const fretboardContainer = document.createElement('div');
        fretboardContainer.id = `fretboard-${index}`;
        fretboardContainer.className = 'fretboard-container';
        section.appendChild(fretboardContainer);

        // Populate mode options and render
        setTimeout(() => {
            this.updateModeOptions(index);
            this.updateFretboard(index);
        }, 0);

        return section;
    },

    /**
     * Create filter controls (Filter / Done / Clear)
     */
    createFilterControls(index) {
        const container = document.createElement('div');
        container.className = 'filter-controls';
        
        const chord = this.chords[index];
        const isFiltering = chord.isFiltering;

        if (!isFiltering) {
            const filterBtn = document.createElement('button');
            filterBtn.className = 'filter-btn';
            filterBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4c2.01 2.59 7 9 7 9v7h4v-7s4.98-6.41 7-9H3z"/></svg> Filter';
            filterBtn.title = "Select specific notes to keep";
            filterBtn.onclick = () => this.toggleFilterMode(index);
            container.appendChild(filterBtn);
        } else {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'filter-btn active';
            doneBtn.innerHTML = '<span>✓</span> Done';
            doneBtn.onclick = () => this.toggleFilterMode(index);
            
            const playBtn = document.createElement('button');
            playBtn.className = 'filter-btn';
            playBtn.innerHTML = '<span>▶</span>';
            playBtn.title = "Preview Selection";
            playBtn.onclick = (e) => {
                e.stopPropagation();
                this.playChord(this.chords[index], 'harmony');
            };

            const clearBtn = document.createElement('button');
            clearBtn.className = 'filter-btn secondary';
            clearBtn.innerHTML = 'None';
            clearBtn.onclick = () => {
                this.chords[index].visiblePositions = new Set();
                this.updateFretboard(index);
            };

            const resetBtn = document.createElement('button');
            resetBtn.className = 'filter-btn secondary';
            resetBtn.innerHTML = 'All';
            resetBtn.onclick = () => {
                this.chords[index].visiblePositions = null; // Null means "show all"
                // We need to re-initialize the set with all valid notes for the UI
                this.initializeFilterSet(index);
                this.updateFretboard(index);
            };

            container.appendChild(playBtn);
            container.appendChild(doneBtn);
            container.appendChild(resetBtn);
            container.appendChild(clearBtn);
        }

        return container;
    },

    /**
     * Reset filter for a chord (used when parameters change)
     */
    resetFilter(index) {
        const chord = this.chords[index];
        if (chord.visiblePositions || chord.isFiltering) {
            chord.visiblePositions = null;
            chord.isFiltering = false;

            // Update Filter UI Controls
            const section = document.querySelector(`.chord-section[data-index="${index}"]`);
            const oldFilter = section ? section.querySelector('.filter-controls') : null;
            if (oldFilter) {
                oldFilter.replaceWith(this.createFilterControls(index));
            }
        }
    },

    /**
     * Toggle filter mode for a chord
     */
    toggleFilterMode(index) {
        const chord = this.chords[index];
        chord.isFiltering = !chord.isFiltering;

        // If entering filter mode and no filter exists, initialize it with EMPTY set (user selects to keep)
        if (chord.isFiltering && !chord.visiblePositions) {
            chord.visiblePositions = new Set();
        }

        // Re-render the specific section to update controls and fretboard
        if (this.currentMode === 'fretboard') {
            const section = document.querySelector(`.chord-section[data-index="${index}"]`);
            const oldFilter = section ? section.querySelector('.filter-controls') : null;
            if (oldFilter) {
                oldFilter.replaceWith(this.createFilterControls(index));
            }
            this.updateFretboard(index);
        } else {
            // In progression mode, re-render the whole display is safest/easiest
            this.renderProgressionDisplay();
        }
    },

    /**
     * Initialize the filter set with all currently valid notes
     */
    initializeFilterSet(index) {
        const chord = this.chords[index];
        const visibleSet = new Set();
        
        // We need to simulate the logic in Fretboard.updateFretboard to know what's valid
        // This is a bit redundant but necessary to populate the initial state correctly
        const chordNotes = MusicTheory.getChordNotes(chord.root, chord.type);
        const scaleNotes = MusicTheory.getScaleNotes(chord.root, chord.mode);
        
        let nextChordRoot = null;
        if (this.currentMode === 'progression') {
            nextChordRoot = index < this.chords.length - 1 ? this.chords[index + 1].root : this.chords[0].root;
        }

        for (let s = 0; s < Fretboard.tuning.length; s++) {
            for (let f = 0; f <= Fretboard.numFrets; f++) {
                const note = Fretboard.getNoteAtPosition(s, f);
                
                const isChordTone = chordNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const isScaleNote = scaleNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const leadingNote = this.showLeadingNotes && nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                const isLeadingNote = leadingNote && MusicTheory.areNotesEqual(note, leadingNote);
                
                const shouldShowScaleNote = this.showScaleNotes && isScaleNote && !isChordTone;

                if (isChordTone || shouldShowScaleNote || isLeadingNote) {
                    visibleSet.add(`${s}-${f}`);
                }
            }
        }
        chord.visiblePositions = visibleSet;
    },

    /**
     * Handle clicking a note on the fretboard.
     * Plays the note's sound and handles filter selection if in filter mode.
     */
    handleNoteClick(index, string, fret) {
        const chord = this.chords[index];

        // --- Play the clicked note ---
        const midiNote = MIDIPlayer.getMidiNoteAtPosition(string, fret, this.currentInstrument);
        if (midiNote !== null) {
            const toneNote = MIDIPlayer.midiToToneNote(midiNote);
            // Use a shorter duration for single note clicks
            MIDIPlayer.playSingleNote(toneNote, this.currentInstrument, 0.8);
        }
        // --- End note playback ---

        // If not in filter mode, we're done.
        if (!chord.isFiltering) return;

        // --- Handle filter logic ---
        const posKey = `${string}-${fret}`;
        
        // Ensure set exists
        if (!chord.visiblePositions) {
            // This shouldn't happen if toggleFilterMode is used correctly, but as a safeguard.
            chord.visiblePositions = new Set();
        }

        if (chord.visiblePositions.has(posKey)) {
            chord.visiblePositions.delete(posKey);
        } else {
            chord.visiblePositions.add(posKey);
        }

        // Re-render the fretboard to show the change in selection
        if (this.currentMode === 'fretboard') {
            this.updateFretboard(index);
        } else {
            // In progression mode, a full re-render of the display is needed
            // to correctly update the single fretboard among many.
            this.renderProgressionDisplay();
        }
    },

    /**
     * Update mode options for a specific chord
     */
    updateModeOptions(chordIndex) {
        const modeSelect = document.getElementById(`mode-type-${chordIndex}`);
        if (!modeSelect) return;

        const chordType = this.chords[chordIndex].type;
        const options = MusicTheory.modeOptions[chordType];

        modeSelect.innerHTML = '';

        options.forEach((option, index) => {
            const optElement = document.createElement('option');
            optElement.value = option.value;
            optElement.textContent = option.label;

            if (option.value === this.chords[chordIndex].mode ||
                (index === 0 && !this.chords[chordIndex].mode)) {
                optElement.selected = true;
                if (!this.chords[chordIndex].mode) {
                    this.chords[chordIndex].mode = option.value;
                }
            }

            modeSelect.appendChild(optElement);
        });
    },

    /**
     * Create playback controls (button + flyout)
     */
    createPlaybackControls(index, mode) {
        const container = document.createElement('div');
        container.className = 'playback-container playback-controls-compact';
        
        // Default mode
        let currentMode = 'strum';

        // Toggle Container
        const toggleGroup = document.createElement('div');
        toggleGroup.className = 'playback-toggle-group';

        const modes = [
            { id: 'harmony', label: 'unis', title: 'Harmony' },
            { id: 'strum', label: 'strum', title: 'Strum' },
            { id: 'arpeggio', label: 'arp', title: 'Arpeggio' }
        ];

        modes.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `toggle-btn ${m.id === currentMode ? 'active' : ''}`;
            btn.innerHTML = m.label;
            btn.title = m.title;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Update UI
                toggleGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = m.id;
            });
            toggleGroup.appendChild(btn);
        });

        // Play Button
        const playBtn = document.createElement('button');
        playBtn.className = 'compact-play-btn';
        playBtn.innerHTML = '▶';
        playBtn.title = 'Play';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.chords[index]) {
                const chord = this.chords[index];
                this.playChord(chord, currentMode);
            }
        });

        container.appendChild(toggleGroup);
        container.appendChild(playBtn);

        return container;
    },

    /**
     * Play a chord using MIDI
     */
    async playChord(chord, playbackMode) {
        console.log('App.playChord called with:', chord, playbackMode);
        const instrument = this.currentInstrument;
        console.log('Current instrument:', instrument);

        try {
            if (playbackMode === 'harmony') {
                await MIDIPlayer.playChordHarmony(chord, instrument);
            } else if (playbackMode === 'strum') {
                await MIDIPlayer.playChordStrum(chord, instrument);
            } else if (playbackMode === 'arpeggio') {
                await MIDIPlayer.playChordArpeggio(chord, instrument);
            }
        } catch (error) {
            console.error('Error in playChord:', error);
        }
    },

    /**
     * Play entire progression
     */
    async playProgression(playbackMode) {
        console.log('App.playProgression called with:', playbackMode);
        const instrument = this.currentInstrument;
        console.log('Current instrument:', instrument, 'Chords:', this.chords);

        try {
            await MIDIPlayer.playProgression(this.chords, instrument, playbackMode, 2.0);
        } catch (error) {
            console.error('Error in playProgression:', error);
        }
    },

    /**
     * Helper to create a select input group
     */
    createSelect(id, labelText, options, selectedValue, onChange) {
        const group = document.createElement('div');
        group.className = 'input-group';

        const label = document.createElement('label');
        label.textContent = labelText;
        label.htmlFor = id;

        const select = document.createElement('select');
        select.id = id;

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', onChange);

        group.appendChild(label);
        group.appendChild(select);

        return group;
    },

    /**
     * Update a specific fretboard
     */
    updateFretboard(index) {
        const chord = this.chords[index];
        const containerId = `fretboard-${index}`;
        const container = document.getElementById(containerId);

        if (!container) return;

        Fretboard.renderFretboard(
            containerId,
            chord.root,
            chord.type,
            chord.mode,
            null,  // nextChordRoot (not used in chord select)
            false, // showLeadingNotes (not used in chord select)
            this.showScaleNotes,  // Use toggle value
            chord.visiblePositions,
            chord.isFiltering,
            (s, f) => this.handleNoteClick(index, s, f)
        );
    },

    /**
     * Get chord type display name
     */
    getChordTypeName(type) {
        const names = {
            major: 'Major',
            minor: 'Minor',
            dominant7: 'Dom7',
            major7: 'Maj7',
            minor7: 'Min7',
            diminished: 'Dim',
            augmented: 'Aug'
        };
        return names[type] || type;
    },

    /**
     * Get mode display name
     */
    getModeName(mode) {
        const names = {
            ionian: 'Ionian',
            dorian: 'Dorian',
            phrygian: 'Phrygian',
            lydian: 'Lydian',
            mixolydian: 'Mixolydian',
            aeolian: 'Aeolian',
            locrian: 'Locrian',
            lydianDominant: 'Lydian Dominant',
            altered: 'Altered',
            wholeHalfDiminished: 'Whole-Half Dim',
            wholeTone: 'Whole Tone',
            lydianAugmented: 'Lydian Augmented'
        };
        return names[mode] || mode;
    },

    /**
     * Format chord name with accidentals (e.g., "C# Maj7", "B♭ Minor")
     */
    formatChordName(chord) {
        // Format root note with proper accidental symbols
        let rootDisplay = chord.root.replace('#', '♯').replace('b', '♭');

        // Get type name
        const typeName = this.getChordTypeName(chord.type);

        return `${rootDisplay} ${typeName}`;
    },

    /**
     * Update chord label display
     */
    updateChordLabel(index) {
        const label = document.getElementById(`chord-label-${index}`);
        if (label) {
            const chord = this.chords[index];
            label.textContent = this.formatChordName(chord);
        }
    },

    /**
     * Draw a fretboard on canvas for PDF export
     */
    drawFretboardOnCanvas(canvas, chord, chordLabel, nextChordRoot, maxFrets) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw label (indented)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';  // Reset text alignment to left
        ctx.textBaseline = 'top';  // Reset baseline
        ctx.fillText(chordLabel, 50, 30);  // Moved up 10px (from 40 to 30)

        const fretboardTop = 80;  // Spacing maintained for breathing room
        const fretboardHeight = height - 160;  // Leave more room for fret numbers (60px instead of 40px)
        const fretboardWidth = width - 100;
        const numStrings = Fretboard.tuning.length;
        const numFrets = maxFrets;  // Use the passed-in max frets
        const stringSpacing = fretboardHeight / (numStrings - 1);
        const fretSpacing = fretboardWidth / numFrets;

        // Draw strings (horizontal lines)
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        for (let i = 0; i < numStrings; i++) {
            const y = fretboardTop + i * stringSpacing;
            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(50 + fretboardWidth, y);
            ctx.stroke();
        }

        // Draw frets (vertical lines)
        ctx.strokeStyle = '#8B7355';
        for (let i = 0; i <= numFrets; i++) {
            const x = 50 + i * fretSpacing;
            ctx.lineWidth = i === 0 ? 6 : 2; // Wider nut
            ctx.beginPath();
            ctx.moveTo(x, fretboardTop);
            ctx.lineTo(x, fretboardTop + fretboardHeight);
            ctx.stroke();
        }

        // Draw fret numbers (lower and 25% larger)
        ctx.fillStyle = '#000000';
        ctx.font = '15px Arial'; // 25% larger than 12px
        ctx.textAlign = 'center';
        for (let i = 1; i <= numFrets; i++) {
            const x = 50 + i * fretSpacing - fretSpacing / 2;
            ctx.fillText(i.toString(), x, fretboardTop + fretboardHeight + 30); // Lower position
        }

        // Get chord and scale notes
        const chordNotes = MusicTheory.getChordNotes(chord.root, chord.type);
        const scaleNotes = MusicTheory.getScaleNotes(chord.root, chord.mode);

        // Draw note markers
        for (let stringIndex = 0; stringIndex < numStrings; stringIndex++) {
            for (let fret = 0; fret <= numFrets; fret++) {
                const note = Fretboard.getNoteAtPosition(stringIndex, fret);
                
                // Check Filter
                const posKey = `${stringIndex}-${fret}`;
                if (chord.visiblePositions && !chord.visiblePositions.has(posKey)) continue;

                const isChordTone = chordNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const isScaleNote = scaleNotes.some(n => MusicTheory.areNotesEqual(note, n));
                const isRoot = MusicTheory.areNotesEqual(note, chord.root);
                // Leading note is a half step below the next chord's root
                const leadingNote = nextChordRoot ? MusicTheory.transposeNote(nextChordRoot, -1) : null;
                const isLeadingNote = leadingNote && MusicTheory.areNotesEqual(note, leadingNote);

                if (isChordTone || isScaleNote || isLeadingNote) {
                    const x = 50 + (fret === 0 ? 0 : fret * fretSpacing - fretSpacing / 2);
                    const y = fretboardTop + stringIndex * stringSpacing;
                    const size = 14;

                    // Determine shape and colors
                    let fillColor, strokeColor, lineWidth, shape, textColor;

                    if (isRoot) {
                        fillColor = '#000000';  // Black for root
                        strokeColor = '#FFFFFF';  // White outline
                        textColor = '#FFFFFF';  // White text
                        lineWidth = 3;
                        shape = 'square';
                    } else if (isLeadingNote) {
                        // All leading notes use triangle
                        fillColor = '#999999';  // Medium gray
                        strokeColor = '#999999';
                        textColor = '#000000';  // Black text
                        lineWidth = 0;
                        shape = 'triangle';
                    } else if (isChordTone) {
                        fillColor = '#CCCCCC';  // Light gray for chord tones
                        strokeColor = '#CCCCCC';
                        textColor = '#000000';  // Black text
                        lineWidth = 2;
                        shape = 'square';
                    } else {
                        fillColor = '#FFFFFF';  // White for scale notes
                        strokeColor = '#000000';  // Black outline
                        textColor = '#000000';  // Black text
                        lineWidth = 2;
                        shape = 'circle';
                    }

                    ctx.beginPath();

                    // Draw shape
                    if (shape === 'square') {
                        ctx.rect(x - size, y - size, size * 2, size * 2);
                    } else if (shape === 'circle') {
                        ctx.arc(x, y, size, 0, 2 * Math.PI);
                    } else if (shape === 'triangle') {
                        // Right-pointing triangle (shifted right)
                        const shift = size * 0.3;
                        ctx.moveTo(x - size + shift, y - size);
                        ctx.lineTo(x - size + shift, y + size);
                        ctx.lineTo(x + size * 1.2, y);
                        ctx.closePath();
                    }

                    ctx.fillStyle = fillColor;
                    ctx.fill();
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();

                    // Draw text
                    ctx.fillStyle = textColor;
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let label;
                    if (isRoot) {
                        label = 'R';
                    } else if (isLeadingNote) {
                        label = 'L';
                    } else if (isChordTone) {
                        label = MusicTheory.getChordIntervalLabel(chord.root, note, chord.type);
                    } else {
                        label = MusicTheory.getScaleDegreeLabel(chord.root, note, chord.mode);
                    }
                    ctx.fillText(label, x, y);
                }
            }
        }
    },

    /**
     * Export current fretboards to PDF
     */
    async exportToPDF() {
        const { jsPDF } = window.jspdf;
        const orientation = this.pdfOrientation === 'landscape' ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'mm', 'a4');

        if (this.chords.length === 0) {
            alert('No fretboards to export');
            return;
        }

        // Determine max frets based on orientation and current fret count
        // Portrait: max 12 frets, Landscape: max 20 frets (but respect user's selection if lower)
        const maxFretsForOrientation = this.pdfOrientation === 'landscape' ? 20 : 12;
        const maxFrets = Math.min(Fretboard.numFrets, maxFretsForOrientation);

        // Create a hidden canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 450;  // Increased from 400 to give room for fret numbers

        let yPosition = 20;
        const pageHeight = this.pdfOrientation === 'landscape' ? 210 : 297;
        const sectionHeight = 70;

        for (let i = 0; i < this.chords.length; i++) {
            const chord = this.chords[i];
            // Only pass nextChordRoot in progression mode (to show leading notes)
            const nextChordRoot = this.currentMode === 'progression'
                ? (i < this.chords.length - 1 ? this.chords[i + 1].root : this.chords[0].root)
                : null;

            // Create chord label
            const chordLabel = this.currentMode === 'progression' && chord.numeral
                ? `${chord.numeral} - ${chord.root} ${this.getChordTypeName(chord.type)} (${this.getModeName(chord.mode)})`
                : `Chord ${i + 1} - ${chord.root} ${this.getChordTypeName(chord.type)} (${this.getModeName(chord.mode)})`;

            // Calculate image dimensions
            const imgWidth = 170;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Check if we need a new page BEFORE drawing
            if (i > 0 && yPosition + imgHeight > pageHeight - 20) {
                pdf.addPage();
                yPosition = 20;
            }

            // Draw fretboard on canvas
            this.drawFretboardOnCanvas(canvas, chord, chordLabel, nextChordRoot, maxFrets);

            // Add canvas to PDF
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 20, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
        }

        // Generate filename
        let filename;
        if (this.currentMode === 'fretboard') {
            // Chord Select mode: use chord abbreviations (e.g., "C-Am-F-G.pdf")
            const chordAbbrs = this.chords.map(chord => {
                const root = chord.root.replace('#', 's'); // Replace # with s for filenames
                const type = this.getChordTypeAbbr(chord.type);
                return root + type;
            });
            filename = chordAbbrs.join('-') + '.pdf';
        } else {
            // Progression mode: use key and progression pattern (e.g., "C-major-I-V-vi-IV.pdf")
            const key = this.progressionKey.replace('#', 's');
            const quality = this.progressionQuality;
            const numerals = this.chords.map(c => c.numeral).join('-');
            filename = `${key}-${quality}-${numerals}.pdf`;
        }

        pdf.save(filename);
    },

    /**
     * Get chord type abbreviation for filename
     */
    getChordTypeAbbr(type) {
        const abbrs = {
            major: '',
            minor: 'm',
            dominant7: '7',
            major7: 'maj7',
            minor7: 'm7',
            diminished: 'dim',
            augmented: 'aug'
        };
        return abbrs[type] || '';
    },

    /**
     * Set the application theme
     */
    setTheme(themeName) {
        this.currentTheme = themeName;
        document.body.className = ''; // Clear existing classes
        if (themeName !== 'default') {
            document.body.classList.add(themeName);
        }
        
        // Update active state in menu
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });

        this.saveSettings();
        this.updateFavicon();
    },

    /**
     * Save user settings to localStorage
     */
    saveSettings() {
        const settings = {
            instrument: this.currentInstrument,
            guitarTuning: Fretboard.currentGuitarTuning,
            theme: this.currentTheme
        };
        localStorage.setItem('fretforge_settings', JSON.stringify(settings));
    },

    /**
     * Load user settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('fretforge_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                
                // Apply Theme
                if (settings.theme) {
                    this.setTheme(settings.theme);
                }

                // Apply Instrument
                if (settings.instrument) {
                    this.currentInstrument = settings.instrument;
                    document.getElementById('instrument').value = settings.instrument;
                    Fretboard.setInstrument(settings.instrument);
                }

                // Apply Tuning
                if (settings.guitarTuning) {
                    Fretboard.setGuitarTuning(settings.guitarTuning);
                    document.getElementById('guitar-tuning').value = settings.guitarTuning;
                }
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    },

    /**
     * Update favicon to match current theme color
     */
    async updateFavicon() {
        try {
            // Get current logo color from CSS variable
            const computedStyle = getComputedStyle(document.body);
            let color = computedStyle.getPropertyValue('--logo-color').trim();
            
            // Fallback if empty
            if (!color) color = '#f4a460';

            // Fetch SVG if not cached
            if (!this.logoSvgContent) {
                const response = await fetch('logo.svg');
                if (!response.ok) return;
                this.logoSvgContent = await response.text();
            }

            // Inject fill color
            let newSvg = this.logoSvgContent;
            if (newSvg.includes('fill=')) {
                newSvg = newSvg.replace(/fill="[^"]*"/, `fill="${color}"`);
            } else {
                newSvg = newSvg.replace('<svg', `<svg fill="${color}"`);
            }

            // Update link tag
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = `data:image/svg+xml,${encodeURIComponent(newSvg)}`;

        } catch (e) {
            console.warn('Could not update favicon:', e);
        }
    }
};

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
