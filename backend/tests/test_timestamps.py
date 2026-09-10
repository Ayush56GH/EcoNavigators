"""
Regression tests for the timestamp handling pipeline.

CRITICAL BUG REGRESSION:
  Old code: if dt.year > 2024: dt = dt.replace(year=2024)
  Fixed:    timestamps are NEVER mutated.

These tests MUST PASS to confirm the bug is fixed.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
import pytest
from sar_pipeline.copernicus_service import parse_timestamp


class TestTimestampNeverMutated:

    def test_2026_stays_2026(self):
        """REGRESSION: 2026 timestamp must not become 2024."""
        ts = "2026-08-20T14:35:00Z"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.year == 2026, (
            f"YEAR MUTATION BUG: 2026 was changed to {result.year}"
        )

    def test_2025_stays_2025(self):
        ts = "2025-03-15T08:00:00Z"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.year == 2025

    def test_2024_stays_2024(self):
        ts = "2024-11-01T00:00:00Z"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.year == 2024

    def test_full_datetime_preserved(self):
        """All components of the timestamp must be preserved."""
        ts = "2026-08-20T14:35:27Z"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.year   == 2026
        assert result.month  == 8
        assert result.day    == 20
        assert result.hour   == 14
        assert result.minute == 35
        assert result.second == 27

    def test_timezone_converted_to_utc(self):
        from datetime import timezone as tz
        ts = "2026-08-20T14:35:00+05:30"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.tzinfo is not None
        # Offset +05:30 means UTC+5.5h. Convert explicitly and verify UTC hour.
        result_utc = result.astimezone(tz.utc)
        assert result_utc.hour == 9,  f"UTC hour should be 9 but got {result_utc.hour}"
        assert result_utc.minute == 5, f"UTC minute should be 5 but got {result_utc.minute}"
        assert result_utc.year  == 2026

    def test_naive_timestamp_treated_as_utc(self):
        ts = "2026-08-20 14:35:00"
        result = parse_timestamp(ts)
        assert result is not None
        assert result.tzinfo is not None
        assert result.year == 2026

    def test_none_returns_none(self):
        result = parse_timestamp(None)
        assert result is None

    def test_invalid_string_returns_none(self):
        result = parse_timestamp("not_a_date")
        assert result is None

    def test_unix_timestamp(self):
        # 2026-06-15 00:00:00 UTC
        unix_ts = 1781481600
        result = parse_timestamp(unix_ts)
        assert result is not None
        assert result.year == 2026
        assert result.month == 6

    def test_datetime_object_passthrough(self):
        dt = datetime(2026, 8, 20, 14, 35, tzinfo=timezone.utc)
        result = parse_timestamp(dt)
        assert result == dt

    def test_date_only_string(self):
        result = parse_timestamp("2026-08-20")
        assert result is not None
        assert result.year == 2026
        assert result.month == 8
        assert result.day == 20
