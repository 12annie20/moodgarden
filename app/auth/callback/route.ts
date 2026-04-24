import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Supabase 在 Google 登入後把使用者帶回這個 route，
// 這裡把 code 換成 session，再跳轉到首頁。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/garden'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
