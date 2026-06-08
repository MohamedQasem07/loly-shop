import { useRef, useState } from 'react'
import { ImageOff, Loader2, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/ids'

/** Image picker that uploads to the public `product-images` Storage bucket and
 *  returns the public URL. Used for product photos and store branding images. */
export function ImageUpload({ value, onChange, folder = 'products', hint, wide }: {
  value: string
  onChange: (url: string) => void
  folder?: string
  hint?: string
  wide?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  async function onFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { setErr('الصورة كبيرة (أقصى حجم ٥ ميجا)'); return }
    setErr('')
    setUploading(true)
    try {
      const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg'
      const path = `${folder}/${uuid()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type || undefined,
      })
      if (error) throw error
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch {
      setErr('تعذّر رفع الصورة — تأكد إنك متصل بالنت وحاول تاني')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`${wide ? 'w-36 h-24' : 'w-24 h-24'} rounded-2xl bg-blush grid place-items-center overflow-hidden shrink-0 border border-pink/60`}>
        {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageOff className="text-rose/40" size={28} />}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost text-sm py-2">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {value ? 'تغيير الصورة' : 'رفع صورة'}
          </button>
          {value && !uploading && (
            <button type="button" onClick={() => onChange('')} className="btn-ghost text-sm py-2 text-danger border-danger/30">
              <Trash2 size={15} /> إزالة
            </button>
          )}
        </div>
        <input className="input text-sm" dir="ltr" placeholder="أو الصق رابط صورة…" value={value} onChange={(e) => onChange(e.target.value)} />
        {err && <p className="text-danger text-xs font-semibold">{err}</p>}
        <p className="text-[11px] text-cocoa-light">{hint ?? 'JPG / PNG / WebP · حتى ٥ ميجا'}</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      </div>
    </div>
  )
}
