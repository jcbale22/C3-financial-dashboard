async function apiFetch(path, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

export const api = {
  getBudgets: () => apiFetch('/api/budget'),
  getProfitLoss: (start, end) =>
    apiFetch('/api/reports/profit-and-loss', { start_date: start, end_date: end }),
  getMonthlySummary: (start, end) =>
    apiFetch('/api/reports/monthly-summary', { start_date: start, end_date: end }),
  getBudgetVsActuals: (start, end, budgetId) =>
    apiFetch('/api/budget/vs-actuals', { start_date: start, end_date: end, budget_id: budgetId }),
  getReviewItems: (start, end) =>
    apiFetch('/api/review', { start_date: start, end_date: end }),
}
