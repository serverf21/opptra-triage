"""Backend tests for Opptra Pricing Signal Tool.

Covers: health endpoint, /api/recommend with action/opportunity buckets,
and validation of invalid bucket values.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://opptra-triage.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health ----
class TestHealth:
    def test_health_ok(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("llm_key_configured") is True


# ---- Recommend ----
class TestRecommend:
    def test_recommend_action(self, api_client):
        payload = {
            "skuId": "SKU-001",
            "brand": "Aurelio",
            "ourPrice": 1299,
            "competitorPrice": 1199,
            "marginFloor": 1050,
            "buyBoxStatus": "lost",
            "bucket": "action",
        }
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("recommendation"), str)
        assert len(d["recommendation"]) > 5
        # one sentence (roughly)
        assert d["recommendation"].count(".") <= 4
        assert d.get("source") in {"claude", "fallback"}
        assert isinstance(d.get("suggestedPrice"), (int, float))
        assert d["suggestedPrice"] >= payload["marginFloor"]

    def test_recommend_opportunity(self, api_client):
        payload = {
            "skuId": "SKU-006",
            "brand": "Brio",
            "ourPrice": 749,
            "competitorPrice": 999,
            "marginFloor": 600,
            "buyBoxStatus": "won",
            "bucket": "opportunity",
        }
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d.get("source") in {"claude", "fallback"}
        assert d["suggestedPrice"] >= payload["marginFloor"]
        assert isinstance(d.get("recommendation"), str) and len(d["recommendation"]) > 5

    def test_recommend_invalid_bucket(self, api_client):
        payload = {
            "skuId": "SKU-007",
            "brand": "Lumen",
            "ourPrice": 449,
            "competitorPrice": 399,
            "marginFloor": 420,
            "buyBoxStatus": "lost",
            "bucket": "blocked",
        }
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=30)
        assert r.status_code == 400

    def test_recommend_missing_field(self, api_client):
        payload = {
            "skuId": "SKU-001",
            "ourPrice": 1299,
            "bucket": "action",
        }
        r = api_client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=30)
        assert r.status_code == 422
