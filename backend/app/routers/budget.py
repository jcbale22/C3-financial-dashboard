"""Budget data — fetch budgets and compare to actuals."""
from fastapi import APIRouter, Query
from app.qbo_client import qbo_get

router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("")
def get_budgets():
    """List all budgets."""
    data = qbo_get("query", {"query": "select * from Budget MAXRESULTS 100"})
    budgets = data.get("QueryResponse", {}).get("Budget", [])
    return [
        {
            "id": b.get("Id"),
            "name": b.get("Name"),
            "start_date": b.get("StartDate"),
            "end_date": b.get("EndDate"),
            "budget_type": b.get("BudgetType"),
            "active": b.get("Active", True),
        }
        for b in budgets
    ]


@router.get("/vs-actuals")
def budget_vs_actuals(
    start_date: str = Query(description="YYYY-MM-DD"),
    end_date: str = Query(description="YYYY-MM-DD"),
    budget_id: str = Query(description="Budget ID from /api/budget"),
    accounting_method: str = Query(default="Accrual", pattern="^(Accrual|Cash)$"),
):
    """
    Combine budget line items (from Budget entity) with P&L actuals to produce
    a budget vs. actuals breakdown by account.
    """
    # Fetch budget line items
    budget_data = qbo_get(f"budget/{budget_id}")
    budget = budget_data.get("Budget", {})
    details = budget.get("BudgetDetail", [])

    # Sum budget amounts per account within the date range
    from datetime import date
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)

    budget_by_account: dict[str, dict] = {}
    for item in details:
        item_date = date.fromisoformat(item["BudgetDate"])
        if not (start <= item_date <= end):
            continue
        ref = item.get("AccountRef", {})
        acct_id = ref.get("value")
        acct_name = ref.get("name", "")
        if acct_id not in budget_by_account:
            budget_by_account[acct_id] = {"account_id": acct_id, "account_name": acct_name, "budget": 0.0}
        budget_by_account[acct_id]["budget"] += item.get("Amount", 0)

    # Fetch P&L actuals for the same period
    pl_data = qbo_get(
        "reports/ProfitAndLoss",
        {
            "start_date": start_date,
            "end_date": end_date,
            "accounting_method": accounting_method,
            "minorversion": 65,
        },
    )
    actuals_by_account = _extract_actuals(pl_data.get("Rows", {}).get("Row", []))

    # Fetch all accounts to build numbered fully-qualified names with proper parent hierarchy
    acct_resp = qbo_get("query", {"query": "select * from Account MAXRESULTS 1000"})
    accounts = acct_resp.get("QueryResponse", {}).get("Account", [])
    acct_map = {a["Id"]: a for a in accounts}

    # Merge budget + actuals
    all_account_ids = set(budget_by_account) | set(actuals_by_account)
    rows = []
    for acct_id in all_account_ids:
        b = budget_by_account.get(acct_id, {})
        a = actuals_by_account.get(acct_id, {})
        budget_amt = b.get("budget", 0.0)
        actual_amt = a.get("actual", 0.0)
        variance = actual_amt - budget_amt
        pct = round((actual_amt / budget_amt * 100), 1) if budget_amt else None

        # Use numbered FQN from account list; fall back to whatever the API returned
        fqn = _build_numbered_fqn(acct_id, acct_map)
        account_name = fqn or b.get("account_name") or a.get("account_name", "")

        rows.append({
            "account_id": acct_id,
            "account_name": account_name,
            "budget": budget_amt,
            "actual": actual_amt,
            "variance": variance,
            "percent_of_budget": pct,
        })

    rows.sort(key=lambda r: r["account_name"])

    return {
        "budget_name": budget.get("Name"),
        "start_period": start_date,
        "end_period": end_date,
        "rows": rows,
    }


def _build_numbered_fqn(acct_id: str, acct_map: dict, _depth: int = 0) -> str:
    """
    Recursively build a numbered fully-qualified name.
    e.g. '50000 MINISTRY:53300 STUDENT MINISTRY:53350 Retreats/Camps'
    """
    if _depth > 10 or not acct_id:
        return ""
    acct = acct_map.get(str(acct_id))
    if not acct:
        return ""
    num = (acct.get("AcctNum") or "").strip()
    name = (acct.get("Name") or "").strip()
    display = f"{num} {name}" if num else name
    parent_id = (acct.get("ParentRef") or {}).get("value")
    if parent_id:
        parent_fqn = _build_numbered_fqn(parent_id, acct_map, _depth + 1)
        return f"{parent_fqn}:{display}" if parent_fqn else display
    return display


def _extract_actuals(rows: list, result: dict | None = None) -> dict:
    """Recursively extract actuals from all P&L sections (income + expenses)."""
    if result is None:
        result = {}
    for row in rows:
        cols = row.get("ColData", [])
        if cols and cols[0].get("id"):
            acct_id = cols[0]["id"]
            try:
                amount = float(cols[1]["value"]) if len(cols) > 1 else 0.0
            except (ValueError, KeyError):
                amount = 0.0
            result[acct_id] = {"account_name": cols[0].get("value", ""), "actual": amount}
        child_rows = row.get("Rows", {}).get("Row", [])
        if child_rows:
            _extract_actuals(child_rows, result)
    return result
