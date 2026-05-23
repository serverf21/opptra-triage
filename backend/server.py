from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from openai import AsyncOpenAI  # noqa: E402

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("opptra")


# ---------- Models ----------
class PricingContextPayload(BaseModel):
    summaryForLlm: Optional[str] = None
    suggestedBumpPct: float = 0
    historicalSummary: Optional[str] = None
    marketSummary: Optional[str] = None
    crossPlatformSummary: Optional[str] = None
    inventorySummary: Optional[str] = None
    inventoryPressure: bool = False
    shouldReorderEarly: bool = False
    inSaleWindow: bool = False
    alerts: List[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    skuId: str = Field(..., description="SKU identifier, e.g. SKU-001")
    brand: Optional[str] = None
    ourPrice: float
    competitorPrice: float
    marginFloor: float
    buyBoxStatus: str  # 'won' | 'lost'
    bucket: str        # 'action' | 'opportunity'
    listingPlatform: Optional[str] = "flipkart"
    pricingContext: Optional[PricingContextPayload] = None


class RecommendResponse(BaseModel):
    recommendation: str
    suggestedPrice: float
    source: str  # 'openai' | 'fallback'
    adjustmentsApplied: List[str] = Field(default_factory=list)
    alerts: List[str] = Field(default_factory=list)


# ---------- Helpers ----------
def _apply_inventory_bump(
    base_price: float, margin_floor: float, bump_pct: float
) -> Tuple[float, Optional[str]]:
    if bump_pct <= 0:
        return base_price, None
    bumped = round(base_price * (1 + bump_pct / 100))
    final = max(bumped, margin_floor)
    note = f"+{bump_pct}% inventory premium applied (Rs.{base_price:.0f} → Rs.{final:.0f})"
    return final, note


def _context_alerts(ctx: Optional[PricingContextPayload]) -> List[str]:
    if not ctx:
        return []
    return list(ctx.alerts or [])


def _fallback_recommendation(req: RecommendRequest) -> RecommendResponse:
    """Deterministic recommendation with optional inventory / sale context."""
    ctx = req.pricingContext
    bump_pct = ctx.suggestedBumpPct if ctx else 0
    adjustments: List[str] = []
    alerts = _context_alerts(ctx)

    if req.bucket == "action":
        suggested = max(req.competitorPrice - 1, req.marginFloor)
        if ctx and ctx.inSaleWindow:
            adjustments.append("Sale window active — competitive match prioritized.")
        margin = suggested - req.marginFloor
        sentence = (
            f"Reprice to Rs.{suggested:.0f} (Re.1 below competitor) to reclaim the buy box, "
            f"yielding Rs.{margin:.0f} of margin above your floor."
        )
    else:  # opportunity
        suggested = round(min(req.competitorPrice - 1, req.ourPrice * 1.04))
        suggested = max(suggested, req.ourPrice + 1)
        margin = suggested - req.marginFloor
        sentence = (
            f"Raise price to Rs.{suggested:.0f} — still undercuts competitor while expanding margin to Rs.{margin:.0f}."
        )

    base = float(suggested)
    final, bump_note = _apply_inventory_bump(base, req.marginFloor, bump_pct)
    if bump_note:
        adjustments.append(bump_note)
        margin = final - req.marginFloor
        sentence = (
            f"{sentence} With stock pressure, consider Rs.{final:.0f} "
            f"(+{bump_pct}% premium, margin Rs.{margin:.0f})."
        )

    if ctx and ctx.shouldReorderEarly:
        alerts.append(
            "Replenishment recommended earlier than scheduled — consumption exceeds inbound rate."
        )

    return RecommendResponse(
        recommendation=sentence,
        suggestedPrice=final,
        source="fallback",
        adjustmentsApplied=adjustments,
        alerts=alerts,
    )


def _openai_api_key() -> Optional[str]:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    return key or None


def _prompts(req: RecommendRequest) -> Tuple[str, str]:
    ctx = req.pricingContext
    context_block = ""
    if ctx and ctx.summaryForLlm:
        context_block = f"\n\nPricing intelligence:\n{ctx.summaryForLlm}"

    system = (
        "You are a senior pricing analyst for an Indian e-commerce seller on Flipkart/Amazon. "
        "Use historical trends, marketplace sale calendars, cross-platform competitor prices, "
        "and inventory pressure when relevant. "
        "Reply with EXACTLY ONE plain sentence — no preamble, no lists, no markdown. "
        "The sentence must contain: the specific recommended price in Rupees, the reason, "
        "and the exact margin (recommended price minus margin floor) it produces. "
        "NEVER recommend a price below the margin floor. "
        "If inventory pressure is noted, you may suggest a modest premium above a competitive price."
    )
    user_prompt = (
        f"{req.skuId} | Listing: {req.listingPlatform or 'flipkart'} | "
        f"Our price: Rs.{req.ourPrice:.0f} | "
        f"Competitor: Rs.{req.competitorPrice:.0f} | Margin floor: Rs.{req.marginFloor:.0f} | "
        f"Status: {'Lost buy box' if req.buyBoxStatus == 'lost' else 'Won buy box'} | "
        f"Bucket: {req.bucket}"
        f"{context_block}\n\n"
        "Give a single-sentence pricing recommendation: the specific price to set, why, "
        f"and the exact margin it produces. Never recommend below Rs.{req.marginFloor:.0f}."
    )
    return system, user_prompt


def _finalize_response(
    text: str, req: RecommendRequest, source: str
) -> RecommendResponse:
    sentence = (text or "").strip().replace("\n", " ")
    if not sentence:
        raise ValueError("Empty LLM response")

    prices = [
        float(m.replace(",", ""))
        for m in re.findall(r"Rs\.?\s*([0-9][0-9,]*\.?\d*)", sentence)
    ]
    suggested = next((p for p in prices if p >= req.marginFloor), req.marginFloor)

    ctx = req.pricingContext
    bump_pct = ctx.suggestedBumpPct if ctx else 0
    adjustments: List[str] = []
    alerts = _context_alerts(ctx)

    final, bump_note = _apply_inventory_bump(suggested, req.marginFloor, bump_pct)
    if bump_note:
        adjustments.append(bump_note)

    if ctx and ctx.shouldReorderEarly:
        alerts.append(
            "Replenishment recommended earlier than scheduled — consumption exceeds inbound rate."
        )

    return RecommendResponse(
        recommendation=sentence,
        suggestedPrice=final,
        source=source,
        adjustmentsApplied=adjustments,
        alerts=alerts,
    )


async def _call_openai(api_key: str, system: str, user_prompt: str) -> str:
    model = (os.environ.get("OPENAI_MODEL") or "gpt-4o-mini").strip()
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=256,
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "opptra-pricing-signal", "status": "ok"}


@api_router.get("/health")
async def health():
    configured = _openai_api_key() is not None
    return {
        "ok": True,
        "llm_key_configured": configured,
        "provider": "openai" if configured else None,
    }


@api_router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest):
    if req.bucket not in {"action", "opportunity"}:
        raise HTTPException(status_code=400, detail="bucket must be 'action' or 'opportunity'")

    api_key = _openai_api_key()
    if not api_key:
        return _fallback_recommendation(req)

    system, user_prompt = _prompts(req)

    try:
        text = await _call_openai(api_key, system, user_prompt)
        return _finalize_response(text, req, "openai")
    except Exception as e:
        logger.exception("LLM call failed, returning fallback: %s", e)
        return _fallback_recommendation(req)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
