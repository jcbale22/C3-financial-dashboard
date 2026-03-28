export function parseProfitLoss(data) {
  const empty = { totalRevenue: 0, totalExpenses: 0, netIncome: 0, expenseCategories: [] }
  if (!data?.rows) return empty

  let totalRevenue = 0
  let totalExpenses = 0
  let netIncome = 0
  const expenseCategories = []

  let inRevenue = false
  let inExpenses = false

  for (const row of data.rows) {
    const label = (row.label || '').toLowerCase()
    const raw = row.values?.[0]
    const value = raw !== undefined ? Math.abs(parseFloat(String(raw).replace(/,/g, '')) || 0) : 0

    if (row.type === 'section_header' && row.depth === 0) {
      inRevenue = label.includes('revenue') || label.includes('income')
      inExpenses = label.includes('expense') || label.includes('expenditure')
    }

    if (row.type === 'section_summary') {
      if (row.depth === 0 && inRevenue) {
        totalRevenue = value
        inRevenue = false
      } else if (row.depth === 0 && inExpenses) {
        totalExpenses = value
        inExpenses = false
      } else if (row.depth === 1 && inExpenses && value > 0) {
        expenseCategories.push({
          // Strip "Total " prefix and leading account numbers for clean chart labels
          name: (row.label || '').replace(/^Total\s+/i, '').replace(/^\d+\s+/, ''),
          value,
        })
      }
    }

    // QBO uses various labels depending on org setup
    if (
      label.includes('net income') ||
      label.includes('net loss') ||
      label.includes('net operating revenue') ||
      label.includes('net revenue')
    ) {
      const rawNet = row.values?.[0]
      const parsed = rawNet !== undefined ? parseFloat(String(rawNet).replace(/,/g, '')) || 0 : 0
      // Take the last match so we get the bottom-line figure
      if (parsed !== 0) netIncome = parsed
    }
  }

  if (netIncome === 0 && (totalRevenue || totalExpenses)) {
    netIncome = totalRevenue - totalExpenses
  }

  return { totalRevenue, totalExpenses, netIncome, expenseCategories }
}
