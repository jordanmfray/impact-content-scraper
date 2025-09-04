import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

interface ArticleValidationInput {
  title: string
  summary: string
  content: string
  organizationName: string
  publishedAt?: string | null
  url: string
}

interface ValidationResult {
  isValid: boolean
  reasons: string[]
  organizationSentiment: 'positive' | 'neutral' | 'negative'
  contentType: 'news' | 'press_release' | 'blog_post' | 'list_view' | 'other'
  organizationRelevance: 'high' | 'medium' | 'low'
  publishDateValid: boolean
}

/**
 * Validates article content against quality and relevance criteria
 * Filters out articles that don't meet the standards for cataloging
 */
export async function validateArticleContent(input: ArticleValidationInput): Promise<ValidationResult> {
  try {
    // Check for error pages and hallucinated content first
    const errorPageCheck = detectErrorPage(input);
    if (!errorPageCheck.isValid) {
      return {
        isValid: false,
        reasons: errorPageCheck.reasons,
        organizationSentiment: 'neutral',
        contentType: 'other',
        organizationRelevance: 'low',
        publishDateValid: false
      };
    }

    // Check publish date (simple validation)
    const publishDateValid = checkPublishDate(input.publishedAt);

    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `You are an expert content analyst for faith-based impact investing. Your job is to validate whether articles should be catalogued based on strict quality and relevance criteria.

VALIDATION CRITERIA:

1. ORGANIZATION SENTIMENT: How does this article portray the organization?
   - POSITIVE: Highlights achievements, positive impact, good news about the organization
   - NEUTRAL: Factual reporting without positive or negative bias
   - NEGATIVE: Criticism, scandals, negative events, or unfavorable coverage
   
2. CONTENT TYPE: What type of content is this?
   - NEWS: Actual news articles about events, developments, impact stories
   - PRESS_RELEASE: Official announcements or promotional content
   - BLOG_POST: Opinion pieces, thought leadership, personal perspectives
   - LIST_VIEW: Directory, list of articles, index pages, navigation pages
   - OTHER: Documentation, technical specs, administrative content

3. ORGANIZATION RELEVANCE: How much is this article actually about the organization?
   - HIGH: Organization is main subject, significant coverage (>30% of content)
   - MEDIUM: Organization mentioned substantially but not main focus (10-30%)
   - LOW: Brief mention, passing reference, or tangential connection (<10%)

REJECTION CRITERIA:
- Negative sentiment toward the organization
- Published before January 1, 2024
- List views or navigation pages
- Low organization relevance
- Non-news content types (unless high-quality impact stories)`,
      prompt: `Analyze this article for the organization "${input.organizationName}":

URL: ${input.url}
Title: ${input.title}
Summary: ${input.summary}
Published: ${input.publishedAt || 'Unknown'}

Content Preview:
${input.content.substring(0, 4000)}

Validate this article:`,
      schema: z.object({
        organizationSentiment: z.enum(['positive', 'neutral', 'negative']),
        contentType: z.enum(['news', 'press_release', 'blog_post', 'list_view', 'other']),
        organizationRelevance: z.enum(['high', 'medium', 'low']),
        reasoning: z.string().describe('Detailed explanation of the validation decision'),
        specificIssues: z.array(z.string()).describe('Specific problems found, if any')
      }),
    });

    // Determine if article is valid based on criteria
    const validationReasons: string[] = [];
    let isValid = true;

    // Check organization sentiment
    if (result.object.organizationSentiment === 'negative') {
      isValid = false;
      validationReasons.push('Article casts negative light on the organization');
    }

    // Check publish date
    if (!publishDateValid) {
      isValid = false;
      validationReasons.push('Article published before January 1, 2024');
    }

    // Check for list views
    if (result.object.contentType === 'list_view') {
      isValid = false;
      validationReasons.push('Article is a list view or navigation page');
    }

    // Check organization relevance
    if (result.object.organizationRelevance === 'low') {
      isValid = false;
      validationReasons.push('Article has insufficient content about the organization');
    }

    // Check content type - prefer news but allow high-relevance content
    if (result.object.contentType !== 'news' && 
        result.object.contentType !== 'press_release' && 
        result.object.organizationRelevance !== 'high') {
      isValid = false;
      validationReasons.push('Article is not news content and lacks sufficient organizational focus');
    }

    // Add specific issues from AI analysis
    if (result.object.specificIssues.length > 0) {
      validationReasons.push(...result.object.specificIssues);
    }

    // If valid, add success reason
    if (isValid) {
      validationReasons.push(result.object.reasoning);
    }

    return {
      isValid,
      reasons: validationReasons,
      organizationSentiment: result.object.organizationSentiment,
      contentType: result.object.contentType,
      organizationRelevance: result.object.organizationRelevance,
      publishDateValid
    };

  } catch (error) {
    console.error('Content validation failed:', error);
    return {
      isValid: false,
      reasons: ['Validation analysis failed - defaulting to rejection for safety'],
      organizationSentiment: 'neutral',
      contentType: 'other',
      organizationRelevance: 'low',
      publishDateValid: false
    };
  }
}

/**
 * Detect error pages and hallucinated content that should be immediately rejected
 */
function detectErrorPage(input: ArticleValidationInput): { isValid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const content = input.content.toLowerCase();
  const title = input.title.toLowerCase();
  const summary = input.summary.toLowerCase();
  const url = input.url.toLowerCase();

  // Check for explicit error page indicators
  const errorPatterns = [
    'error 404',
    'page not found',
    'page doesn\'t exist',
    'page does not exist',
    'oops, it looks like',
    'we can\'t find that page',
    'the page you are looking for',
    'sorry, but this page doesn\'t exist',
    'this page is not available',
    'content not found'
  ];

  for (const pattern of errorPatterns) {
    if (content.includes(pattern) || title.includes(pattern) || summary.includes(pattern)) {
      reasons.push(`Article content is an error message, not an actual article`);
      reasons.push(`Detected error pattern: "${pattern}"`);
      return { isValid: false, reasons };
    }
  }

  // Check for hallucinated/generic content patterns
  const genericPatterns = [
    'latest updates from',
    'recent developments and initiatives',
    'continues to focus on innovation',
    'discusses recent developments',
    'this article discusses recent',
    'organization continues to focus'
  ];

  const hasGenericContent = genericPatterns.some(pattern => 
    content.includes(pattern) || title.includes(pattern) || summary.includes(pattern)
  );

  // Check for overly generic titles
  const genericTitles = [
    'latest updates',
    'recent updates',
    'latest news',
    'recent news',
    'updates from',
    'news from'
  ];

  const hasGenericTitle = genericTitles.some(pattern => title.includes(pattern));

  // Check for lack of specific content (too short or too generic)
  const hasSpecificContent = content.length > 300 && (
    /\d{4}/.test(content) || // Contains a year
    /\d{1,2}[\/\-]\d{1,2}/.test(content) || // Contains a date
    /\$[\d,]+/.test(content) || // Contains money amount
    /\d+%/.test(content) || // Contains percentage
    content.match(/[A-Z][a-z]+ [A-Z][a-z]+/) // Contains proper names
  );

  if (hasGenericContent || hasGenericTitle) {
    reasons.push(`Article content appears to be AI-generated or hallucinated`);
    reasons.push(`Detected generic content patterns suggesting fake content`);
  }

  if (!hasSpecificContent && content.length < 500) {
    reasons.push(`Article lacks specific details (names, dates, amounts) suggesting generated content`);
    reasons.push(`Content is too short and generic to be a real news article`);
  }

  // Check for dead link indicators in URL
  if (url.includes('error') || url.includes('404') || url.includes('not-found')) {
    reasons.push(`URL suggests this is an error page`);
  }

  // If we found generic content issues, reject it
  if (reasons.length > 0) {
    reasons.push(`Content appears to be fabricated rather than scraped from actual article`);
    return { isValid: false, reasons };
  }

  return { isValid: true, reasons: [] };
}

/**
 * Check if the published date is after January 1, 2024
 */
function checkPublishDate(publishedAt?: string | null): boolean {
  if (!publishedAt || publishedAt === 'N/A') {
    // If no date provided, we'll be lenient and allow it
    return true;
  }

  try {
    const publishDate = new Date(publishedAt);
    const cutoffDate = new Date('2024-01-01T00:00:00Z');
    
    // Check if date is valid and after cutoff
    return !isNaN(publishDate.getTime()) && publishDate >= cutoffDate;
  } catch {
    // If date parsing fails, allow it (could be a valid recent article with bad date format)
    return true;
  }
}
