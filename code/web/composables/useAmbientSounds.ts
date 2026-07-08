// composables/useAmbientSounds.ts
//
// Ambient Sound — hai phần tách bạch:
//
//   Phần 1 (S3 File Management): upload MP3 lên S3 + list file trong bucket.
//     Trình duyệt KHÔNG ghi thẳng S3 được → gọi Lambda (qua API Gateway) để lấy
//     presigned PUT URL rồi PUT file thẳng lên S3; list qua ListObjectsV2.
//     Cần NUXT_PUBLIC_API_GATEWAY_URL + Lambda `ambient-audio-manager` đã deploy.
//
//   Phần 2 (User Display Management): CRUD bảng public.ambient_sounds (Supabase).
//     Chính là danh sách hiển thị ngoài trang Focus cho end-user. Mọi thao tác
//     CRUD ở đây đổi trực tiếp những gì user thấy (cùng một bảng, RLS đọc-all).

import { getSupabase } from '~/lib/supabaseClient'
import { useConfig } from '~/composables/useConfig'

export interface AmbientSound {
  id: string
  name: string
  url: string
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface S3File {
  name: string
  url: string
  size: number
  lastModified: string
}

function rowToSound(r: any): AmbientSound {
  return {
    id: r.id, name: r.name, url: r.url,
    isActive: r.is_active, sortOrder: r.sort_order ?? 0, createdAt: r.created_at,
  }
}

export function useAmbientSounds() {
  const { ambientApiUrl } = useConfig()

  // Gửi Supabase access_token; Lambda tự validate qua PostgREST (API Gateway KHÔNG có authorizer).
  async function authHeaders(): Promise<Record<string, string>> {
    const sb = getSupabase()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  // ── Phần 2: CRUD bảng ambient_sounds ─────────────────────────────────────
  async function listSounds(activeOnly = false): Promise<AmbientSound[]> {
    const sb = getSupabase()
    let q = sb.from('ambient_sounds').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) throw new Error(`Không tải được danh sách nhạc: ${error.message}`)
    return (data || []).map(rowToSound)
  }

  async function createSound(input: { name: string; url: string; sortOrder?: number }): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('ambient_sounds').insert({
      name: input.name, url: input.url, sort_order: input.sortOrder ?? 0,
    })
    if (error) throw new Error(error.message)
  }

  async function updateSound(id: string, changes: Partial<Pick<AmbientSound, 'name' | 'url' | 'isActive' | 'sortOrder'>>): Promise<void> {
    const sb = getSupabase()
    const row: Record<string, unknown> = {}
    if (changes.name !== undefined) row.name = changes.name
    if (changes.url !== undefined) row.url = changes.url
    if (changes.isActive !== undefined) row.is_active = changes.isActive
    if (changes.sortOrder !== undefined) row.sort_order = changes.sortOrder
    const { error } = await sb.from('ambient_sounds').update(row).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async function deleteSound(id: string): Promise<void> {
    const sb = getSupabase()
    const { error } = await sb.from('ambient_sounds').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  // ── Phần 1: S3 file management (qua Lambda) ───────────────────────────────
  function requireApi() {
    if (!ambientApiUrl.value) {
      throw new Error('Chưa cấu hình S3 backend (NUXT_PUBLIC_AMBIENT_API_URL) — chưa upload/list S3 được. Xem aws/lambdas/ambient-audio-manager/README.md.')
    }
  }

  async function listS3Files(): Promise<S3File[]> {
    requireApi()
    const res = await $fetch<{ files: S3File[] }>(`${ambientApiUrl.value}/ambient/files`, {
      method: 'GET', headers: await authHeaders(),
    })
    return res?.files ?? []
  }

  // Upload 1 file: xin presigned PUT URL từ Lambda → PUT thẳng lên S3 (kèm progress).
  // Trả về public URL để admin copy sang Phần 2.
  async function uploadS3File(file: File, onProgress?: (percent: number) => void): Promise<string> {
    requireApi()
    const contentType = file.type || 'audio/mpeg'
    const { uploadUrl, publicUrl } = await $fetch<{ uploadUrl: string; publicUrl: string; key: string }>(
      `${ambientApiUrl.value}/ambient/upload-url`,
      { method: 'POST', headers: await authHeaders(), body: { filename: file.name, contentType } },
    )
    await putToS3(uploadUrl, file, contentType, onProgress)
    return publicUrl
  }

  // PUT nhị phân lên S3 bằng XHR để có progress (ofetch không báo tiến độ upload).
  // Content-Type phải KHỚP lúc ký presigned URL, nếu không S3 báo SignatureDoesNotMatch.
  function putToS3(url: string, file: File, contentType: string, onProgress?: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new Error(`Upload S3 thất bại (HTTP ${xhr.status}). Kiểm tra CORS bucket.`))
      xhr.onerror = () => reject(new Error('Lỗi mạng khi upload S3 (thường do CORS bucket chưa cho phép PUT).'))
      xhr.send(file)
    })
  }

  return {
    // Phần 2
    listSounds, createSound, updateSound, deleteSound,
    // Phần 1
    listS3Files, uploadS3File,
  }
}
