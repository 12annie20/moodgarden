'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const EMOTIONS = [
  { id: 'joy',          label: '喜悅', emoji: '🌟', bg: 'bg-yellow-400', ring: 'ring-yellow-600', text: 'text-yellow-900' },
  { id: 'trust',        label: '信任', emoji: '🌿', bg: 'bg-green-400',  ring: 'ring-green-600',  text: 'text-green-900'  },
  { id: 'fear',         label: '恐懼', emoji: '😰', bg: 'bg-lime-700',   ring: 'ring-lime-900',   text: 'text-white'      },
  { id: 'surprise',     label: '驚訝', emoji: '✨', bg: 'bg-cyan-400',   ring: 'ring-cyan-600',   text: 'text-cyan-900'   },
  { id: 'sadness',      label: '悲傷', emoji: '💧', bg: 'bg-blue-400',   ring: 'ring-blue-600',   text: 'text-blue-900'   },
  { id: 'disgust',      label: '厭惡', emoji: '🙄', bg: 'bg-purple-400', ring: 'ring-purple-600', text: 'text-purple-900' },
  { id: 'anger',        label: '憤怒', emoji: '🔥', bg: 'bg-red-400',    ring: 'ring-red-600',    text: 'text-red-900'    },
  { id: 'anticipation', label: '期待', emoji: '🌅', bg: 'bg-orange-400', ring: 'ring-orange-600', text: 'text-orange-900' },
] as const

type EmotionId = typeof EMOTIONS[number]['id']

export default function MoodEntryPage() {
  const [emotion, setEmotion]     = useState<EmotionId | null>(null)
  const [intensity, setIntensity] = useState<1 | 2 | 3>(2)
  const [valence, setValence]     = useState(0)
  const [arousal, setArousal]     = useState(0)
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const diskRef = useRef<HTMLDivElement>(null)
  const router  = useRouter()

  function pointFromEvent(clientX: number, clientY: number) {
    const rect = diskRef.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left)  / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top)   / rect.height))
    setValence(parseFloat(((x * 2) - 1).toFixed(2)))
    setArousal(parseFloat(((1 - y * 2)).toFixed(2)))
  }

  function handleDiskClick(e: React.MouseEvent<HTMLDivElement>) {
    pointFromEvent(e.clientX, e.clientY)
  }

  function handleDiskTouch(e: React.TouchEvent<HTMLDivElement>) {
    e.preventDefault()
    pointFromEvent(e.touches[0].clientX, e.touches[0].clientY)
  }

  async function handleSubmit() {
    if (!emotion) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/login'); return }

      // Ensure a row exists in our users table (first login).
      // Only supply the two NOT NULL columns that have no schema default.
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          anonymous_nickname: '旅人' + user.id.slice(-4),
          avatar_seed: user.id.slice(0, 8),
        }, { onConflict: 'id', ignoreDuplicates: true })

      if (upsertError) {
        console.error('users upsert failed:', upsertError.message, upsertError)
        throw new Error(`建立使用者失敗：${upsertError.message}`)
      }

      const { error: insertError } = await supabase.from('mood_entries').insert({
        user_id:            user.id,
        primary_emotion:    emotion,
        plutchik_intensity: intensity,
        valence,
        arousal,
        note:               note.trim() || null,
        is_public:          false,
      })

      if (insertError) {
        console.error('mood_entries insert failed:', insertError.message, insertError)
        throw new Error(`儲存情緒失敗：${insertError.message}`)
      }

      router.push('/garden')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      alert(`儲存失敗：${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const dotX = ((valence + 1) / 2) * 100
  const dotY = ((1 - arousal) / 2) * 100

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-1">🌱</div>
          <h1 className="text-lg font-bold text-green-800">現在感覺如何？</h1>
          <p className="text-xs text-gray-400 mt-0.5">選一個最接近的情緒</p>
        </div>

        {/* Plutchik 8-emotion grid */}
        <div className="grid grid-cols-4 gap-2">
          {EMOTIONS.map(em => (
            <button
              key={em.id}
              onClick={() => setEmotion(em.id as EmotionId)}
              className={`
                rounded-xl py-2.5 flex flex-col items-center gap-1 transition-all
                ${em.bg} ${em.text}
                ${emotion === em.id
                  ? `ring-2 ring-offset-1 ${em.ring} scale-105 shadow-sm`
                  : 'opacity-75 hover:opacity-100'}
              `}
            >
              <span className="text-xl leading-none">{em.emoji}</span>
              <span className="text-[10px] font-semibold">{em.label}</span>
            </button>
          ))}
        </div>

        {/* Intensity */}
        <div>
          <p className="text-xs text-gray-400 mb-2">情緒強度</p>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map(v => (
              <button
                key={v}
                onClick={() => setIntensity(v)}
                className={`
                  flex-1 rounded-full py-1.5 text-sm transition-colors
                  ${intensity === v
                    ? 'bg-green-600 text-white'
                    : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}
                `}
              >
                {v === 1 ? '輕微' : v === 2 ? '普通' : '強烈'}
              </button>
            ))}
          </div>
        </div>

        {/* Russell 2D disk */}
        <div>
          <p className="text-xs text-gray-400 mb-2">情緒位置（點選圓盤精調，可略）</p>
          <div
            ref={diskRef}
            onClick={handleDiskClick}
            onTouchMove={handleDiskTouch}
            className="relative w-full aspect-square rounded-full border border-gray-200 cursor-crosshair overflow-hidden select-none"
            style={{
              background: 'conic-gradient(from 135deg, #fef08a, #86efac, #93c5fd, #c4b5fd, #fca5a5, #fef08a)',
              opacity: 0.9,
            }}
          >
            {/* Axis labels */}
            <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] text-gray-600 font-medium">高喚起</span>
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] text-gray-600 font-medium">低喚起</span>
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 font-medium">負向</span>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-600 font-medium">正向</span>
            {/* Cross lines */}
            <div className="absolute inset-0 flex items-center pointer-events-none">
              <div className="w-full h-px bg-white/50" />
            </div>
            <div className="absolute inset-0 flex justify-center pointer-events-none">
              <div className="h-full w-px bg-white/50" />
            </div>
            {/* Selection dot */}
            <div
              className="absolute w-4 h-4 rounded-full bg-green-700 border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${dotX}%`, top: `${dotY}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            愉悅度 {valence >= 0 ? '+' : ''}{valence.toFixed(2)} ／ 喚起度 {arousal >= 0 ? '+' : ''}{arousal.toFixed(2)}
          </p>
        </div>

        {/* Note */}
        <div>
          <p className="text-xs text-gray-400 mb-2">補充說明（選填，最多 30 字）</p>
          <input
            type="text"
            maxLength={30}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="今天發生了什麼…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-400"
          />
          <p className="text-[10px] text-gray-400 text-right mt-0.5">{note.length}/30</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="flex-none rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!emotion || saving}
            className="flex-1 rounded-full bg-green-600 text-white py-3 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            {saving ? '儲存中…' : '完成記錄 ✓'}
          </button>
        </div>

      </div>
    </main>
  )
}
