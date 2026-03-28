"""Financial reports — P&L, Balance Sheet."""
from fastapi import APIRouter, Query
from app.qbo_client import qbo_get

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/profit-and-loss")
def profit_and_loss(
    start_date: str = Query(description="YYYY-MM-DD"),
    end_date: str = Query(description="YYYY-MM-DD"),
    accounting_method: str = Query(default="Accrual", pattern="^(Accrual|Cash)$"),
):
    """
    Fetch P&L report from QBO.
    Returns the raw QBO report structure plus a flattened rows list for easy frontend use.
    """
    data = qbo_get(
        "reports/ProfitAndLoss",
        {
            "start_date": start_date,
            "end_date": end_date,
            "accounting_method": accounting_method,
            "minorversion": 65,
        },
    )
    return _shape_report(data)


@router.get("/balance-sheet")
def balance_sheet(
    start_date: str = Query(description="YYYY-MM-DD"),
    end_date: str = Query(description="YYYY-MM-DD"),
    accounting_method: str = Query(default="Accrual", pattern="^(Accrual|Cash)$"),
):
    data = qbo_get(
        "reports/BalanceSheet",
        {
            "start_date": start_date,
            "end_date": end_date,
            "accounting_method": accounting_method,
            "minorversion": 65,
        },
    )
    return _shape_report(data)


@router.get("/monthly-summary")
def monthly_summary(
    start_date: str = Query(description="YYYY-MM-DD"),
    end_date: str = Query(description="YYYY-MM-DD"),
    accounting_method: str = Query(default="Accrual", pattern="^(Accrual|Cash)$"),
):
    """Monthly revenue/expense breakdown for bar chart."""
    data = qbo_get(
        "reports/ProfitAndLoss",
        {
            "start_date": start_date,
            "end_date": end_date,
            "accounting_method": accounting_method,
            "summarize_column_by": "Month",
            "minorversion": 65,
        },
    )

    columns = data.get("Columns", {}).get("Column", [])
    month_labels = [
        c["ColTitle"] for c in columns
        if c.get("ColType") == "Money" and c.get("ColTitle") != "Total"
    ]

    revenue_vals: list[float] = []
    expense_vals: list[float] = []

    for row in data.get("Rows", {}).get("Row", []):
        group = row.get("group", "")
        summary = row.get("Summary", {})
        if not summary:
            continue
        col_data = summary.get("ColData", [])
        vals = []
        for c in col_data[1:-1]:  # skip label and Total column
            try:
                vals.append(abs(float(c.get("value") or 0)))
            except ValueError:
                vals.append(0.0)
        if group == "Income":
            revenue_vals = vals
        elif group == "Expenses":
            expense_vals = vals

    n = len(month_labels)
    revenue_vals = (revenue_vals + [0.0] * n)[:n]
    expense_vals = (expense_vals + [0.0] * n)[:n]
    net_vals = [r - e for r, e in zip(revenue_vals, expense_vals)]

    return {
        "months": month_labels,
        "revenue": revenue_vals,
        "expenses": expense_vals,
        "net": net_vals,
    }


def _shape_report(data: dict) -> dict:
    """Flatten QBO report into header metadata + rows list."""
    header = data.get("Header", {})
    columns = [c.get("ColTitle", "") for c in data.get("Columns", {}).get("Column", [])]
    rows = _flatten_rows(data.get("Rows", {}).get("Row", []))

    return {
        "report_name": header.get("ReportName"),
        "start_period": header.get("StartPeriod"),
        "end_period": header.get("EndPeriod"),
        "currency": header.get("Currency", "USD"),
        "columns": columns,
        "rows": rows,
    }


def _flatten_rows(rows: list, depth: int = 0) -> list:
    result = []
    for row in rows:
        row_type = row.get("type", "")
        summary = row.get("Summary")
        header = row.get("Header")
        cols = row.get("ColData", [])

        if header:
            result.append({
                "type": "section_header",
                "depth": depth,
                "label": header.get("ColData", [{}])[0].get("value", ""),
                "values": [],
            })

        if cols:
            result.append({
                "type": row_type or "data",
                "depth": depth,
                "label": cols[0].get("value", "") if cols else "",
                "account_id": cols[0].get("id") if cols else None,
                "values": [c.get("value", "") for c in cols[1:]],
            })

        # Recurse into nested rows
        child_rows = row.get("Rows", {}).get("Row", [])
        if child_rows:
            result.extend(_flatten_rows(child_rows, depth + 1))

        if summary:
            summary_cols = summary.get("ColData", [])
            result.append({
                "type": "section_summary",
                "depth": depth,
                "label": summary_cols[0].get("value", "") if summary_cols else "",
                "values": [c.get("value", "") for c in summary_cols[1:]],
            })

    return result
