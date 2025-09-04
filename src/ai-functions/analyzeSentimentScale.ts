import { openai } from '@/lib/openai'
import { z } from 'zod'

const sentimentAnalysisSchema = z.object({
  sentimentScore: z.number().int().min(-1).max(3).describe('Sentiment score from -1 to 3'),
  reasoning: z.string().describe('Detailed explanation for the sentiment score'),
  organizationMentions: z.array(z.string()).describe('Direct quotes or mentions of the organization'),
  mainFocus: z.string().describe('What is the main focus/topic of the article'),
  socialImpactIndicators: z.array(z.string()).describe('Evidence of social impact content if applicable')
})

export type SentimentAnalysisResult = z.infer<typeof sentimentAnalysisSchema>

export async function analyzeSentimentScale(
  content: string, 
  organizationName: string,
  title?: string
): Promise<SentimentAnalysisResult> {
  
  const prompt = `
You are analyzing an article about "${organizationName}" to determine organizational sentiment and relevance.

SENTIMENT SCALE:
-1: Organization is mentioned NEGATIVELY (criticism, scandal, negative impact, problems caused by org)
 0: Organization is NOT MENTIONED or only mentioned in passing/context
 1: Organization is mentioned but NOT the main focus (brief mention, quoted source, etc.)
 2: Organization IS the main focus and article is INFORMATIONAL (facts, updates, general news about org)
 3: Organization IS the main focus and article is about their SOCIAL IMPACT (inspiring stories, impact work, positive change they're creating)

ARTICLE TITLE: ${title || 'N/A'}

ARTICLE CONTENT:
${content}

ANALYSIS INSTRUCTIONS:
1. Look for direct mentions of "${organizationName}" in the content
2. Determine if mentions are positive, negative, or neutral
3. Assess if the organization is the main subject or just mentioned in passing
4. For score 3: Look for evidence of social impact, positive change, inspiring stories, beneficiaries helped, etc.
5. For score 2: Informational content about the org (leadership changes, financial reports, general updates)
6. For score 1: Brief mentions, quotes from org representatives, or context mentions
7. For score 0: No meaningful mention of the organization
8. For score -1: Negative coverage, criticism, scandals, or problems

Be STRICT with scoring:
- Only use 3 if there's clear evidence of INSPIRING SOCIAL IMPACT content
- Only use 2 if the org is clearly the MAIN FOCUS but it's informational
- Use 1 for mentions that aren't the main focus
- Use 0 if there's truly no meaningful mention
- Use -1 only for genuinely negative coverage
`

  try {
    console.log(`🧠 Analyzing sentiment for ${organizationName}...`)
    
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert content analyst specializing in organizational sentiment analysis and social impact assessment.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'sentiment_analysis',
          schema: sentimentAnalysisSchema,
        }
      },
      temperature: 0.1
    })

    const result = completion.choices[0].message.parsed

    if (!result) {
      throw new Error('Failed to parse sentiment analysis response')
    }

    console.log(`✅ Sentiment analysis complete: ${result.sentimentScore} (${result.reasoning.substring(0, 100)}...)`)
    
    return result

  } catch (error) {
    console.error('Sentiment analysis error:', error)
    
    // Fallback analysis
    const contentLower = content.toLowerCase()
    const orgLower = organizationName.toLowerCase()
    const orgMentioned = contentLower.includes(orgLower)
    
    let fallbackScore = 0
    let fallbackReasoning = 'Automated fallback analysis: '
    
    if (!orgMentioned) {
      fallbackScore = 0
      fallbackReasoning += 'Organization not mentioned in content'
    } else {
      // Simple keyword-based fallback
      const negativeWords = ['scandal', 'criticism', 'problem', 'issue', 'controversy', 'failed', 'wrong']
      const impactWords = ['impact', 'helped', 'lives', 'change', 'benefit', 'transform', 'empower', 'support']
      
      const hasNegative = negativeWords.some(word => contentLower.includes(word))
      const hasImpact = impactWords.some(word => contentLower.includes(word))
      
      if (hasNegative) {
        fallbackScore = -1
        fallbackReasoning += 'Detected negative keywords in content'
      } else if (hasImpact) {
        fallbackScore = 2
        fallbackReasoning += 'Detected social impact keywords in content'
      } else {
        fallbackScore = 1
        fallbackReasoning += 'Organization mentioned without clear sentiment indicators'
      }
    }
    
    return {
      sentimentScore: fallbackScore,
      reasoning: fallbackReasoning,
      organizationMentions: orgMentioned ? [`Organization mentioned in content`] : [],
      mainFocus: 'Unable to determine due to analysis error',
      socialImpactIndicators: []
    }
  }
}
