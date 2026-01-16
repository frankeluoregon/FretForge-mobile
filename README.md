# FretForge

An interactive fretboard visualization tool for guitar and bass, featuring chord progressions with 7th chords and intelligent leading note detection.

## Features

- **Two Modes**:
  - **Chord Select**: Build custom chord sequences with individual chord and mode selection
  - **Progression**: Choose from common chord progressions (Jazz ii-V-I, Pop I-V-vi-IV, etc.)

- **7th Chord Support**: All progressions use extended harmonies (Maj7, Min7, Dom7)

- **Leading Note Visualization**: Automatically highlights notes that are a half step below the next chord's root

- **Shape-Based Note Indicators**:
  - **Roots**: Green squares with yellow 'R' and yellow outline
  - **Chord Tones**: Yellow squares with green interval numbers (3, 5, 7)
  - **Scale Notes**: Gray circles with black scale degree numbers
  - **Leading Notes (non-chord)**: Light green triangles with 'L'
  - **Leading Notes (chord tones)**: Yellow house shapes with green interval numbers

- **Multiple Modes Per Chord**: Choose from appropriate modes based on chord type
  - Major: Ionian, Lydian, Mixolydian
  - Minor: Dorian, Aeolian, Phrygian
  - Dominant 7th: Mixolydian, Lydian Dominant, Altered
  - And more...

- **PDF Export**: Generate clean, printable fretboard diagrams with:
  - White background
  - Simple line-based design
  - Wider nut for clear open position indication
  - Larger, lower-positioned fret numbers

- **Dual Instrument Support**: Switch between Guitar (6-string) and Bass (4-string)

## Usage

1. Open [index.html](index.html) in a web browser
2. Select a mode (Chord Select or Progression)
3. Choose your instrument (Guitar or Bass)
4. In Progression mode:
   - Select a key and quality (Major/Minor)
   - Click a progression pattern
5. Export to PDF for practice or reference

## Progressions Available

### Major Key
- I - IV - V (Classic Rock)
- I - V - vi - IV (Pop)
- ii - V - I (Jazz)
- I - vi - ii - V (50s Progression)
- I - iii - IV - V (Doo-Wop)
- vi - IV - I - V (Sensitive)

### Minor Key
- i - VI - III - VII (Minor Pop)
- i - iv - v (Minor Blues)

## Color Scheme

- **Roots**: `#007030` (green) with `#FEE11A` (yellow) text
- **Chord Tones**: `#FEE11A` (yellow) with `#007030` (green) text
- **Scale Notes**: `#BFBFBF` (gray) with black text
- **Leading Notes**: `#7FA925` (light green) with black text
- **Fretboard**: Dark wood aesthetic (`#290e08`)
- **Background**: Black (`#000000`)

## Files

- [index.html](index.html) - Main HTML structure
- [styles.css](styles.css) - Styling and shape definitions
- [app.js](app.js) - Application logic and PDF export
- [fretboard.js](fretboard.js) - Fretboard rendering
- [musicTheory.js](musicTheory.js) - Music theory engine
- [progressions.js](progressions.js) - Progression parsing

## Technical Details

- Pure JavaScript (no framework dependencies)
- Canvas-based PDF generation using jsPDF
- CSS clip-path for shape-based note indicators
- Responsive design with mobile support
- Fixed header with legend

## License

MIT License - feel free to use and modify for your own projects.

## Credits

Built with assistance from Claude Sonnet 4.5.
