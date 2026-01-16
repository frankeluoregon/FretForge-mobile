javascript
const bassSynth = new Tone.MonoSynth({
  oscillator: {
    type: "triangle" // Use "sawtooth" for more harmonics
  },
  envelope: {
    attack: 0.01,  // Fast attack for the "pluck"
    decay: 0.4,    // Natural decay of a string
    sustain: 0.2,  // Low sustain to mimic a decaying note
    release: 1.2   // Smooth release
  },
  filter: {
    Q: 2,
    type: "lowpass",
    rolloff: -24   // Steep cut to keep it warm and bassy
  },
  filterEnvelope: {
    attack: 0.02,
    decay: 0.4,
    sustain: 0.1,
    baseFrequency: 100, // Starts at a low frequency
    octaves: 3          // Briefly opens the filter for the attack
  }
}).toDestination();

bassSynth.triggerAttackRelease("C2", "4n");