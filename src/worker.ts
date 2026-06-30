import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import { validate } from './shared/validate.js'
import { rateLimit } from './shared/rateLimit.js'
import { authMiddleware } from './shared/authMiddleware.js'
import { computeAnalyticsStats } from './shared/analytics.js'
import { sendTelegramNotification } from './shared/telegramNotify.js'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  ADMIN_BOT_TOKEN: string
  ADMIN_CHAT_ID: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`)
})

function db(c: Context) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)
}

const requireAuth = authMiddleware((c: Context) => db(c))

/* ---- Products ---- */
async function listProducts(c: Context) {
  const { data, error } = await db(c).from('products').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getProduct(c: Context) {
  const id = c.req.param('id')
  const { data, error } = await db(c).from('products').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function createProduct(c: Context) {
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await db(c).from('products').insert({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
    quantity: body.quantity ?? 0,
  }).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateProduct(c: Context) {
  const id = c.req.param('id')
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await db(c).from('products').update({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
    quantity: body.quantity ?? 0,
  }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteProduct(c: Context) {
  const id = c.req.param('id')
  const { error } = await db(c).from('products').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
}

app.get('/products', listProducts)
app.get('/products/:id', getProduct)
app.post('/products', requireAuth, createProduct)
app.put('/products/:id', requireAuth, updateProduct)
app.delete('/products/:id', requireAuth, deleteProduct)

/* ---- Orders ---- */
async function listOrders(c: Context) {
  const { data, error } = await db(c).from('orders').select('*').order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getOrder(c: Context) {
  const id = c.req.param('id')
  const { data, error } = await db(c).from('orders').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateOrder(c: Context) {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { data, error } = await db(c).from('orders').update({
    status: body.status,
    phone: body.phone,
    address: body.address,
  }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function patchOrderStatus(c: Context) {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const { data, error } = await db(c).from('orders').update({ status }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteOrder(c: Context) {
  const id = c.req.param('id')
  const { error } = await db(c).from('orders').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
}

async function createOrder(c: Context) {
  const body = await c.req.json()
  const errors = validate(body, {
    product_title: 'required',
    price: 'number',
    customer_name: 'required',
    phone: 'required',
    address: 'required',
  })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { error } = await db(c).from('orders').insert({ ...body, status: 'new' })
  if (error) return c.json({ error: error.message }, 500)

  try {
    await sendTelegramNotification(
      c.env.ADMIN_BOT_TOKEN,
      c.env.ADMIN_CHAT_ID,
      body.product_title,
      body.price,
      body.customer_name,
      body.phone,
      body.address,
      body.quantity,
      body.product_image,
      body.total_price,
    )
  } catch (err) {
    console.error('TELEGRAM ERROR:', err)
  }

  return c.json({ success: true })
}

app.get('/orders', requireAuth, listOrders)
app.get('/orders/:id', requireAuth, getOrder)
app.put('/orders/:id', requireAuth, updateOrder)
app.patch('/orders/:id/status', requireAuth, patchOrderStatus)
app.delete('/orders/:id', requireAuth, deleteOrder)
app.post('/order', rateLimit(5, 60_000), createOrder)

/* ---- Analytics ---- */
async function trackEvent(c: Context) {
  try {
    const body = await c.req.json()
    const { event_type, page, product_id, referrer, visitor_id } = body
    if (!event_type) return c.json({ error: 'event_type is required' }, 400)

    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null
    const ua = c.req.header('user-agent') || null

    await db(c).from('analytics_events').insert({
      event_type, page, product_id, referrer, visitor_id,
      user_agent: ua, ip_address: ip,
    })
  } catch (err) {
    console.error('trackEvent error:', err)
  }

  return c.json({ success: true })
}

async function getAnalyticsStats(c: Context) {
  try {
    const from = c.req.query('from')
    const to = c.req.query('to')

    const { data: events, error } = await db(c)
      .from('analytics_events')
      .select('*')
      .gte('created_at', from || '1970-01-01')
      .lte('created_at', to || '2099-12-31')

    if (error) throw error

    const result = computeAnalyticsStats(events || [])
    return c.json(result)
  } catch (err) {
    console.error('getAnalyticsStats error:', err)
    return c.json({ error: "Ma'lumotlarni yuklashda xatolik yuz berdi" }, 500)
  }
}

app.post('/analytics/track', rateLimit(200, 60_000), trackEvent)
app.get('/analytics/stats', requireAuth, getAnalyticsStats)

export default app
