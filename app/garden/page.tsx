import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// ── Static data from emotion-model.md ──────────────────────────────────────

const EMOTIONS: Record<string, {
  label: string; emoji: string; creatureName: string; creatureEmoji: string
  badge: string; bar: string
}> = {
  joy:          { label: '喜悅', emoji: '🌟', creatureName: '光點鹿', creatureEmoji: '🦌', badge: 'bg-yellow-100 text-yellow-800', bar: 'bg-yellow-400' },
  trust:        { label: '信任', emoji: '🌿', creatureName: '扎根蘑', creatureEmoji: '🍄', badge: 'bg-green-100  text-green-800',  bar: 'bg-green-400'  },
  fear:         { label: '恐懼', emoji: '😰', creatureName: '躲貓苗', creatureEmoji: '🌱', badge: 'bg-lime-100   text-lime-800',   bar: 'bg-lime-600'   },
  surprise:     { label: '驚訝', emoji: '✨', creatureName: '彈跳豆', creatureEmoji: '🫘', badge: 'bg-cyan-100   text-cyan-800',   bar: 'bg-cyan-400'   },
  sadness:      { label: '悲傷', emoji: '💧', creatureName: '雨滴水母', creatureEmoji: '🪼', badge: 'bg-blue-100 text-blue-800',   bar: 'bg-blue-400'   },
  disgust:      { label: '厭惡', emoji: '🙄', creatureName: '刺刺草', creatureEmoji: '🌵', badge: 'bg-purple-100 text-purple-800', bar: 'bg-purple-400' },
  anger:        { label: '憤怒', emoji: '🔥', creatureName: '焰毛兔', creatureEmoji: '🐰', badge: 'bg-red-100    text-red-800',    bar: 'bg-red-400'    },
  anticipation: { label: '期待', emoji: '🌅', creatureName: '星望鳥', creatureEmoji: '🦅', badge: 'bg-orange-100 text-orange-800', bar: 'bg-orange-400' },
}

const INTENSITY_LABEL = ['', '輕微', '普通', '強烈']

// Level up at 2 → 5 → 10 → 20 → 50 entries of same emotion
function toLevel(count: number) {
  if (count >= 50) return 5
  if (count >= 20) return 4
  if (count >= 10) return 3
  if (count >= 5)  return 2
  return 1
}

// Consecutive days (local clock) going back from today
function computeStreak(isoDates: string[]): number {
  if (!isoDates.length) return 0
  const localDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dateSet = new Set(isoDates.map(localDate))
  const today = localDate(new Date().toISOString())
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (dateSet.has(localDate(d.toISOString()))) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function GardenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('users').upsert({
    id: user.id,
    anonymous_nickname: '旅人' + user.id.slice(-4),
    avatar_seed: user.id.slice(0, 8),
  }, { onConflict: 'id', ignoreDuplicates: true })

  // Fetch last 90 days for stats; use first 5 for the list
  const since90 = new Date(Date.now() - 90 * 86400_000).toISOString()
  const { data: raw } = await supabase
    .from('mood_entries')
    .select('id, primary_emotion, plutchik_intensity, note, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since90)
    .order('created_at', { ascending: false })

  const allEntries = raw ?? []
  const recentEntries = allEntries.slice(0, 5)

  // Streak
  const streak = computeStreak(allEntries.map(e => e.created_at))

  // Creature counts (past 90 days grouped by emotion)
  const creatureCounts: Record<string, number> = {}
  allEntries.forEach(e => {
    creatureCounts[e.primary_emotion] = (creatureCounts[e.primary_emotion] ?? 0) + 1
  })
  const discoveredCreatures = Object.entries(creatureCounts)
    .sort((a, b) => b[1] - a[1]) // most frequent first

  // Past-7-days emotion distribution
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
  const weekEntries = allEntries.filter(e => e.created_at >= since7)
  const weekCounts: Record<string, number> = {}
  weekEntries.forEach(e => {
    weekCounts[e.primary_emotion] = (weekCounts[e.primary_emotion] ?? 0) + 1
  })
  const weekTotal = weekEntries.length

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-green-50 p-4 sm:p-8 flex flex-col items-center gap-4">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* ── Hero card ── */}
        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col gap-3 text-center">
          <div className="text-5xl">🌿</div>
          <h1 className="text-xl font-bold text-green-800">我的花園</h1>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 break-all">
            {user.email ?? user.id}
          </p>

          {/* Stats row */}
          <div className="flex justify-center gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-green-700">
                {streak > 0 ? `${streak}` : '0'}
              </p>
              <p className="text-[10px] text-gray-400">
                {streak > 0 ? '🔥 連續天數' : '天數'}
              </p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-2xl font-bold text-green-700">{allEntries.length}</p>
              <p className="text-[10px] text-gray-400">累積紀錄</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div>
              <p className="text-2xl font-bold text-green-700">{discoveredCreatures.length}</p>
              <p className="text-[10px] text-gray-400">種小生物</p>
            </div>
          </div>

          <Link
            href="/mood-entry"
            className="block w-full rounded-full bg-green-600 text-white py-3 text-sm font-medium hover:bg-green-700 transition-colors"
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

        {/* ── Creature collection ── */}
        {discoveredCreatures.length > 0 ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">我的小生物</h2>
            <div className="grid grid-cols-2 gap-2">
              {discoveredCreatures.map(([emotion, count]) => {
                const em = EMOTIONS[emotion]
                if (!em) return null
                const lv = toLevel(count)
                return (
                  <div
                    key={emotion}
                    className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                  >
                    <span className="text-2xl leading-none">{em.creatureEmoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{em.creatureName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${em.badge}`}>
                          {em.label}
                        </span>
                        <span className="text-[9px] text-gray-400">Lv.{lv}</span>
                      </div>
                      {/* Level bar */}
                      <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${em.bar}`}
                          style={{ width: `${(lv / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 text-center">
              同一種情緒記錄 5、10、20、50 次可升等
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm text-center text-xs text-gray-400 flex flex-col gap-1">
            <span className="text-3xl">🥚</span>
            <p>還沒有小生物</p>
            <p>記錄第一次情緒，牠們就會出現！</p>
          </div>
        )}

        {/* ── This week emotion distribution ── */}
        {weekTotal > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">本週情緒分布</h2>
              <span className="text-[10px] text-gray-400">{weekTotal} 次</span>
            </div>
            <div className="flex flex-col gap-2">
              {Object.entries(weekCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([emotion, count]) => {
                  const em = EMOTIONS[emotion]
                  if (!em) return null
                  const pct = Math.round((count / weekTotal) * 100)
                  return (
                    <div key={emotion} className="flex items-center gap-2">
                      <span className="text-base leading-none w-5">{em.emoji}</span>
                      <span className="text-xs text-gray-600 w-10 shrink-0">{em.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${em.bar} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ── Recent entries list ── */}
        {recentEntries.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">近期紀錄</h2>
            <ul className="flex flex-col gap-2">
              {recentEntries.map(entry => {
                const em = EMOTIONS[entry.primary_emotion] ?? { label: entry.primary_emotion, emoji: '❓', badge: 'bg-gray-100 text-gray-700' }
                return (
                  <li key={entry.id} className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">{em.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${em.badge}`}>
                          {em.label}
                        </span>
                        <span className="text-[10px] text-gray-400">
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

        {allEntries.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-4">
            還沒有紀錄，點上方按鈕開始吧 🌱
          </p>
        )}

      </div>
    </main>
  )
}
