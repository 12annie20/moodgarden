import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  // 測試連線：計算 mood_entries 表的資料筆數（目前為 0 是正常的）
  const { count, error } = await supabase
    .from('mood_entries')
    .select('*', { count: 'exact', head: true })

  const connected = error === null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-green-50 p-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm text-center max-w-sm w-full">
        <div className="text-5xl mb-4">{connected ? '🌱' : '⚠️'}</div>
        <h1 className="text-2xl font-bold text-green-800 mb-2">MoodGarden</h1>
        <p className="text-sm text-gray-500 mb-4">Walking Skeleton — Phase 0</p>

        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          connected
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {connected
            ? `✅ Supabase 連線成功（mood_entries: ${count ?? 0} 筆）`
            : `❌ 連線失敗：${error?.message}`}
        </div>
      </div>
    </main>
  )
}
