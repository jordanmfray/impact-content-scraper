import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

interface ArticleInput {
  title: string
  summary: string
  content: string
}

interface InspirationResult {
  rating: 'low' | 'medium' | 'high'
  reasoning: string
}

/**
 * Standalone function to analyze inspiration level of any article
 * Can be used in pipeline, batch processing, or individual re-analysis
 */
export async function analyzeInspiration(article: ArticleInput): Promise<InspirationResult> {
  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `You are an expert at analyzing nonprofit and impact stories for transformation potential. You help faith-based investors identify which articles contain meaningful stories of change versus basic informational content.`,
      prompt: `Analyze this article for inspirational and transformational content. Consider:

TRANSFORMATIONAL INDICATORS (HIGH rating):
- Personal stories of lives changed or transformed
- Specific examples of people overcoming challenges  
- Measurable impact on communities or individuals
- Stories of hope, breakthrough moments, or dramatic positive change
- Evidence of spiritual, emotional, or material transformation

MODERATELY INSPIRING (MEDIUM rating):
- General positive impact or progress
- Organizational achievements or milestones
- Community improvements without specific personal stories
- Educational or awareness content with some emotional resonance

BASIC INFORMATION (LOW rating):
- Press releases, announcements, or administrative updates
- Financial reports or operational information
- General news without personal impact stories
- Purely factual content without emotional or transformation elements

Title: ${article.title}
Summary: ${article.summary}
Content Preview: ${article.content.substring(0, 3000)}

Rate the inspiration level:`,
      schema: z.object({
        rating: z.enum(['low', 'medium', 'high']),
        reasoning: z.string().describe('Brief explanation of why this rating was assigned')
      }),
    });

    return {
      rating: result.object.rating,
      reasoning: result.object.reasoning
    };
  } catch (error) {
    console.error('Inspiration analysis failed:', error);
    return {
      rating: 'low',
      reasoning: 'Analysis failed, defaulted to low rating'
    };
  }
}
