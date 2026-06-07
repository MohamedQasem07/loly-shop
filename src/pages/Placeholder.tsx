import { type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export function Placeholder({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold text-cocoa mb-6">{title}</h1>
      <div className="card p-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-blush grid place-items-center text-rose mb-4">
          {icon ?? <Sparkles size={40} />}
        </div>
        <p className="font-display text-xl font-bold text-cocoa">قريباً ✨</p>
        <p className="text-cocoa-light mt-2 max-w-sm">
          قسم «{title}» تحت التجهيز وهيتفعّل في المرحلة الجاية من بناء النظام.
        </p>
      </div>
    </div>
  )
}
