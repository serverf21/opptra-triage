import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export async function fetchRecommendation(sku) {
  const ctx = sku.pricingContext;
  const payload = {
    skuId: sku.id,
    brand: sku.brand,
    ourPrice: sku.ourPrice,
    competitorPrice: sku.competitorPrice,
    marginFloor: sku.marginFloor,
    buyBoxStatus: sku.buyBoxStatus,
    bucket: sku.bucket,
    listingPlatform: sku.listingPlatform || "flipkart",
    pricingContext: ctx
      ? {
          summaryForLlm: ctx.summaryForLlm,
          suggestedBumpPct: ctx.suggestedBumpPct,
          historicalSummary: ctx.historical?.summary,
          marketSummary: ctx.market?.summary,
          crossPlatformSummary: ctx.crossPlatform?.summary,
          inventorySummary: ctx.inventory?.summary,
          inventoryPressure: ctx.inventory?.pressure ?? false,
          shouldReorderEarly: ctx.inventory?.shouldReorderEarly ?? false,
          inSaleWindow: ctx.market?.inSaleWindow ?? false,
          alerts: (ctx.alerts || []).map((a) => a.message),
        }
      : null,
  };
  const res = await axios.post(`${API}/recommend`, payload, { timeout: 60000 });
  return res.data;
}
