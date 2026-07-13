"""Unit tests for pure helper functions in app.routers.budget.

All tests operate on plain Python dicts — no QBO network calls, no FastAPI
app wiring, no database.  The functions under test are:
  - _build_numbered_fqn()
  - _extract_actuals()
  - _extract_bs_balances()
  - principal_payments reduction logic (extracted inline)
  - token expiry helpers in app.tokens
"""
import time
import pytest

from app.routers.budget import (
    _build_numbered_fqn,
    _extract_actuals,
    _extract_bs_balances,
)
from app.tokens import is_token_expired


# ────────────────────────────────────────────────────────────────────────────
# _build_numbered_fqn
# ────────────────────────────────────────────────────────────────────────────

class TestBuildNumberedFqn:
    def _acct_map(self):
        """Minimal account map: parent 60000 OPERATIONS, child 61000 TECHNOLOGY."""
        return {
            "1": {"Id": "1", "AcctNum": "60000", "Name": "OPERATIONS", "ParentRef": None},
            "2": {"Id": "2", "AcctNum": "61000", "Name": "TECHNOLOGY", "ParentRef": {"value": "1"}},
            "3": {"Id": "3", "AcctNum": "",       "Name": "Misc",       "ParentRef": {"value": "1"}},
        }

    def test_top_level_account_with_number(self):
        result = _build_numbered_fqn("1", self._acct_map())
        assert result == "60000 OPERATIONS"

    def test_child_account_builds_path(self):
        result = _build_numbered_fqn("2", self._acct_map())
        assert result == "60000 OPERATIONS:61000 TECHNOLOGY"

    def test_child_without_acct_num_uses_name_only(self):
        result = _build_numbered_fqn("3", self._acct_map())
        assert result == "60000 OPERATIONS:Misc"

    def test_unknown_account_returns_empty_string(self):
        result = _build_numbered_fqn("999", self._acct_map())
        assert result == ""

    def test_empty_acct_id_returns_empty_string(self):
        result = _build_numbered_fqn("", self._acct_map())
        assert result == ""

    def test_depth_guard_prevents_infinite_loop(self):
        """Self-referencing parent should not blow the stack."""
        circular = {"1": {"Id": "1", "AcctNum": "10000", "Name": "Loop", "ParentRef": {"value": "1"}}}
        result = _build_numbered_fqn("1", circular)
        # Any non-crash result is acceptable; depth guard kicks in
        assert isinstance(result, str)


# ────────────────────────────────────────────────────────────────────────────
# _extract_actuals
# ────────────────────────────────────────────────────────────────────────────

class TestExtractActuals:
    def _leaf_row(self, acct_id, name, amount):
        return {
            "ColData": [
                {"id": acct_id, "value": name},
                {"value": str(amount)},
            ],
            "Rows": {},
        }

    def _section_row(self, children):
        return {"ColData": [], "Rows": {"Row": children}}

    def test_single_flat_row(self):
        rows = [self._leaf_row("100", "Tithes", 50000.0)]
        result = _extract_actuals(rows)
        assert result["100"]["actual"] == 50000.0
        assert result["100"]["account_name"] == "Tithes"

    def test_nested_rows_are_flattened(self):
        child = self._leaf_row("200", "Events", 1200.50)
        rows = [self._section_row([child])]
        result = _extract_actuals(rows)
        assert "200" in result
        assert result["200"]["actual"] == 1200.50

    def test_deeply_nested(self):
        inner = self._leaf_row("300", "Supplies", 99.0)
        mid   = self._section_row([inner])
        outer = self._section_row([mid])
        result = _extract_actuals([outer])
        assert result["300"]["actual"] == 99.0

    def test_invalid_amount_defaults_to_zero(self):
        row = {"ColData": [{"id": "400", "value": "Misc"}, {"value": "N/A"}], "Rows": {}}
        result = _extract_actuals([row])
        assert result["400"]["actual"] == 0.0

    def test_row_without_id_is_ignored(self):
        row = {"ColData": [{"value": "Header"}, {"value": "9999"}], "Rows": {}}
        result = _extract_actuals([row])
        assert result == {}

    def test_empty_rows_returns_empty(self):
        assert _extract_actuals([]) == {}

    def test_multiple_rows_accumulated(self):
        rows = [
            self._leaf_row("10", "Salaries", 200000.0),
            self._leaf_row("11", "Benefits",  30000.0),
        ]
        result = _extract_actuals(rows)
        assert len(result) == 2
        assert result["10"]["actual"] == 200000.0
        assert result["11"]["actual"] == 30000.0


# ────────────────────────────────────────────────────────────────────────────
# _extract_bs_balances
# ────────────────────────────────────────────────────────────────────────────

class TestExtractBsBalances:
    def _leaf_row(self, acct_id, name, balance):
        return {
            "ColData": [
                {"id": acct_id, "value": name},
                {"value": str(balance)},
            ],
            "Rows": {},
        }

    def test_extracts_single_balance(self):
        rows = [self._leaf_row("500", "Mortgage Payable", 1_200_000.0)]
        result = _extract_bs_balances(rows)
        assert result["500"]["balance"] == 1_200_000.0
        assert result["500"]["name"] == "Mortgage Payable"

    def test_nested_balance_sheet_rows(self):
        child = self._leaf_row("501", "Note Payable", 75_000.0)
        rows = [{"ColData": [], "Rows": {"Row": [child]}}]
        result = _extract_bs_balances(rows)
        assert result["501"]["balance"] == 75_000.0

    def test_empty_input(self):
        assert _extract_bs_balances([]) == {}

    def test_invalid_balance_defaults_to_zero(self):
        row = {"ColData": [{"id": "600", "value": "Misc"}, {"value": "—"}], "Rows": {}}
        result = _extract_bs_balances([row])
        assert result["600"]["balance"] == 0.0


# ────────────────────────────────────────────────────────────────────────────
# Principal payments reduction logic
# ────────────────────────────────────────────────────────────────────────────

class TestPrincipalPaymentsLogic:
    """Tests the core arithmetic: reduction in liability = principal paid."""

    def _compute(self, prior_balances, end_balances, loan_ids):
        principal_paid = 0.0
        breakdown = []
        for acct_id in loan_ids:
            prior = prior_balances.get(acct_id, {})
            end   = end_balances.get(acct_id, {})
            prior_bal = prior.get("balance", 0.0)
            end_bal   = end.get("balance", 0.0)
            paid = prior_bal - end_bal
            if paid != 0 or prior_bal != 0:
                breakdown.append({
                    "account_id": acct_id,
                    "opening_balance": prior_bal,
                    "closing_balance": end_bal,
                    "principal_paid": paid,
                })
                principal_paid += max(paid, 0)
        return principal_paid, breakdown

    def test_simple_reduction(self):
        prior = {"1": {"balance": 1_000_000.0, "name": "Mortgage"}}
        end   = {"1": {"balance":   994_000.0, "name": "Mortgage"}}
        paid, breakdown = self._compute(prior, end, {"1"})
        assert paid == 6_000.0
        assert breakdown[0]["principal_paid"] == 6_000.0

    def test_balance_increase_counts_as_zero_principal(self):
        """If liability balance went up (draw on line of credit), paid = 0."""
        prior = {"1": {"balance": 500_000.0, "name": "LOC"}}
        end   = {"1": {"balance": 510_000.0, "name": "LOC"}}
        paid, _ = self._compute(prior, end, {"1"})
        assert paid == 0.0

    def test_multiple_loans_summed(self):
        prior = {
            "1": {"balance": 1_000_000.0},
            "2": {"balance":   200_000.0},
        }
        end = {
            "1": {"balance": 994_000.0},
            "2": {"balance": 198_000.0},
        }
        paid, _ = self._compute(prior, end, {"1", "2"})
        assert paid == 8_000.0

    def test_zero_balance_account_excluded_from_breakdown(self):
        prior = {"1": {"balance": 0.0}, "2": {"balance": 0.0}}
        end   = {"1": {"balance": 0.0}, "2": {"balance": 0.0}}
        paid, breakdown = self._compute(prior, end, {"1", "2"})
        assert paid == 0.0
        assert breakdown == []

    def test_account_not_in_end_balances_uses_zero(self):
        """Account fully paid off during period — not in end BS response."""
        prior = {"1": {"balance": 5_000.0, "name": "SmallNote"}}
        paid, breakdown = self._compute(prior, {}, {"1"})
        assert paid == 5_000.0


# ────────────────────────────────────────────────────────────────────────────
# Token expiry (app.tokens)
# ────────────────────────────────────────────────────────────────────────────

class TestIsTokenExpired:
    def test_expired_token(self):
        token = {"expires_at": time.time() - 100}
        assert is_token_expired(token) is True

    def test_valid_token(self):
        token = {"expires_at": time.time() + 3600}
        assert is_token_expired(token) is False

    def test_within_buffer_window_is_expired(self):
        """Token with 30s left should be considered expired (60s buffer)."""
        token = {"expires_at": time.time() + 30}
        assert is_token_expired(token) is True

    def test_just_outside_buffer_is_valid(self):
        """Token with 90s left should still be valid."""
        token = {"expires_at": time.time() + 90}
        assert is_token_expired(token) is False

    def test_missing_expires_at_is_expired(self):
        assert is_token_expired({}) is True
