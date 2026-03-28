"""Review — unreconciled and uncategorized transactions needing attention."""
from datetime import date, timedelta
from fastapi import APIRouter, Query
from app.qbo_client import qbo_get

router = APIRouter(prefix="/review", tags=["review"])

UNCATEGORIZED_KEYWORDS = ("ask my accountant", "uncategorized expense", "uncategorized income")


def _is_uncategorized(account_name: str) -> bool:
    return any(kw in (account_name or "").lower() for kw in UNCATEGORIZED_KEYWORDS)


def _parse_txn(txn: dict, txn_type: str) -> dict:
    lines = txn.get("Line", [])
    accounts = []
    is_uncat = False

    for line in lines:
        detail = (
            line.get("AccountBasedExpenseLineDetail")
            or line.get("ItemBasedExpenseLineDetail")
            or {}
        )
        ref = detail.get("AccountRef", {})
        acct_name = ref.get("name", "")
        if acct_name and acct_name not in accounts:
            accounts.append(acct_name)
        if _is_uncategorized(acct_name):
            is_uncat = True

    # Payee: Purchase uses EntityRef, Check uses PayeeName or EntityRef
    entity = txn.get("EntityRef") or {}
    payee = entity.get("name") or txn.get("PayeeName") or "—"

    qbo_path = "expense" if txn_type == "Purchase" else "check"
    qbo_url = f"https://app.qbo.intuit.com/app/{qbo_path}?txnId={txn['Id']}"

    return {
        "id": txn["Id"],
        "type": txn_type,
        "date": txn.get("TxnDate", ""),
        "payee": payee,
        "amount": float(txn.get("TotalAmt", 0)),
        "accounts": accounts,
        "reconcile_status": txn.get("ReconcileStatus", "N"),
        "memo": (txn.get("PrivateNote") or txn.get("Memo") or "").strip(),
        "is_uncategorized": is_uncat,
        "qbo_url": qbo_url,
    }


@router.get("")
def get_review_items(
    start_date: str = Query(default=None, description="YYYY-MM-DD (defaults to 1 year ago)"),
    end_date: str = Query(default=None, description="YYYY-MM-DD (defaults to today)"),
):
    """Return uncategorized and unreconciled transactions needing attention."""
    if not start_date:
        start_date = (date.today() - timedelta(days=365)).isoformat()
    if not end_date:
        end_date = date.today().isoformat()

    date_filter = f"TxnDate >= '{start_date}' AND TxnDate <= '{end_date}'"
    status_filter = "ReconcileStatus IN ('N', 'C')"

    p_data = qbo_get("query", {
        "query": f"SELECT * FROM Purchase WHERE {date_filter} AND {status_filter} MAXRESULTS 1000"
    })
    c_data = qbo_get("query", {
        "query": f"SELECT * FROM Check WHERE {date_filter} AND {status_filter} MAXRESULTS 1000"
    })

    purchases = p_data.get("QueryResponse", {}).get("Purchase", [])
    checks = c_data.get("QueryResponse", {}).get("Check", [])

    all_txns = (
        [_parse_txn(t, "Purchase") for t in purchases]
        + [_parse_txn(t, "Check") for t in checks]
    )
    all_txns.sort(key=lambda t: t["date"], reverse=True)

    uncategorized = [t for t in all_txns if t["is_uncategorized"]]
    unreconciled  = [t for t in all_txns if not t["is_uncategorized"]]

    return {
        "uncategorized": uncategorized,
        "unreconciled": unreconciled,
        "total_count": len(all_txns),
    }
