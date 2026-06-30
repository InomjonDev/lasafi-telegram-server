import type { Context, Next } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

export function authMiddleware(getSupabase: (c: Context) => SupabaseClient) {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Avtorizatsiya talab qilinadi' }, 401)
    const token = auth.slice(7)
    const supabase = getSupabase(c)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return c.json({ error: "Noto'g'ri token" }, 401)
    await next()
  }
}
