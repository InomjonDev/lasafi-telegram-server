import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import { supabaseAdmin } from './supabase.js'
import { sendTelegramMessage, sendTelegramPhoto } from './telegram.js'
import { validate } from './shared/validate.js'
import { rateLimit } from './shared/rateLimit.js'
import { authMiddleware } from './shared/authMiddleware.js'
import { computeAnalyticsStats } from './shared/analytics.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`)
})

const requireAuth = authMiddleware(() => supabaseAdmin)

/* ---- Products ---- */
async function listProducts(c: Context) {
  const { data, error } = await supabaseAdmin.from('products').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getProduct(c: Context) {
  const id = c.req.param('id')
  const { data, error } = await supabaseAdmin.from('products').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function createProduct(c: Context) {
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await supabaseAdmin.from('products').insert({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
  }).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateProduct(c: Context) {
  const id = c.req.param('id')
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await supabaseAdmin.from('products').update({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
  }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteProduct(c: Context) {
  const id = c.req.param('id')
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
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
  const { data, error } = await supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getOrder(c: Context) {
  const id = c.req.param('id')
  const { data, error } = await supabaseAdmin.from('orders').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateOrder(c: Context) {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { data, error } = await supabaseAdmin.from('orders').update({
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
  const { data, error } = await supabaseAdmin.from('orders').update({ status }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteOrder(c: Context) {
  const id = c.req.param('id')
  const { error } = await supabaseAdmin.from('orders').delete().eq('id', id)
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

  const { error } = await supabaseAdmin.from('orders').insert({
    product_id: body.product_id,
    product_title: body.product_title,
    product_image: body.product_image,
    price: body.price,
    customer_name: body.customer_name,
    phone: body.phone,
    address: body.address,
    quantity: body.quantity,
    status: 'new',
  })
  if (error) return c.json({ error: error.message }, 500)

  try {
    const caption = `🆕 NEW ORDER

${body.product_title}
${body.price} UZS

👤 ${body.customer_name}
📞 ${body.phone}
📍 ${body.address}
${body.quantity ? `🔢 ${body.quantity} x` : ''}`

    if (body.product_image) {
      await sendTelegramPhoto(body.product_image, caption)
    } else {
      await sendTelegramMessage(caption)
    }
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

    const ip = c.req.header('x-forwarded-for') || null
    const ua = c.req.header('user-agent') || null

    await supabaseAdmin.from('analytics_events').insert({
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

    const { data: events, error } = await supabaseAdmin
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

serve({
  fetch: app.fetch,
  port: Number(process.env.PORT || 8787),
})

export default app
