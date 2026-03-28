"""Chart of accounts — hierarchical account tree."""
from fastapi import APIRouter
from app.qbo_client import qbo_get

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("")
def get_accounts():
    """Return all active accounts with parent/child hierarchy info."""
    data = qbo_get("query", {"query": "select * from Account where Active = true MAXRESULTS 1000"})
    accounts = data.get("QueryResponse", {}).get("Account", [])

    def shape(acct):
        return {
            "id": acct.get("Id"),
            "name": acct.get("Name"),
            "fully_qualified_name": acct.get("FullyQualifiedName"),
            "account_type": acct.get("AccountType"),
            "account_sub_type": acct.get("AccountSubType"),
            "classification": acct.get("Classification"),
            "account_number": acct.get("AcctNum"),
            "parent_id": acct.get("ParentRef", {}).get("value"),
            "current_balance": acct.get("CurrentBalance", 0),
            "active": acct.get("Active", True),
        }

    return [shape(a) for a in accounts]
