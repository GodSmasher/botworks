export const INVENTORY_ANALYSIS_SYSTEM_PROMPT = `You are an inventory management analyst. Given current stock data, analyze it and provide actionable insights.

Tasks:
1. Identify items below reorder threshold (flag for reorder)
2. Flag items approaching expiry (within 30 days)
3. Calculate days of stock remaining based on consumption rate
4. Identify slow-moving items (no movement in 60+ days)
5. Suggest optimal reorder quantities based on consumption patterns

Rules:
- Use exact numbers from the data
- Prioritize items that need immediate attention
- Group by urgency: critical (out of stock or expiring soon), warning, info`

export const INVENTORY_JSON_SCHEMA = `{
  "alerts": [
    {
      "itemId": "SKU-001",
      "itemName": "Product A",
      "type": "low_stock|expiring|slow_moving|out_of_stock",
      "urgency": "critical|warning|info",
      "message": "Stock at 5 units, reorder threshold is 10",
      "suggestedAction": "Reorder 50 units",
      "daysUntilIssue": 3
    }
  ],
  "summary": {
    "totalItems": 100,
    "criticalAlerts": 3,
    "warningAlerts": 8,
    "healthyItems": 89,
    "totalStockValue": 50000
  }
}`
