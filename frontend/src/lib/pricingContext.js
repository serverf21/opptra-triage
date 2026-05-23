/* eslint-disable */
// Enriches each SKU with pricing signals: historical, calendar, cross-platform, inventory.
import { eventsForPlatform, getActiveMarketEvents } from "../data/marketCalendar";

const PLATFORM_LABEL = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  meesho: "Meesho",
};

export function buildPricingContext(sku, refDate = new Date()) {
  const historical = analyzeHistorical(sku);
  const market = analyzeMarketCalendar(sku, refDate);
  const crossPlatform = analyzeCrossPlatform(sku);
  const inventory = analyzeInventory(sku, refDate);

  const alerts = [];
  if (inventory.alert) alerts.push({ type: "inventory", message: inventory.alert });
  if (market.guidance) alerts.push({ type: "market", message: market.guidance });
  if (crossPlatform.alert) alerts.push({ type: "cross_platform", message: crossPlatform.alert });

  let suggestedBumpPct = 0;
  if (inventory.pressure) suggestedBumpPct += inventory.suggestedBumpPct;

  const summaryForLlm = [
    historical.summary,
    market.summary,
    crossPlatform.summary,
    inventory.summary,
    suggestedBumpPct > 0
      ? `Apply up to +${suggestedBumpPct}% price premium due to stock pressure if still above margin floor.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    historical,
    market,
    crossPlatform,
    inventory,
    alerts,
    suggestedBumpPct,
    summaryForLlm,
  };
}

function analyzeHistorical(sku) {
  const h = sku.historical12m || {};
  const avg = h.avgPrice ?? sku.ourPrice;
  const vsAvgPct = ((sku.ourPrice - avg) / avg) * 100;
  const trend =
    h.yoyTrendPct > 2 ? "rising" : h.yoyTrendPct < -2 ? "falling" : "stable";

  return {
    avgPrice12m: avg,
    minPrice12m: h.minPrice,
    maxPrice12m: h.maxPrice,
    yoyTrendPct: h.yoyTrendPct ?? 0,
    peakSeason: h.peakSeason ?? "—",
    vsAvgPct,
    trend,
    summary: `12m avg ${Math.round(avg)} (${trend} YoY ${h.yoyTrendPct ?? 0}%), peak ${h.peakSeason}; current ${vsAvgPct >= 0 ? "+" : ""}${vsAvgPct.toFixed(1)}% vs avg.`,
    insight:
      Math.abs(vsAvgPct) > 8
        ? `Price ${vsAvgPct > 0 ? "above" : "below"} 12-month average by ${Math.abs(vsAvgPct).toFixed(1)}%.`
        : "Price near 12-month average.",
  };
}

function analyzeMarketCalendar(sku, refDate) {
  const platform = sku.listingPlatform || "flipkart";
  const allActive = getActiveMarketEvents(refDate, 21);
  const relevant = eventsForPlatform(allActive, platform);
  const activeNow = relevant.filter((e) => e.phase === "active");
  const upcoming = relevant.filter((e) => e.phase === "upcoming");

  let guidance = null;
  if (activeNow.length) {
    guidance = `${activeNow.map((e) => e.name).join(", ")} is live on ${PLATFORM_LABEL[platform]} — align promos/competitive cuts.`;
  } else if (upcoming.length) {
    guidance = `${upcoming[0].name} in ${upcoming[0].daysUntilStart}d — plan repricing before window opens.`;
  }

  return {
    platform,
    activeEvents: activeNow,
    upcomingEvents: upcoming,
    inSaleWindow: activeNow.length > 0,
    guidance,
    summary:
      activeNow.length > 0
        ? `Sale window: ${activeNow.map((e) => e.name).join(", ")}.`
        : upcoming.length > 0
        ? `Upcoming: ${upcoming[0].name} in ${upcoming[0].daysUntilStart} days.`
        : "No major marketplace event in next 21 days.",
  };
}

function analyzeCrossPlatform(sku) {
  const cp = sku.crossPlatform || {};
  const listing = sku.listingPlatform || "flipkart";
  const onListing = sku.competitorPrice;
  const amazon = cp.amazon ?? null;
  const meesho = cp.meesho ?? null;
  const offPlatform = [amazon, meesho].filter((p) => p != null);

  let lowest = onListing;
  let lowestLabel = PLATFORM_LABEL[listing];
  if (amazon != null && amazon < lowest) {
    lowest = amazon;
    lowestLabel = "Amazon";
  }
  if (meesho != null && meesho < lowest) {
    lowest = meesho;
    lowestLabel = "Meesho";
  }

  const undercutGapPct =
    lowest < sku.ourPrice ? ((sku.ourPrice - lowest) / sku.ourPrice) * 100 : 0;

  let alert = null;
  if (undercutGapPct >= 5 && lowestLabel !== PLATFORM_LABEL[listing]) {
    alert = `${lowestLabel} lists at Rs.${Math.round(lowest)} (${undercutGapPct.toFixed(1)}% below your ${PLATFORM_LABEL[listing]} price).`;
  }

  return {
    listingPlatform: listing,
    flipkartCompetitor: onListing,
    amazon,
    meesho,
    lowestPrice: lowest,
    lowestPlatform: lowestLabel,
    undercutGapPct,
    alert,
    summary: `Cross-platform: ${PLATFORM_LABEL[listing]} comp Rs.${Math.round(onListing)}${amazon != null ? `, Amazon Rs.${Math.round(amazon)}` : ""}${meesho != null ? `, Meesho Rs.${Math.round(meesho)}` : ""}; market low on ${lowestLabel}.`,
  };
}

function analyzeInventory(sku, refDate) {
  const inv = sku.inventory || {};
  const dailySales = inv.dailySales ?? 0;
  const dailyInbound = inv.dailyInbound ?? 0;
  const unitsOnHand = inv.unitsOnHand ?? 0;
  const nextReplenishmentDate = inv.nextReplenishmentDate;

  const pressure = dailyInbound > 0 && dailySales > dailyInbound;
  const daysOfStock =
    dailySales > 0 ? Math.floor(unitsOnHand / dailySales) : null;
  const daysUntilReplenishment = nextReplenishmentDate
    ? Math.max(0, daysBetween(refDate, nextReplenishmentDate))
    : null;

  const shouldReorderEarly =
    pressure &&
    daysOfStock != null &&
    daysUntilReplenishment != null &&
    daysOfStock < daysUntilReplenishment;

  let suggestedBumpPct = 0;
  if (pressure) {
    const ratio = dailySales / Math.max(dailyInbound, 0.1);
    suggestedBumpPct = Math.min(8, Math.round(3 + (ratio - 1) * 12));
  }

  let alert = null;
  if (pressure) {
    alert = shouldReorderEarly
      ? `Stock pressure: selling ${dailySales}/day vs inbound ${dailyInbound}/day (~${daysOfStock}d cover, replenishment in ${daysUntilReplenishment}d). Consider early PO.`
      : `Stock pressure: consumption ${dailySales}/day exceeds replenishment ${dailyInbound}/day — consider a modest price increase.`;
  }

  return {
    dailySales,
    dailyInbound,
    unitsOnHand,
    nextReplenishmentDate,
    pressure,
    shouldReorderEarly,
    daysOfStock,
    daysUntilReplenishment,
    suggestedBumpPct,
    alert,
    summary: pressure
      ? `Inventory: ${dailySales}/d sales vs ${dailyInbound}/d inbound${shouldReorderEarly ? "; reorder earlier than scheduled." : "."}`
      : "Inventory: replenishment keeping pace with sales.",
  };
}

function daysBetween(from, isoEnd) {
  const end = new Date(isoEnd);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.ceil((end - start) / 86400000);
}

/** Apply inventory premium to a base suggested price, respecting margin floor. */
export function applyPriceAdjustments(basePrice, marginFloor, suggestedBumpPct) {
  if (!suggestedBumpPct || suggestedBumpPct <= 0) return basePrice;
  const bumped = Math.round(basePrice * (1 + suggestedBumpPct / 100));
  return Math.max(bumped, marginFloor);
}
