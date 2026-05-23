/* eslint-disable */
// 8 SKUs designed to produce: 5 ACTION needed, 2 OPPORTUNITY, 1 BLOCKED (SKU-007).
// Prices are in INR. lastChanged is an ISO date string.
const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const SKUS = [
  {
    id: "SKU-001",
    brand: "Aurelio",
    category: "Apparel",
    ourPrice: 1299,
    competitorPrice: 1199,
    marginFloor: 1050,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(11),
  },
  {
    id: "SKU-002",
    brand: "Norvana",
    category: "Electronics",
    ourPrice: 4499,
    competitorPrice: 4250,
    marginFloor: 3800,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(4),
  },
  {
    id: "SKU-003",
    brand: "Kestrel",
    category: "Home",
    ourPrice: 899,
    competitorPrice: 849,
    marginFloor: 720,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(22),
  },
  {
    id: "SKU-004",
    brand: "Verdant",
    category: "Beauty",
    ourPrice: 599,
    competitorPrice: 559,
    marginFloor: 480,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(7),
  },
  {
    id: "SKU-005",
    brand: "Halcyon",
    category: "Outdoor",
    ourPrice: 2199,
    competitorPrice: 1999,
    marginFloor: 1750,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(31),
  },
  {
    id: "SKU-006",
    brand: "Brio",
    category: "Kitchen",
    ourPrice: 749,
    competitorPrice: 999,
    marginFloor: 600,
    buyBoxStatus: "won",
    lastChanged: daysAgo(18),
  },
  {
    id: "SKU-007",
    brand: "Lumen",
    category: "Stationery",
    ourPrice: 449,
    competitorPrice: 399,
    marginFloor: 420,
    buyBoxStatus: "lost",
    lastChanged: daysAgo(2),
  },
  {
    id: "SKU-008",
    brand: "Sablon",
    category: "Footwear",
    ourPrice: 1199,
    competitorPrice: 1399,
    marginFloor: 1000,
    buyBoxStatus: "won",
    lastChanged: daysAgo(14),
  },
];
