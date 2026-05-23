# Opptra Pricing Signal Tool — PRD

## Original problem statement
Build a decision tool (not a dashboard) so Ranjit can open it, see what needs
action, get a specific Claude-generated pricing recommendation per SKU, and
click Apply — in under 60 seconds. 8 hardcoded SKUs, client-side triage,
inline AI recs, Apply→Repriced state, and a visible blocked treatment for
SKU-007 (competitor priced below margin floor).

## User personas
- **Ranjit** (primary): operations lead at an Indian e-commerce seller. Wants
  action items, not analytics. Optimises for "minutes saved per day".

## Architecture
- React frontend (CRA), TailwindCSS, dark terminal aesthetic (JetBrains Mono /
  Chivo / DM Sans).
- FastAPI backend proxying Claude via `emergentintegrations`
  (`anthropic / claude-4-sonnet-20250514`).
- `EMERGENT_LLM_KEY` is the default; user can drop their own
  `ANTHROPIC_API_KEY` in `backend/.env` to override.
- No MongoDB usage yet — state is in React only (per brief: "no backend
  needed", we kept backend strictly for the LLM proxy).

## Core requirements (static)
1. 8 hardcoded SKUs in `frontend/src/data/skus.js`.
2. Pure triage engine in `frontend/src/lib/triage.js`
   (action / opportunity / blocked / ok).
3. Sticky triage bar with 4 filter pills and live counters.
4. Sorted SKU rows showing price vs competitor (delta in red/green), buy box
   status, margin floor, days-since-last-change, inline AI recommendation.
5. Per-card Claude recommendation, single sentence, with skeleton loader
   and retry-on-error.
6. Apply button → green "Repriced" badge, price flips to suggested value.
7. SKU-007 blocked treatment: amber tint, lock icon, explanatory message,
   no AI call, no Apply.

## What's been implemented (2026-02)
- [x] Backend `POST /api/recommend` + `GET /api/health` (Claude via
  emergentintegrations, deterministic fallback when LLM unavailable).
- [x] Frontend triage engine + 4-pill filter bar with live counters.
- [x] 8 SKUs (5 action, 2 opportunity, 1 blocked = SKU-007).
- [x] Dense terminal-aesthetic SKU rows with semantic deltas.
- [x] Per-card AI recommendation with skeleton + retry, serialized via a
  shared Promise chain (the LLM client serializes server-side anyway).
- [x] Apply→Repriced state with price swap.
- [x] Blocked SKU-007 amber treatment, no AI call, no Apply.
- [x] App-level recommendation cache so filter toggles don't re-spend tokens.
- [x] data-testid coverage on every interactive element.
- [x] End-to-end testing passed 100% (backend + frontend).

## Backlog
### P1
- CSV upload to swap the hardcoded SKU list (≈20 min lift per brief).
- Persist apply history (Mongo) so Ranjit can see "5 SKUs repriced today".
- Bulk apply (intentionally cut for MVP; brief said one-at-a-time).

### P2
- Historical price chart per SKU.
- Marketplace API push (real reprice).
- Slack/email digest of triage state.

### P3
- Multi-user auth & role-based "approver" gating.
- Per-brand margin floor policies.
