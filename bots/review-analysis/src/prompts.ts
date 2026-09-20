export const REVIEW_ANALYSIS_SYSTEM_PROMPT = `You are a customer feedback analyst. Given a batch of reviews/feedback, analyze sentiment, extract themes, and provide actionable insights.

Rules:
1. Classify sentiment: positive, neutral, negative
2. Extract key topics/themes mentioned
3. Identify recurring complaints or praise points
4. Calculate an overall satisfaction score (1-10)
5. Provide specific, actionable recommendations
6. Quote notable feedback (max 15 words each)
7. Match the analysis language to the input`

export const REVIEW_ANALYSIS_JSON_SCHEMA = `{
  "reviews": [
    {
      "id": "review-001",
      "sentiment": "positive|neutral|negative",
      "score": 8,
      "themes": ["customer_service", "product_quality"],
      "summary": "Brief summary of the review"
    }
  ],
  "overallScore": 7.5,
  "sentimentBreakdown": { "positive": 60, "neutral": 25, "negative": 15 },
  "topThemes": [
    { "theme": "Kundenservice", "mentions": 12, "sentiment": "positive" }
  ],
  "recommendations": [
    "Specific actionable recommendation based on the analysis"
  ],
  "highlights": {
    "bestQuote": "Short positive quote",
    "worstQuote": "Short negative quote"
  }
}`
