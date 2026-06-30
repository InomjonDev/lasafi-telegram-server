-- Analytics tables for tracking page views, visits, product views

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,  -- 'visit', 'page_view', 'product_view'
  page TEXT,                 -- 'catalog', 'product', 'order', 'favorites'
  product_id TEXT,           -- only for 'product_view'
  referrer TEXT,
  visitor_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON analytics_events (page);

CREATE TABLE IF NOT EXISTS daily_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  product_views INTEGER DEFAULT 0,
  orders_placed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);
