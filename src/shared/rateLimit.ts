import type { Context, Next } from 'hono'

const rateMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(limit: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const entry = rateMap.get(ip)
    if (!entry || now > entry.resetAt) {
      rateMap.set(ip, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }
    entry.count++
    if (entry.count > limit) {
      return c.json({ error: 'Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.' }, 429)
    }
    await next()
  }
}
