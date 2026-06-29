import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  BOT_TOKEN: string
  SELLER_CHAT_ID: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

/* ---- Logging ---- */
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`)
})

/* ---- Rate limiter (simple in-memory) ---- */
const rateMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(limit: number, windowMs: number) {
  return async (c: any, next: any) => {
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

/* ---- Auth ---- */
async function authMiddleware(c: any, next: any) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Avtorizatsiya talab qilinadi' }, 401)
  const token = auth.slice(7)
  const supabaseAdmin = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return c.json({ error: "Noto'g'ri token" }, 401)
  await next()
}

const fieldLabels: Record<string, string> = {
  title: 'Nomi',
  price: 'Narxi',
  product_title: 'Mahsulot nomi',
  customer_name: 'Mijoz ismi',
  phone: 'Telefon',
  address: 'Manzil',
}

function validate(fields: Record<string, unknown>, rules: Record<string, string>) {
  const errors: string[] = []
  for (const [key, type] of Object.entries(rules)) {
    const val = fields[key]
    const label = fieldLabels[key] || key
    if (type === 'required' && (val === undefined || val === null || val === '')) {
      errors.push(`${label} kiritilishi shart`)
    }
    if (type === 'number' && val !== undefined && val !== null && val !== '' && (typeof val !== 'number' || isNaN(val))) {
      errors.push(`${label} son bo'lishi kerak`)
    }
    if (type === 'positive' && typeof val === 'number' && val <= 0) {
      errors.push(`${label} musbat son bo'lishi kerak`)
    }
  }
  return errors
}

function db(c: any) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY)
}

/* ---- Products ---- */
async function listProducts(c: any) {
  const { data, error } = await db(c).from('products').select('*')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getProduct(c: any) {
  const id = c.req.param('id')
  const { data, error } = await db(c).from('products').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function createProduct(c: any) {
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await db(c).from('products').insert({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
  }).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateProduct(c: any) {
  const id = c.req.param('id')
  const body = await c.req.json()
  const errors = validate(body, { title: 'required', price: 'number' })
  if (errors.length) return c.json({ error: errors.join('; ') }, 400)

  const { data, error } = await db(c).from('products').update({
    title: body.title,
    description: body.description,
    price: body.price,
    images: body.images,
  }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteProduct(c: any) {
  const id = c.req.param('id')
  const { error } = await db(c).from('products').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
}

app.get('/products', listProducts)
app.get('/products/:id', getProduct)
app.post('/products', authMiddleware, createProduct)
app.put('/products/:id', authMiddleware, updateProduct)
app.delete('/products/:id', authMiddleware, deleteProduct)

/* ---- Orders ---- */
async function listOrders(c: any) {
  const { data, error } = await db(c).from('orders').select('*').order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function getOrder(c: any) {
  const id = c.req.param('id')
  const { data, error } = await db(c).from('orders').select('*').eq('id', id).single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function updateOrder(c: any) {
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

async function patchOrderStatus(c: any) {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  const { data, error } = await db(c).from('orders').update({ status }).eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function deleteOrder(c: any) {
  const id = c.req.param('id')
  const { data, error } = await db(c).from('orders').delete().eq('id', id).select()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
}

async function createOrder(c: any) {
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
    await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: c.env.SELLER_CHAT_ID,
        text: `
NEW ORDER
Product: ${body.product_title}
Price: ${body.price} UZS
Name: ${body.customer_name}
Phone: ${body.phone}
Address: ${body.address}
`,
      }),
    })
  } catch (err) {
    console.error('TELEGRAM ERROR:', err)
  }

  return c.json({ success: true })
}

app.get('/orders', authMiddleware, listOrders)
app.get('/orders/:id', authMiddleware, getOrder)
app.put('/orders/:id', authMiddleware, updateOrder)
app.patch('/orders/:id/status', authMiddleware, patchOrderStatus)
app.delete('/orders/:id', authMiddleware, deleteOrder)
app.post('/order', rateLimit(5, 60_000), createOrder)

export default app
