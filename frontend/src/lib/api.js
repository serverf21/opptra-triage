import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export async function fetchRecommendation(sku) {
  const payload = {
    skuId: sku.id,
    brand: sku.brand,
    ourPrice: sku.ourPrice,
    competitorPrice: sku.competitorPrice,
    marginFloor: sku.marginFloor,
    buyBoxStatus: sku.buyBoxStatus,
    bucket: sku.bucket, // 'action' or 'opportunity'
  };
  const res = await axios.post(`${API}/recommend`, payload, { timeout: 60000 });
  return res.data; // { recommendation, suggestedPrice, source }
}
