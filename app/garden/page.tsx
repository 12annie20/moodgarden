import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function GardenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-green-50 p-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm text-center max-w-sm w-full flex flex-col gap-4">
        <div className="text-5xl">🌿</div>
        <h1 className="text-xl font-bold text-green-800">我的花園</h1>
        <p className="text-sm text-gray-500">登入成功！</p>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 break-all">
          {user.email ?? user.id}
        </p>
        <p className="text-sm text-green-700 font-medium">✅ Google OAuth 連線正常</p>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            登出
          </button>
        </form>
      </div>
    </main>
  )
}
