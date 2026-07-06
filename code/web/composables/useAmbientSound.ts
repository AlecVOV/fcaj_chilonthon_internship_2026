// composables/useAmbientSound.ts
//
// Procedural ambient sound via the WebAudio API — no audio asset files needed.
// Each "track" is synthesized from filtered noise so it loops seamlessly and
// ships zero bytes of media. Singleton graph (module-level) so it survives
// component re-renders and only ever plays one ambience at a time.
//
// Tracks: 'rain' | 'cafe' | 'waves' (+ null/'none' = silence).

let ctx: AudioContext | null = null
let graph: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null
let currentTrack: string | null = null

const MASTER = 0.15 // keep ambience gentle, well under the finish-chime level

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  ctx = new Ctx()
  return ctx
}

/** ~4s of looping noise. 'brown' is darker/warmer than 'white'. */
function noiseBuffer(c: AudioContext, type: 'white' | 'brown'): AudioBuffer {
  const len = Math.floor(c.sampleRate * 4)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      data[i] = last * 3.5
    }
  }
  return buf
}

export function useAmbientSound() {
  function stop() {
    if (graph && ctx) {
      const { gain, sources } = graph
      try {
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)
        setTimeout(() => sources.forEach(s => { try { s.stop() } catch { /* already stopped */ } }), 400)
      } catch { /* ignore */ }
    }
    graph = null
    currentTrack = null
  }

  function play(track: string | null | undefined) {
    if (import.meta.server) return
    if (!track || track === 'none') { stop(); return }
    if (track === currentTrack && graph) return // already playing this one
    stop()

    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})

    const gain = c.createGain()
    gain.gain.value = 0.0001
    gain.connect(c.destination)
    const sources: AudioScheduledSourceNode[] = []

    if (track === 'rain') {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 'white'); src.loop = true
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7500
      src.connect(hp); hp.connect(lp); lp.connect(gain); src.start()
      sources.push(src)
    } else if (track === 'cafe') {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 'brown'); src.loop = true
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
      src.connect(lp); lp.connect(gain); src.start()
      sources.push(src)
    } else if (track === 'waves') {
      const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 'brown'); src.loop = true
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
      // slow swell in and out
      const lfo = c.createOscillator(); lfo.frequency.value = 0.09
      const lfoGain = c.createGain(); lfoGain.gain.value = 0.09
      lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start()
      src.connect(lp); lp.connect(gain); src.start()
      sources.push(src, lfo)
    } else {
      // unknown track → nothing
      return
    }

    gain.gain.setTargetAtTime(MASTER, c.currentTime, 0.5)
    graph = { gain, sources }
    currentTrack = track
  }

  return { play, stop }
}
