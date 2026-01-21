-- Feedback Analytics Dashboard - D1 Database Schema

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  source TEXT NOT NULL,
  task TEXT NOT NULL,
  issue TEXT NOT NULL,
  solution TEXT,
  feedback_text TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sentiment ON feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_urgency ON feedback(urgency);
CREATE INDEX IF NOT EXISTS idx_source ON feedback(source);
CREATE INDEX IF NOT EXISTS idx_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_created_at ON feedback(created_at DESC);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_source_sentiment ON feedback(source, sentiment);
CREATE INDEX IF NOT EXISTS idx_urgency_sentiment ON feedback(urgency, sentiment);

-- Enhanced sample data with positive feedback and diverse issues per source
INSERT INTO feedback (company, source, task, issue, solution, feedback_text, sentiment, urgency, category, created_at) VALUES
-- Support Tickets (mix of issues)
('Acme Corp', 'Support Ticket', 'API Rate Limiting', 'Rate limits too restrictive for burst traffic', 'Implement token bucket algorithm', 'Need more flexible rate limiting options for our spike traffic patterns', 'negative', 'high', 'Performance', '2026-01-15T10:30:00'),
('WebFlow Inc', 'Support Ticket', 'Customer Support', 'Support team response was excellent', 'Continue current practices', 'Your support team resolved my DNS issue in under 10 minutes. Incredibly helpful!', 'positive', 'low', 'Support', '2026-01-16T09:15:00'),
('DevTools Inc', 'Support Ticket', 'Cache Purging', 'Purge takes too long to propagate globally', 'Improve cache invalidation speed', 'Cache purge should be instant across all edge locations', 'negative', 'medium', 'Performance', '2026-01-13T08:20:00'),
('StartupXYZ', 'Support Ticket', 'Billing Clarity', 'Usage breakdown is confusing', 'Add detailed cost breakdown UI', 'Hard to understand what is driving our monthly costs', 'neutral', 'medium', 'Billing', '2026-01-14T11:30:00'),

-- Discord (community feedback)
('TechStart Inc', 'Discord', 'Dashboard Navigation', 'Difficulty finding analytics section', 'Redesign navigation menu', 'Love the product but navigation is confusing, took me 10 mins to find metrics', 'neutral', 'medium', 'UX', '2026-01-15T14:20:00'),
('CloudNinja', 'Discord', 'Workers AI', 'AI integration works flawlessly', 'Document best practices', 'Just deployed Workers AI for image recognition - blazing fast and easy to use!', 'positive', 'low', 'Feature Request', '2026-01-16T16:45:00'),
('WebScale Solutions', 'Discord', 'KV Storage', 'No bulk operations support', 'Add batch read/write APIs', 'Would love bulk upload feature for migrating existing data to KV', 'neutral', 'low', 'Feature Request', '2026-01-12T13:10:00'),
('GameDev Studio', 'Discord', 'WebSocket Support', 'Need native WebSocket support in Workers', 'Add Durable Objects documentation', 'Trying to build real-time multiplayer features, WebSockets would be perfect', 'neutral', 'medium', 'Feature Request', '2026-01-11T19:20:00'),

-- GitHub Issues (technical problems)
('Global Systems', 'GitHub Issue', 'Worker Deployment', 'Deployment times exceed 2 minutes', 'Optimize build pipeline', 'Deployment is too slow compared to competitors, affecting our CI/CD', 'negative', 'high', 'Performance', '2026-01-14T09:15:00'),
('OpenSource Dev', 'GitHub Issue', 'TypeScript Support', 'Excellent TypeScript definitions', 'Keep updating types', 'The TypeScript support is phenomenal - autocomplete works perfectly!', 'positive', 'low', 'Developer Experience', '2026-01-16T10:30:00'),
('Analytics Pro', 'GitHub Issue', 'Analytics API', 'Rate limits on analytics queries too strict', 'Increase analytics API limits', 'Cannot get real-time analytics due to limits, need at least 1000 req/min', 'negative', 'high', 'Performance', '2026-01-10T09:30:00'),
('MobileApp Co', 'GitHub Issue', 'CORS Configuration', 'CORS setup is unclear in docs', 'Add CORS examples', 'Spent 2 hours figuring out CORS for mobile app integration', 'neutral', 'medium', 'Documentation', '2026-01-13T15:45:00'),

-- Email (direct feedback)
('DataFlow LLC', 'Email', 'Documentation', 'Missing examples for D1 database queries', 'Add comprehensive examples section', 'Need more real-world D1 examples with relationships and migrations', 'neutral', 'medium', 'Documentation', '2026-01-14T16:45:00'),
('Enterprise Corp', 'Email', 'Enterprise Features', 'Enterprise support exceeded expectations', 'Maintain support quality', 'Our dedicated account manager helped us migrate 50 domains seamlessly', 'positive', 'low', 'Support', '2026-01-16T14:20:00'),
('SecureNet', 'Email', 'WAF Rules', 'Custom rules UI is overly complex', 'Simplify rule builder interface', 'Great security features but UI for custom WAF rules needs work', 'neutral', 'medium', 'UX', '2026-01-11T10:25:00'),
('FinTech Startup', 'Email', 'Compliance', 'Need SOC 2 compliance documentation', 'Publish compliance docs', 'Our legal team needs proof of SOC 2 compliance for financial data', 'neutral', 'high', 'Security', '2026-01-12T09:00:00'),

-- Twitter (public feedback)
('CloudNative Co', 'Twitter', 'Billing Dashboard', 'Cannot understand usage breakdown', 'Add detailed usage analytics', 'Billing is opaque, need better visibility into what services drive costs', 'negative', 'high', 'Billing', '2026-01-13T11:30:00'),
('Indie Hacker', 'Twitter', 'Free Tier', 'Free tier is incredibly generous!', 'Keep free tier competitive', 'Built and deployed my entire SaaS on Cloudflare free tier. Amazing value!', 'positive', 'low', 'Pricing', '2026-01-16T12:15:00'),
('DevAgency', 'Twitter', 'CDN Performance', 'CDN speed is unmatched', 'Continue optimization', 'Switched from competitor to Cloudflare CDN - our TTFB dropped by 60%!', 'positive', 'low', 'Performance', '2026-01-15T18:30:00'),
('SaaS Builder', 'Twitter', 'Pages Deployment', 'Pages deploy time is inconsistent', 'Stabilize build times', 'Sometimes deploys in 30s, sometimes 5 minutes. Need consistency', 'neutral', 'medium', 'Performance', '2026-01-14T20:45:00'),

-- Community Forum (detailed discussions)
('FastAPI Corp', 'Community Forum', 'Edge Computing', 'Cold start latency on workers', 'Implement warm pool', 'Cold starts hurt our API performance metrics, need <10ms startup', 'negative', 'high', 'Performance', '2026-01-12T15:40:00'),
('MLOps Team', 'Community Forum', 'Workers AI Models', 'AI model selection is fantastic', 'Add more models', 'Having Llama, Stable Diffusion at the edge is game-changing for our app', 'positive', 'low', 'Feature Request', '2026-01-16T11:00:00'),
('eCommerce Site', 'Community Forum', 'R2 Storage', 'R2 pricing is very competitive', 'Keep pricing model', 'Migrated 10TB from S3 to R2, saving $2000/month with better performance!', 'positive', 'low', 'Pricing', '2026-01-15T13:25:00'),
('DevShop', 'Community Forum', 'Developer Experience', 'Local development setup is painful', 'Improve Wrangler CLI experience', 'Wrangler dev workflow needs work - too many manual steps to get started', 'negative', 'medium', 'Developer Experience', '2026-01-10T11:15:00'),
('MediaStream', 'Community Forum', 'Stream Integration', 'Unclear pricing for video streaming', 'Add pricing calculator', 'Stream pricing is confusing for our use case, need a calculator', 'neutral', 'medium', 'Billing', '2026-01-11T14:50:00');