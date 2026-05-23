import React from "react";
import { BUCKETS } from "../lib/triage";
import { getActiveMarketEvents } from "../data/marketCalendar";

const FILTERS = [
  { key: "all", label: "ALL" },
  { key: BUCKETS.ACTION, label: "NEED ACTION" },
  { key: BUCKETS.OPPORTUNITY, label: "OPPORTUNITY" },
  { key: BUCKETS.BLOCKED, label: "BLOCKED" },
];

const ACCENT = {
  [BUCKETS.ACTION]: "border-b-[#EF4444]",
  [BUCKETS.OPPORTUNITY]: "border-b-[#10B981]",
  [BUCKETS.BLOCKED]: "border-b-[#F59E0B]",
  all: "border-b-[#007AFF]",
};

const COUNT_COLOR = {
  [BUCKETS.ACTION]: "text-[#EF4444]",
  [BUCKETS.OPPORTUNITY]: "text-[#10B981]",
  [BUCKETS.BLOCKED]: "text-[#F59E0B]",
  all: "text-white",
};

export function TriageBar({ counts, activeFilter, onChange, total }) {
  const valueFor = (key) => (key === "all" ? total : counts[key] || 0);
  const marketEvents = getActiveMarketEvents();
  const activeSales = marketEvents.filter((e) => e.phase === "active");

  return (
    <div
      className="flex flex-wrap items-end gap-2 mb-6 border-b border-[#262626] pb-4 sticky top-0 bg-[#050505] z-50"
      data-testid="triage-bar"
    >
      <div className="mr-auto">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#52525A] font-mono">
          Opptra · Pricing Signal
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight text-[#F5F5F5]"
          style={{ fontFamily: "Chivo, sans-serif" }}
        >
          Triage{" "}
          <span className="text-[#52525A]">/</span>{" "}
          <span className="text-[#8B8B96]">
            {counts.action} need action · {counts.opportunity} opportunity ·{" "}
            {counts.blocked} blocked
          </span>
        </h1>
        {activeSales.length > 0 && (
          <p
            className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[#007AFF]"
            data-testid="market-calendar-banner"
          >
            Marketplace window: {activeSales.map((e) => e.name).join(" · ")}
          </p>
        )}
        {activeSales.length === 0 && marketEvents.length > 0 && (
          <p
            className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[#52525A]"
            data-testid="market-calendar-banner"
          >
            Next: {marketEvents[0].name} in {marketEvents[0].daysUntilStart}d
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-0">
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              data-testid={`triage-pill-${f.key}`}
              onClick={() => onChange(f.key)}
              className={[
                "group flex items-baseline gap-2 px-4 py-2 -ml-px",
                "text-[11px] font-mono uppercase tracking-[0.18em]",
                "border border-[#262626] bg-[#0B0B0B]",
                "transition-colors hover:bg-[#141414] hover:text-white",
                active
                  ? `text-white bg-[#111111] border-b-2 ${ACCENT[f.key]}`
                  : "text-[#8B8B96]",
              ].join(" ")}
            >
              <span
                className={[
                  "tabular-nums font-bold text-base",
                  active ? COUNT_COLOR[f.key] : "text-[#F5F5F5]",
                ].join(" ")}
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                {String(valueFor(f.key)).padStart(2, "0")}
              </span>
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
