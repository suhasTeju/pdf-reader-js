/**
 * Page turn sound effect using Web Audio API.
 * Synthesizes a realistic paper-turning sound without requiring external audio files.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * Play a synthesized page-turn sound effect.
 * Uses filtered noise to simulate the sound of a paper page turning.
 */
export function playPageTurnSound(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  const duration = 0.35;

  // Create noise buffer for the paper rustle
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  // Noise source
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  // Bandpass filter to shape noise into paper-like sound
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(3000, now);
  bandpass.frequency.exponentialRampToValueAtTime(800, now + duration * 0.6);
  bandpass.Q.setValueAtTime(0.8, now);

  // Highpass to remove low rumble
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(400, now);
  highpass.frequency.linearRampToValueAtTime(200, now + duration);

  // Envelope for the rustle
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(volume * 0.6, now + 0.02);
  envelope.gain.setValueAtTime(volume * 0.6, now + 0.05);
  envelope.gain.linearRampToValueAtTime(volume, now + duration * 0.3);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Second noise burst for the "snap" at the end of the turn
  const snapBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
  const snapData = snapBuffer.getChannelData(0);
  for (let i = 0; i < snapData.length; i++) {
    snapData[i] = (Math.random() * 2 - 1);
  }

  const snapSource = ctx.createBufferSource();
  snapSource.buffer = snapBuffer;

  const snapFilter = ctx.createBiquadFilter();
  snapFilter.type = 'bandpass';
  snapFilter.frequency.setValueAtTime(2000, now);
  snapFilter.Q.setValueAtTime(1.5, now);

  const snapEnvelope = ctx.createGain();
  snapEnvelope.gain.setValueAtTime(0, now);
  snapEnvelope.gain.setValueAtTime(0, now + duration * 0.7);
  snapEnvelope.gain.linearRampToValueAtTime(volume * 0.8, now + duration * 0.75);
  snapEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Connect noise chain
  noiseSource.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(envelope);
  envelope.connect(ctx.destination);

  // Connect snap chain
  snapSource.connect(snapFilter);
  snapFilter.connect(snapEnvelope);
  snapEnvelope.connect(ctx.destination);

  // Play
  noiseSource.start(now);
  noiseSource.stop(now + duration);
  snapSource.start(now);
  snapSource.stop(now + duration);
}
