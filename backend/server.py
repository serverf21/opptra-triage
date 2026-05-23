from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("opptra")


# ---------- Models ----------
class RecommendRequest(BaseModel):
    skuId: str = Field(..., description="SKU identifier, e.g. SKU-001")
    brand: Optional[str] = None
    ourPrice: float
    competitorPrice: float
    marginFloor: float
    buyBoxStatus: str  # 'won' | 'lost'
    bucket: str        # 'action' | 'opportunity'


class RecommendResponse(BaseModel):
    recommendation: str
    suggestedPrice: float
    source: str  # 'claude' | 'fallback'


# ---------- Helpers ----------
def _fallback_recommendation(req: RecommendRequest) -> RecommendResponse:
    """Deterministic recommendation used when no LLM key is configured."""
    if req.bucket == "action":
        suggested = max(req.competitorPrice - 1, req.marginFloor)
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
    return RecommendResponse(
        recommendation=sentence,
        suggestedPrice=float(suggested),
        source="fallback",
    )


def _llm_api_key() -> Optional[str]:
    """Prefer user-supplied Anthropic key, else fall back to Emergent universal key."""
    own = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    if own:
        return own
    universal = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
    return universal or None


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "opptra-pricing-signal", "status": "ok"}


@api_router.get("/health")
async def health():
    return {
        "ok": True,
        "llm_key_configured": bool(_llm_api_key()),
        "using_own_anthropic_key": bool((os.environ.get("ANTHROPIC_API_KEY") or "").strip()),
    }


@api_router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: RecommendRequest):
    if req.bucket not in {"action", "opportunity"}:
        raise HTTPException(status_code=400, detail="bucket must be 'action' or 'opportunity'")

    api_key = _llm_api_key()
    if not api_key:
        return _fallback_recommendation(req)

    system = (
        "You are a senior pricing analyst for an Indian e-commerce seller. "
        "Reply with EXACTLY ONE plain sentence — no preamble, no lists, no markdown. "
        "The sentence must contain: the specific recommended price in Rupees, the reason, "
        "and the exact margin (recommended price minus margin floor) it produces. "
        "NEVER recommend a price below the margin floor."
    )

    user_prompt = (
        f"{req.skuId} | Our price: Rs.{req.ourPrice:.0f} | "
        f"Competitor: Rs.{req.competitorPrice:.0f} | Margin floor: Rs.{req.marginFloor:.0f} | "
        f"Status: {'Lost buy box' if req.buyBoxStatus == 'lost' else 'Won buy box'} | "
        f"Bucket: {req.bucket}\n\n"
        "Give a single-sentence pricing recommendation: the specific price to set, why, "
        f"and the exact margin it produces. Never recommend below Rs.{req.marginFloor:.0f}."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"opptra-{uuid.uuid4()}",
            system_message=system,
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        text = await chat.send_message(UserMessage(text=user_prompt))
        sentence = (text or "").strip().replace("\n", " ")
        if not sentence:
            raise ValueError("Empty LLM response")

        # Try to parse out a recommended price (first Rs.<number> in the sentence)
        import re
        prices = [float(m.replace(",", "")) for m in re.findall(r"Rs\.?\s*([0-9][0-9,]*\.?\d*)", sentence)]
        suggested = next((p for p in prices if p >= req.marginFloor), req.marginFloor)

        return RecommendResponse(
            recommendation=sentence,
            suggestedPrice=suggested,
            source="claude",
        )
    except Exception as e:
        logger.exception("LLM call failed, returning fallback: %s", e)
        fb = _fallback_recommendation(req)
        # Surface as 200 with fallback so the UI can still render; mark source.
        return fb


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
