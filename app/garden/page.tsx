import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const EMOTION_DISPLAY: Record<string, { label: string; emoji: string; badge: string }> = {
  joy:          { label: '喜悅', emoji: '🌟', badge: 'bg-yellow-100 text-yellow-800' },
  trust:        { label: '信任', emoji: '🌿', badge: 'bg-green-100  text-green-800'  },
  fear:         { label: '恐懼', emoji: '😰', badge: 'bg-lime-100   text-lime-800'   },
  surprise:     { label: '驚訝', emoji: '✨', badge: 'bg-cyan-100   text-cyan-800'   },
  sadness:      { label: '悲傷', emoji: '💧', badge: 'bg-blue-100   text-blue-800'   },
  disgust:      { label: '厭惡', emoji: '🙄', badge: 'bg-purple-100 text-purple-800' },
  anger:        { label: '憤怒', emoji: '🔥', badge: 'bg-red-100    text-red-800'    },
  anticipation: { label: '期待', emoji: '🌅', badge: 'bg-orange-100 text-orange-800' },
}

const INTENSITY_LABEL = ['', '輕微', '普通', '強烈']

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit',  minute: '2-digit',
    hour12: false,
  })
}

export default async function GardenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Ensure this auth user has a row in our users table.
  // Only supply the two NOT NULL columns that have no schema default.
  await supabase
    .from('users')
    .upsert({
      id: user.id,
      anonymous_nickname: '旅人' + user.id.slice(-4),
      avatar_seed: user.id.slice(0, 8),
    }, { onConflict: 'id', ignoreDuplicates: true })

  // Fetch the 5 most recent mood entries for this user
  const { data: entries } = await supabase
    .from('mood_entries')
    .select('id, primary_emotion, plutchik_intensity, note, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-green-50 p-4 sm:p-8">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Garden card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm text-center flex flex-col gap-3">
          <div className="text-5xl">🌿</div>
          <h1 className="text-xl font-bold text-green-800">我的花園</h1>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 break-all">
            {user.email ?? user.id}
          </p>

          {/* Log mood CTA */}
          <Link
            href="/mood-entry"
            className="mt-1 block w-full rounded-full bg-green-600 text-white py-3 text-sm font-medium hover:bg-green-700 transition-colors text-center"
          >
            ＋ 記錄現在情緒
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors"
            >
              登出
            </button>
          </form>
        </div>

        {/* Recent entries */}
        {entries && entries.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">近期情緒紀錄</h2>
            <ul className="flex flex-col gap-2">
              {entries.map(entry => {
                const em = EMOTION_DISPLAY[entry.primary_emotion] ?? { label: entry.primary_emotion, emoji: '❓', badge: 'bg-gray-100 text-gray-700' }
                return (
                  <li key={entry.id} className="flex items-start gap-2 text-sm">
                    <span className="text-lg leading-none mt-0.5">{em.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${em.badge}`}>
                          {em.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {INTENSITY_LABEL[entry.plutchik_intensity]}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.note}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5">
                      {formatTime(entry.created_at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {entries?.length === 0 && (
          <p className="text-center text-xs text-gray-400">
            還沒有紀錄，點上方按鈕開始吧 🌱
          </p>
        )}

      </div>
    </main>
  )
}
