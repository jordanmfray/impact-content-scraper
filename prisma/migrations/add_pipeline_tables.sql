-- Discovery Pipeline Tables
-- Phase 1: URL Discovery and Classification

CREATE TABLE discovery_session (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organization(id),
  news_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'discovering' CHECK (status IN ('discovering', 'ready_for_review', 'reviewed', 'scraping', 'analyzing', 'finalizing', 'completed', 'cancelled')),
  total_urls INTEGER DEFAULT 0,
  selected_urls INTEGER DEFAULT 0,
  processed_urls INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE discovered_url (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_session_id TEXT NOT NULL REFERENCES discovery_session(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_type TEXT NOT NULL CHECK (url_type IN ('news', 'post')),
  domain TEXT NOT NULL,
  title_preview TEXT,
  selected_for_scraping BOOLEAN DEFAULT false,
  scrape_status TEXT DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'scraping', 'scraped', 'failed', 'skipped')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Phase 2: Scraped Content and Analysis

CREATE TABLE scraped_content (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_url_id TEXT NOT NULL REFERENCES discovered_url(id) ON DELETE CASCADE,
  discovery_session_id TEXT NOT NULL REFERENCES discovery_session(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  markdown_content TEXT,
  keywords TEXT[],
  sentiment_score INTEGER CHECK (sentiment_score >= -1 AND sentiment_score <= 3),
  sentiment_reasoning TEXT,
  selected_for_finalization BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Phase 3: Finalized Articles

CREATE TABLE pipeline_article (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_content_id TEXT NOT NULL REFERENCES scraped_content(id) ON DELETE CASCADE,
  discovery_session_id TEXT NOT NULL REFERENCES discovery_session(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organization(id),
  final_title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  url TEXT NOT NULL,
  og_image TEXT,
  extracted_images TEXT[],
  keywords TEXT[],
  sentiment_score INTEGER,
  url_type TEXT NOT NULL,
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'published')),
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_discovery_session_org ON discovery_session(organization_id);
CREATE INDEX idx_discovery_session_status ON discovery_session(status);
CREATE INDEX idx_discovered_url_session ON discovered_url(discovery_session_id);
CREATE INDEX idx_scraped_content_session ON scraped_content(discovery_session_id);
CREATE INDEX idx_pipeline_article_session ON pipeline_article(discovery_session_id);
