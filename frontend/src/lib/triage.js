import { buildPricingContext } from "./pricingContext";

// Pure classification — no React, no side effects. Easy to unit test or swap.
// Bucket logic per brief:
//   - ACTION:      Lost buy box AND (ourPrice - 1) > marginFloor  (a cut is possible)
//   - OPPORTUNITY: Won buy box AND competitor > 5% above ourPrice (headroom to raise)
//   - BLOCKED:     Competitor price <= marginFloor (no profitable move possible)
// Order of evaluation matters: BLOCKED short-circuits everything else.

export const BUCKETS = {
  ACTION: "action",
  OPPORTUNITY: "opportunity",
  BLOCKED: "blocked",
  OK: "ok",
};

export function classifySku(sku) {
  if (sku.competitorPrice <= sku.marginFloor) return BUCKETS.BLOCKED;

  if (sku.buyBoxStatus === "lost" && sku.ourPrice - 1 > sku.marginFloor) {
    return BUCKETS.ACTION;
  }

  if (sku.buyBoxStatus === "won") {
    const headroom = (sku.competitorPrice - sku.ourPrice) / sku.ourPrice;
    if (headroom > 0.05) return BUCKETS.OPPORTUNITY;
  }

  return BUCKETS.OK;
}

export function triageAll(skus) {
  return skus.map((s) => {
    const bucket = classifySku(s);
    const pricingContext = buildPricingContext(s);
    return { ...s, bucket, pricingContext };
  });
}

const PRIORITY = {
  [BUCKETS.ACTION]: 0,
  [BUCKETS.OPPORTUNITY]: 1,
  [BUCKETS.BLOCKED]: 2,
  [BUCKETS.OK]: 3,
};

export function sortByPriority(triaged) {
  return [...triaged].sort((a, b) => PRIORITY[a.bucket] - PRIORITY[b.bucket]);
}

export function countByBucket(triaged) {
  return triaged.reduce(
    (acc, s) => {
      acc[s.bucket] = (acc[s.bucket] || 0) + 1;
      return acc;
    },
    { action: 0, opportunity: 0, blocked: 0, ok: 0 }
  );
}

export function daysSince(isoDate) {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

export function formatRupee(n) {
  return `Rs.${Math.round(n).toLocaleString("en-IN")}`;
}
