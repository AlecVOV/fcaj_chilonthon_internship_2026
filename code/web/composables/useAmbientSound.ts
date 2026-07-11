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
let intentionalStop = false // true trong lúc stop() đang fade-out chủ động

const MASTER = 0.5   // âm lượng nền tối đa
const STEP = 0.05    // bước fade
const TICK = 40      // ms mỗi bước fade

function clearFade() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
}

// Một số trình duyệt tự pause <audio> khi tab bị ẩn/throttle ở tab nền (không
// phải do code này gọi .pause()) → nhạc im re khi đổi tab. Bắt sự kiện 'pause'
// gốc của phần tử: nếu KHÔNG phải do stop() chủ động gây ra thì play() lại ngay.
function attachAutoResume(a: HTMLAudioElement) {
  a.addEventListener('pause', () => {
    if (!intentionalStop && audio === a) {
      a.play().catch(() => { /* vẫn bị chặn -- sẽ thử lại ở visibilitychange */ })
    }
  })
}

// Lưới an toàn thứ 2: khi quay lại tab, nếu track lẽ ra đang phát mà lại đang
// paused (vì lý do gì đó pause-event ở trên chưa bắt kịp) thì resume luôn.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audio && audio.paused && !intentionalStop) {
      audio.play().catch(() => { /* ignore */ })
    }
  })
}

export function useAmbientSound() {
  function stop() {
    if (import.meta.server) return
    intentionalStop = true
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
    intentionalStop = false

    const a = new Audio(url)
    a.loop = true
    a.volume = 0
    a.preload = 'auto'
    attachAutoResume(a)
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
