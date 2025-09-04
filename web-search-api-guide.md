# Web Search API Alternatives & Implementation Guide

## Overview

This guide provides comprehensive alternatives to NewsAPI.ai for finding historical articles about organizations, with solutions that go beyond the 30-day limitation of the free tier.

## Available Search APIs

### 1. Google Custom Search JSON API ⭐ **Recommended**

**Best for**: Historical coverage from major news sources

**Advantages**:
- Searches back decades of content
- High-quality results from Google's index
- Relatively affordable for moderate usage
- Easy to integrate

**Limitations**:
- 100 free searches/day, then $5 per 1,000 queries
- Requires setting up a Custom Search Engine
- Rate limits apply

**Setup Required**:
```bash
# Environment Variables
GOOGLE_SEARCH_API_KEY=your_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

**Cost**: $5 per 1,000 queries after free tier

### 2. Microsoft Bing Web Search API

**Best for**: Cost-effective alternative with good coverage

**Advantages**:
- 1,000 free queries per month
- Often returns different results than Google
- Good for recent content
- Reliable API

**Limitations**:
- Less historical depth than Google
- $2-$7 per 1,000 queries after free tier

**Setup Required**:
```bash
# Environment Variables
BING_SEARCH_API_KEY=your_api_key_here
```

### 3. SerpApi (Third-party Google scraper)

**Best for**: Production environments requiring consistent results

**Advantages**:
- Direct access to Google News results
- Handles CAPTCHAs automatically
- Very reliable uptime
- Real-time data

**Limitations**:
- More expensive ($50/month for 5,000 searches)
- Technically scraping, not official API

**Cost**: $50/month for 5,000 searches

### 4. GDELT Project 🆓 **Free Historical Data**

**Best for**: Research and historical analysis

**Advantages**:
- Completely free
- Massive global news database
- Historical data back to 2015 (some to 1979)
- Academic-quality data

**Limitations**:
- More complex to integrate
- Less real-time than other sources
- Requires BigQuery for full access

**Integration**: Coming soon (see Implementation Roadmap)

## ChatGPT Deep Research Integration

### Problem Solved
Your existing Inngest pipeline now handles the 15-20 minute wait time for ChatGPT Deep Research through the new `deepResearchJob` function.

### How It Works
1. **Trigger Deep Research**: Call the `deep-research/start` event
2. **Automatic Wait**: Inngest sleeps for 18 minutes (handles Vercel timeouts)
3. **Process Results**: AI generates high-probability URLs based on research
4. **Batch Processing**: Automatically triggers your existing scraping pipeline

### Usage Example
```javascript
// Trigger deep research for an organization
await inngest.send({
  name: 'deep-research/start',
  data: {
    organizationId: 'org-123',
    organizationName: 'Compassion International',
    timeframe: '365' // days back
  }
});
```

## Updated Environment Variables

Add these to your `.env` file:

```bash
# Google Custom Search (Recommended)
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_custom_search_engine_id

# Microsoft Bing Search (Alternative)
BING_SEARCH_API_KEY=your_bing_api_key

# Existing APIs
NEWSAPI_KEY=your_newsapi_key
OPENAI_API_KEY=your_openai_api_key

# Optional: SerpApi (if using)
SERPAPI_KEY=your_serpapi_key
```

## Cost Comparison (Monthly)

| Service | Free Tier | Paid Tier | Best For |
|---------|-----------|-----------|----------|
| **Google Custom Search** | 100 queries/day | $5/1K queries | Historical coverage |
| **Bing Web Search** | 1,000 queries/month | $2-7/1K queries | Cost-effective alternative |
| **NewsAPI** | 1,000 requests/month | $449/month | Recent news only |
| **SerpApi** | 100 searches/month | $50/5K searches | Production reliability |
| **GDELT** | Unlimited | Free | Historical research |

## Implementation Roadmap

### ✅ Completed
- [x] Multi-API URL discovery (Google, Bing, NewsAPI)
- [x] Deep Research integration with Inngest delays
- [x] Historical search capabilities (1, 3, 5 years back)
- [x] Automatic fallback between different APIs

### 🔄 Next Steps
- [ ] GDELT Project integration for free historical data
- [ ] SerpApi integration (if needed)
- [ ] RSS feed discovery for organizations
- [ ] Advanced filtering and deduplication

## Usage Examples

### For Compassion International

**Using Google Custom Search**:
```javascript
// This will search for articles 1, 3, and 5 years back
const results = await googleCustomSearch(
  '"Compassion International" impact stories',
  'y5' // 5 years back
);
```

**Using Deep Research**:
```javascript
// Triggers 18-minute comprehensive research
await inngest.send({
  name: 'deep-research/start',
  data: {
    organizationId: compassionIntlId,
    organizationName: 'Compassion International',
    timeframe: '1095' // 3 years in days
  }
});
```

## Quick Setup Guide

### 1. Get Google Custom Search API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Custom Search JSON API"
3. Create credentials → API Key
4. Create a [Custom Search Engine](https://cse.google.com/)
5. Configure it to search news sites

### 2. Get Bing Search API Key
1. Go to [Azure Portal](https://portal.azure.com/)
2. Create "Bing Search v7" resource
3. Copy the API key

### 3. Update Your Code
Your updated `urlDiscovery.ts` now automatically uses these APIs when the environment variables are present.

## Expected Results

For an organization like "Compassion International", you should expect:

- **Google Custom Search**: 20-50 high-quality articles from major news sources
- **Bing Search**: 10-30 additional articles from different sources  
- **NewsAPI**: 5-15 recent articles (last 30 days)
- **Deep Research**: 30-100 comprehensive URLs after AI analysis

## Long-Running Operations

Your Inngest setup perfectly handles long-running operations:

- **Vercel Functions**: 10-second timeout limit
- **Inngest Steps**: Can run for hours with `step.sleep()`
- **Deep Research**: Uses `step.sleep('deep-research-duration', '18m')`
- **Batch Processing**: Automatically chunks work into manageable pieces

## Troubleshooting

### Common Issues

1. **API Rate Limits**: The code includes automatic delays between requests
2. **Duplicate URLs**: Automatic deduplication against existing articles
3. **Failed Requests**: Built-in retry logic and fallback methods
4. **Long Wait Times**: Use Deep Research for comprehensive results

### Monitoring

Check your Inngest dashboard for:
- Function execution times
- Success/failure rates
- URL discovery metrics
- Batch processing progress

## Best Practices

1. **Start Small**: Test with one organization first
2. **Monitor Costs**: Set up billing alerts for API usage
3. **Use Fallbacks**: The system automatically tries multiple APIs
4. **Historical vs. Recent**: Use Deep Research for historical, regular discovery for recent
5. **Quality Over Quantity**: Better to get fewer high-quality URLs than many low-quality ones

## Support

If you need help with:
- Setting up API keys
- Configuring search engines
- Debugging integration issues
- Optimizing costs

The updated code includes comprehensive logging to help identify and resolve any issues.
