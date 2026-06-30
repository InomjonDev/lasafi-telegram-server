export type AnalyticsEvent = {
  id?: string
  created_at?: string
  event_type: string
  page?: string | null
  product_id?: string | null
  visitor_id?: string | null
  referrer?: string | null
  user_agent?: string | null
  ip_address?: string | null
}

export type DailyStats = {
  date: string
  visits: number
  unique_visitors: number
  page_views: number
}

export type AnalyticsSummary = {
  total_visits: number
  unique_visitors: number
  total_page_views: number
  total_product_views: number
}

export function computeAnalyticsStats(events: AnalyticsEvent[]) {
  const pageViews = events.filter(e => e.event_type === 'page_view')
  const productViews = events.filter(e => e.event_type === 'product_view')
  const visits = events.filter(e => e.event_type === 'visit')

  const uniqueVisitors = new Set(events.map(e => e.visitor_id).filter(Boolean))

  const pageBreakdown: Record<string, number> = {}
  for (const e of pageViews) {
    const p = e.page || 'unknown'
    pageBreakdown[p] = (pageBreakdown[p] || 0) + 1
  }

  const productViewMap: Record<string, { views: number; product_id: string }> = {}
  for (const e of productViews) {
    if (!e.product_id) continue
    if (!productViewMap[e.product_id]) {
      productViewMap[e.product_id] = { product_id: e.product_id, views: 0 }
    }
    productViewMap[e.product_id].views++
  }
  const topProducts = Object.values(productViewMap).sort((a, b) => b.views - a.views).slice(0, 10)

  const dailyMap: Record<string, { date: string; visits: number; unique_visitors: Set<string>; page_views: number }> = {}
  for (const e of events) {
    const day = e.created_at?.slice(0, 10)
    if (!day) continue
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, visits: 0, unique_visitors: new Set(), page_views: 0 }
    }
    if (e.event_type === 'visit') dailyMap[day].visits++
    if (e.event_type === 'page_view') dailyMap[day].page_views++
    if (e.visitor_id) dailyMap[day].unique_visitors.add(e.visitor_id)
  }
  const daily: DailyStats[] = Object.values(dailyMap)
    .map(d => ({ date: d.date, visits: d.visits, unique_visitors: d.unique_visitors.size, page_views: d.page_views }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const summary: AnalyticsSummary = {
    total_visits: visits.length,
    unique_visitors: uniqueVisitors.size,
    total_page_views: pageViews.length,
    total_product_views: productViews.length,
  }

  return { summary, daily, page_breakdown: pageBreakdown, top_products: topProducts }
}
