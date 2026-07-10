// utils/markdown.ts — render markdown an toàn cho bubble chat (agent trả lời có thể có
// **bold**, danh sách, code block...). Chỉ chạy client-side (DOMPurify cần `window`);
// các route dùng file này (/agent) đã tắt SSR trong nuxt.config.ts.
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(text: string): string {
  const html = marked.parse(text || '', { async: false }) as string
  return DOMPurify.sanitize(html)
}
