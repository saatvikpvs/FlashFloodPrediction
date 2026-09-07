/**
 * Synthesizes an authoritative emergency alert chime/beep using the native Web Audio API.
 * - Zero external assets or network dependencies.
 * - Works on mobile (iOS Safari / Android Chrome) when triggered inside a click/tap event.
 * - Non-looping, short duration (~1.1 seconds), clearly audible through laptop and phone speakers.
 */

let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    // Safari & mobile requirement: resume suspended context on user interaction
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playAlertSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Pattern: 3 rapid, sharp emergency warning pulses
    // Pulse 1: 880 Hz (A5)
    // Pulse 2: 880 Hz (A5)
    // Pulse 3: 1174.66 Hz (D6 - higher urgency)
    const pulses = [
      { start: 0.0, duration: 0.18, freq: 880 },
      { start: 0.26, duration: 0.18, freq: 880 },
      { start: 0.52, duration: 0.45, freq: 1175 },
    ];

    pulses.forEach(({ start, duration, freq }) => {
      const startTime = now + start;
      const stopTime = startTime + duration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // "sawtooth" waveform gives a distinctive, penetration emergency horn timbre
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and decay to prevent harsh speaker clicks while staying loud
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.setValueAtTime(0.35, stopTime - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(stopTime);
    });
  } catch (err) {
    console.warn("Unable to play Web Audio alert sound:", err);
  }
}
