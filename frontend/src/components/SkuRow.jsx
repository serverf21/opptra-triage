import React, { useState } from "react";
import { Check, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { AiRecommendation } from "./AiRecommendation";
import { BUCKETS, daysSince, formatRupee } from "../lib/triage";

const BUCKET_TAG = {
  [BUCKETS.ACTION]: {
    label: "ACTION NEEDED",
    cls: "text-[#EF4444] border-[#EF4444]/40 bg-[#EF4444]/10",
  },
  [BUCKETS.OPPORTUNITY]: {
    label: "OPPORTUNITY",
    cls: "text-[#10B981] border-[#10B981]/40 bg-[#10B981]/10",
  },
  [BUCKETS.BLOCKED]: {
    label: "BLOCKED",
    cls: "text-[#F59E0B] border-[#F59E0B]/40 bg-[#F59E0B]/10",
  },
  [BUCKETS.OK]: {
    label: "ON TRACK",
    cls: "text-[#8B8B96] border-[#262626] bg-[#111]",
  },
};

const BUY_BOX_TAG = {
  won: "text-[#10B981] border-[#10B981]/40",
  lost: "text-[#EF4444] border-[#EF4444]/40",
};

export function SkuRow({ sku }) {
  const [repriced, setRepriced] = useState(false);
  const [recData, setRecData] = useState(null);
  const isBlocked = sku.bucket === BUCKETS.BLOCKED;
  const isActionable =
    sku.bucket === BUCKETS.ACTION || sku.bucket === BUCKETS.OPPORTUNITY;

  const currentPrice = repriced && recData ? recData.suggestedPrice : sku.ourPrice;
  const deltaAbs = currentPrice - sku.competitorPrice;
  const deltaPct = (deltaAbs / sku.competitorPrice) * 100;
  const deltaPos = deltaAbs > 0;
  const days = daysSince(sku.lastChanged);

  const rowBase =
    "grid grid-cols-12 gap-4 items-center p-4 border border-[#262626] transition-colors";
  const rowSkin = isBlocked
    ? "bg-[#1A0F03] border-[#78350F]/60"
    : repriced
    ? "bg-[#0B1F16] border-[#10B981]/40"
    : "bg-[#0B0B0B] hover:bg-[#141414]";

  return (
    <div
      data-testid={`sku-row-${sku.id}`}
      data-bucket={sku.bucket}
      className={`${rowBase} ${rowSkin}`}
    >
      {/* Column 1: SKU + Brand + Bucket tag */}
      <div className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className="text-[#F5F5F5] font-bold tracking-tighter"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
            data-testid={`sku-id-${sku.id}`}
          >
            {sku.id}
          </span>
          {isBlocked && <Lock className="h-3 w-3 text-[#F59E0B]" />}
        </div>
        <div className="text-[#8B8B96] text-xs uppercase tracking-wider">
          {sku.brand} · {sku.category}
        </div>
        <span
          className={`inline-flex w-fit px-1.5 py-0.5 text-[9px] font-bold tracking-[0.18em] uppercase border ${BUCKET_TAG[sku.bucket].cls}`}
          style={{ fontFamily: "Chivo, sans-serif" }}
        >
          {BUCKET_TAG[sku.bucket].label}
        </span>
      </div>

      {/* Column 2: Prices + delta */}
      <div className="col-span-6 md:col-span-2 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-lg font-bold tracking-tighter ${repriced ? "text-[#10B981]" : "text-[#F5F5F5]"}`}
            style={{ fontFamily: "JetBrains Mono, monospace" }}
            data-testid={`current-price-${sku.id}`}
          >
            {formatRupee(currentPrice)}
          </span>
          <span className="text-[10px] uppercase text-[#52525A] tracking-widest">
            ours
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm text-[#8B8B96] tracking-tighter"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {formatRupee(sku.competitorPrice)}
          </span>
          <span className="text-[10px] uppercase text-[#52525A] tracking-widest">
            comp
          </span>
        </div>
        <div
          className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono ${deltaPos ? "text-[#EF4444]" : "text-[#10B981]"}`}
        >
          {deltaPos ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {deltaPos ? "+" : ""}
          {formatRupee(Math.abs(deltaAbs))} ({deltaPct >= 0 ? "+" : ""}
          {deltaPct.toFixed(1)}%)
        </div>
      </div>

      {/* Column 3: Buy box + margin floor */}
      <div className="col-span-6 md:col-span-2 flex flex-col gap-1.5">
        <span
          className={`inline-flex w-fit px-2 py-0.5 text-[10px] font-bold tracking-[0.18em] uppercase border ${BUY_BOX_TAG[sku.buyBoxStatus]}`}
        >
          BUY BOX · {sku.buyBoxStatus}
        </span>
        <div
          className="text-xs text-[#8B8B96]"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          Floor{" "}
          <span className="text-[#F5F5F5] font-medium">
            {formatRupee(sku.marginFloor)}
          </span>
        </div>
      </div>

      {/* Column 4: Days since change */}
      <div className="col-span-3 md:col-span-1 flex flex-col">
        <span
          className="text-2xl font-bold tabular-nums tracking-tighter text-[#F5F5F5]"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {days}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-[#52525A]">
          days ago
        </span>
      </div>

      {/* Column 5: AI recommendation OR blocked message */}
      <div className="col-span-9 md:col-span-4">
        {isBlocked ? (
          <div
            data-testid={`blocked-message-${sku.id}`}
            className="flex items-start gap-2 text-[#F59E0B]"
          >
            <Lock className="h-4 w-4 shrink-0 mt-0.5" />
            <p
              className="text-sm leading-snug"
              style={{ fontFamily: "DM Sans, sans-serif" }}
            >
              Competitor is pricing below your margin floor (
              <span className="font-mono">{formatRupee(sku.competitorPrice)}</span>{" "}
              &lt;{" "}
              <span className="font-mono">{formatRupee(sku.marginFloor)}</span>
              ). No action possible — monitor for recovery.
            </p>
          </div>
        ) : isActionable ? (
          <AiRecommendation sku={sku} onLoaded={setRecData} />
        ) : (
          <p
            className="text-xs text-[#52525A] uppercase tracking-widest"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            No move recommended — holding position.
          </p>
        )}
      </div>

      {/* Column 6: Apply / Repriced */}
      <div className="col-span-12 md:col-span-1 flex justify-start md:justify-end">
        {isBlocked ? (
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#52525A]">
            locked
          </span>
        ) : !isActionable ? (
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#52525A]">
            —
          </span>
        ) : repriced ? (
          <span
            data-testid={`repriced-badge-${sku.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/40"
          >
            <Check className="h-3 w-3" /> Repriced
          </span>
        ) : (
          <button
            type="button"
            data-testid={`apply-button-${sku.id}`}
            disabled={!recData}
            onClick={() => setRepriced(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] bg-[#007AFF] text-white hover:bg-[#005bb5] disabled:bg-[#1A1A1A] disabled:text-[#52525A] disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}
