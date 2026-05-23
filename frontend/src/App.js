import React, { useMemo, useState } from "react";
import "@/App.css";
import { SKUS } from "./data/skus";
import {
  BUCKETS,
  countByBucket,
  sortByPriority,
  triageAll,
} from "./lib/triage";
import { TriageBar } from "./components/TriageBar";
import { SkuRow } from "./components/SkuRow";

function App() {
  const [filter, setFilter] = useState("all");
  // Cache recommendations across filter toggles so we don't re-call Claude
  // every time the user clicks a triage pill (which remounts SkuRow).
  const [recCache, setRecCache] = useState({});
  const handleRecLoaded = (skuId, data) =>
    setRecCache((prev) => (prev[skuId] ? prev : { ...prev, [skuId]: data }));

  const triaged = useMemo(() => sortByPriority(triageAll(SKUS)), []);
  const counts = useMemo(() => countByBucket(triaged), [triaged]);

  const visible = useMemo(() => {
    if (filter === "all") return triaged;
    return triaged.filter((s) => s.bucket === filter);
  }, [triaged, filter]);

  return (
    <div
      className="min-h-screen bg-[#050505] text-[#F5F5F5]"
      style={{ fontFamily: "DM Sans, sans-serif" }}
      data-testid="app-root"
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10">
        <TriageBar
          counts={counts}
          total={triaged.length}
          activeFilter={filter}
          onChange={setFilter}
        />

        {/* Column header row (desktop only) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 pb-2 mb-2 border-b border-[#1A1A1A]">
          <ColHdr className="col-span-2">SKU / Bucket</ColHdr>
          <ColHdr className="col-span-2">Price vs Comp</ColHdr>
          <ColHdr className="col-span-2">Buy Box / Floor</ColHdr>
          <ColHdr className="col-span-1">Stale</ColHdr>
          <ColHdr className="col-span-4">Recommendation</ColHdr>
          <ColHdr className="col-span-1 text-right">Action</ColHdr>
        </div>

        <div className="flex flex-col gap-2" data-testid="sku-list">
          {visible.map((sku) => (
            <SkuRow
              key={sku.id}
              sku={sku}
              cachedRec={recCache[sku.id]}
              onRecLoaded={handleRecLoaded}
            />
          ))}
          {visible.length === 0 && (
            <div
              className="border border-dashed border-[#262626] p-8 text-center text-[#52525A] uppercase tracking-widest text-xs font-mono"
              data-testid="empty-state"
            >
              No SKUs match this filter.
            </div>
          )}
        </div>

        <footer className="mt-10 pt-4 border-t border-[#1A1A1A] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[#52525A]">
          <span>Opptra · pricing signal · v0.1</span>
          <span>
            {counts[BUCKETS.ACTION]} action · {counts[BUCKETS.OPPORTUNITY]} opp ·{" "}
            {counts[BUCKETS.BLOCKED]} blocked · {counts[BUCKETS.OK]} ok
          </span>
        </footer>
      </div>
    </div>
  );
}

const ColHdr = ({ children, className = "" }) => (
  <div
    className={`text-[10px] uppercase tracking-[0.22em] text-[#52525A] font-mono ${className}`}
  >
    {children}
  </div>
);

export default App;
