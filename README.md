# Opptra Pricing Signal

A **pricing decision tool** for Indian e-commerce pricing operations. An operator opens the app, sees which SKUs need attention, reviews **historical, calendar, cross-platform, and inventory signals**, gets a one-sentence AI recommendation, and applies it in under a minute.

---

## Your pricing approach — what’s implemented

| # | Your factor | Status | How it works locally |
|---|-------------|--------|---------------------|
| 1 | **Historical data (~1 year)** | Mock | Per-SKU `historical12m` in `skus.js` (avg/min/max, YoY trend, peak season). Compared to current price in UI + LLM prompt. |
| 2 | **Sale days & festivals** | Mock calendar | `marketCalendar.js` — Flipkart BBD, Amazon Prime Day, Diwali, Summer Sale, etc. Banner in triage bar; factored into recommendations. |
| 3 | **Cross-platform competitors** | Mock | `crossPlatform.amazon` / `meesho` vs Flipkart listing. Alerts when off-platform undercuts you. |
| 4 | **Inventory pressure** | Mock | `inventory.dailySales` vs `dailyInbound`. If consumption > replenishment → price bump % + **reorder alert** when stock runs out before next PO. |

**Not in scope for local MVP:** live APIs to Flipkart/Amazon/Meesho, warehouse systems, or real 12-month price feeds. Those would replace the mock fields in `skus.js` and `marketCalendar.js`.

---

## What it does

| Aspect | Description |
|--------|-------------|
| **Triage** | Classifies each SKU: action / opportunity / blocked / ok |
| **Pricing intelligence** | Four signal chips per row + alert lines |
| **AI recommendations** | OpenAI uses full context; fallback rules use same signals |
| **Inventory premium** | Backend adds up to +8% on suggested price when stock pressure is high |
| **Apply** | One-click repriced state (browser memory only) |
| **Blocked** | SKU-007: competitor below margin floor — no AI, no Apply |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  React frontend (localhost:3000)                                         │
│  skus.js + marketCalendar.js → pricingContext.js → triage.js             │
│  TriageBar · SkuRow · PricingSignals · AiRecommendation                  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ POST /api/recommend (+ pricingContext)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FastAPI (localhost:8000)                                              │
│  OpenAI + inventory bump + fallback rules                                │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
                          OpenAI API (optional)
```

---

## End-to-end flow (ASCII)

```
                         ┌──────────────────┐
                         │  User opens app  │
                         └────────┬─────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────────────┐
              │  Load SKUs + mock historical / inventory  │
              │  Load marketplace calendar (sale/festive)   │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │  pricingContext.js — per SKU:             │
              │   ① 12m price vs current                  │
              │   ② active/upcoming sale events           │
              │   ③ Amazon + Meesho vs Flipkart comp      │
              │   ④ sales/day vs inbound/day + alerts     │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │  triage.js — bucket + attach context      │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │  TriageBar — counts, filters, sale banner   │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │  SkuRow — prices, buy box, signals, AI    │
              └─────────────────────┬─────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │ blocked │ action/opportunity │ ok
                    ▼         ▼                    ▼
              [lock msg]  POST /api/recommend    [hold]
                          + pricingContext
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              [OpenAI + context]              [fallback rules]
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
              ┌───────────────────────────────────────────┐
              │  Apply inventory bump % if pressure       │
              │  Return price + recommendation + alerts   │
              └─────────────────────┬─────────────────────┘
                                    ▼
              ┌───────────────────────────────────────────┐
              │  User Apply → repriced (session only)     │
              └───────────────────────────────────────────┘
```

---

## Pricing intelligence detail

### ① Historical (12 months)

- Fields: `avgPrice`, `minPrice`, `maxPrice`, `yoyTrendPct`, `peakSeason`
- UI chip: trend + % vs 12m average
- Used in LLM prompt as `historicalSummary`

### ② Marketplace calendar

- File: `frontend/src/data/marketCalendar.js`
- Detects **active** or **upcoming** (21-day lookahead) events for the SKU’s `listingPlatform`
- May 2026 demo: **Summer Sale** often shows as active
- Sale window → competitive pricing guidance in fallback + prompt

### ③ Cross-platform prices

- `crossPlatform.amazon`, `crossPlatform.meesho` vs Flipkart `competitorPrice`
- Alert if Amazon/Meesho undercuts your listing by ≥5%

### ④ Inventory / overbuying

- `dailySales` (consumption) vs `dailyInbound` (replenishment)
- If **sales > inbound** → `inventoryPressure`, `suggestedBumpPct` (3–8%)
- If **days of stock < days until next replenishment** → early reorder alert
- Backend applies bump to `suggestedPrice` after base recommendation

**Demo SKUs with stock pressure:** SKU-002, SKU-005 (high sales, low inbound).

---

## Triage rules (unchanged core)

```
START
  ├─ competitorPrice <= marginFloor ──────────────► BLOCKED
  ├─ buy box LOST and (ourPrice - 1) > marginFloor ► ACTION
  ├─ buy box WON and competitor > 5% above ourPrice ► OPPORTUNITY
  └─ else ────────────────────────────────────────► OK
```

Pricing intelligence **does not change the bucket**; it enriches recommendations and alerts.

---

## API

### `POST /api/recommend`

```json
{
  "skuId": "SKU-002",
  "ourPrice": 4499,
  "competitorPrice": 4250,
  "marginFloor": 3800,
  "buyBoxStatus": "lost",
  "bucket": "action",
  "listingPlatform": "flipkart",
  "pricingContext": {
    "summaryForLlm": "...",
    "suggestedBumpPct": 6,
    "inventoryPressure": true,
    "shouldReorderEarly": true,
    "inSaleWindow": true,
    "alerts": ["..."]
  }
}
```

### Response

```json
{
  "recommendation": "Reprice to Rs.4249 ...",
  "suggestedPrice": 4505,
  "source": "openai",
  "adjustmentsApplied": ["+6% inventory premium applied (Rs.4249 → Rs.4505)"],
  "alerts": ["Replenishment recommended earlier than scheduled..."]
}
```

---

## Execution commands

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm (or pnpm 9 if on Node 18 — avoid pnpm 10+ unless Node 22+)

---

### First-time setup

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set your key:

```env
OPENAI_API_KEY=sk-your-key-here
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env
```

Ensure `frontend/.env` contains:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

---

### Run the app (two terminals)

**Terminal 1 — API (keep running)**

```bash
cd backend
source .venv/bin/activate
.venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Use `.venv/bin/uvicorn` so you do not hit the system Python (missing `openai`).

**Terminal 2 — UI (keep running)**

```bash
cd frontend
npm start
```

| What | URL |
|------|-----|
| App | http://localhost:3000 |
| API health | http://localhost:8000/api/health |
| API root | http://localhost:8000/api/ |

---

### Alternative: frontend with pnpm (Node 18)

```bash
npm install -g pnpm@9
cd frontend
pnpm install
pnpm start
```

---

### Backend tests (optional)

With the API running on port 8000:

```bash
cd backend
source .venv/bin/activate
REACT_APP_BACKEND_URL=http://localhost:8000 pytest tests/ -v
```

---

### Quick checklist

```bash
# 1) Backend deps + env
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env

# 2) Frontend deps + env
cd frontend && npm install && cp .env.example .env

# 3) Run API (terminal 1)
cd backend && source .venv/bin/activate && .venv/bin/uvicorn server:app --reload --port 8000

# 4) Run UI (terminal 2)
cd frontend && npm start
```

---

## Project structure

```
opptra-triage/
├── backend/server.py
├── frontend/src/
│   ├── data/
│   │   ├── skus.js              # SKUs + mock historical/inventory/cross-platform
│   │   └── marketCalendar.js    # Sale & festival windows
│   ├── lib/
│   │   ├── triage.js
│   │   ├── pricingContext.js    # Four-factor enrichment
│   │   └── api.js
│   └── components/
│       ├── TriageBar.jsx
│       ├── SkuRow.jsx
│       ├── PricingSignals.jsx
│       └── AiRecommendation.jsx
└── README.md
```

---

## Extending to production

1. Replace `skus.js` with CSV/API import (prices, stock, 12m stats).
2. Sync `marketCalendar.js` from marketplace campaign APIs.
3. Scrape or API-pull Amazon/Meesho prices on a schedule.
4. Connect WMS/ERP for real `dailySales` / `dailyInbound` / PO dates.
5. Persist apply history and push live reprices to Flipkart Seller API.

---

## Design intent

- **Decision tool, not dashboard** — one row per SKU, one sentence per recommendation.
- **Signals visible before Apply** — operator sees why the model suggested a price.
- **Fail-soft** — works without OpenAI using the same context in fallback rules.
