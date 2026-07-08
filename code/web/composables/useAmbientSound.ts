// composables/useAmbientSound.ts
//
// Phát nhạc nền THẬT (file MP3 host trên S3) trong phiên Focus.
// Trước đây là nhạc synth (WebAudio); giờ danh sách nhạc do Admin quản lý ở
// bảng ambient_sounds nên ở đây ta phát file MP3 từ URL.
//
// API giữ nguyên: play(url) | stop(). `track` giờ là URL của file (hoặc null =
// im lặng). Singleton (module-level) để chỉ 1 track phát tại một thời điểm và
// sống sót qua re-render của component.

let audio: HTMLAudioElement | null = null
let currentUrl: string | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null

const MASTER = 0.5   // âm lượng nền tối đa
const STEP = 0.05    // bước fade
const TICK = 40      // ms mỗi bước fade

function clearFade() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
}

export function useAmbientSound() {
  function stop() {
    if (import.meta.server) return
    clearFade()
    const a = audio
    audio = null
    currentUrl = null
    if (!a) return
    // Fade out rồi mới pause để không bị "cụp" tiếng.
    fadeTimer = setInterval(() => {
      if (a.volume > STEP) {
        a.volume = Math.max(0, a.volume - STEP)
      } else {
        clearFade()
        try { a.pause(); a.src = '' } catch { /* ignore */ }
      }
    }, TICK)
  }

  function play(url: string | null | undefined) {
    if (import.meta.server) return
    if (!url || url === 'none') { stop(); return }
    if (url === currentUrl && audio) return // đang phát đúng track này
    stop()
    clearFade()

    const a = new Audio(url)
    a.loop = true
    a.volume = 0
    a.preload = 'auto'
    // KHÔNG set crossOrigin: phát <audio> thuần không cần CORS; chỉ cần object
    // public-read. (Đặt crossOrigin lại BẮT BUỘC phải có CORS header trên GET.)
    // play() phải nằm trong/ngay sau user gesture (nút "Begin Focus Session").
    a.play().then(() => {
      // Fade in tới MASTER.
      clearFade()
      fadeTimer = setInterval(() => {
        if (!audio) { clearFade(); return }
        if (a.volume < MASTER - STEP) a.volume = Math.min(MASTER, a.volume + STEP)
        else { a.volume = MASTER; clearFade() }
      }, TICK)
    }).catch(() => { /* autoplay bị chặn hoặc URL lỗi — bỏ qua, phiên vẫn chạy */ })

    audio = a
    currentUrl = url
  }

  return { play, stop }
}
