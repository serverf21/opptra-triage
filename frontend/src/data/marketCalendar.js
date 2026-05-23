/* eslint-disable */
// Mock India marketplace calendar (sale windows + festivals).
// In production this would sync from Flipkart/Amazon campaign APIs.

export const MARKET_EVENTS = [
  {
    id: "republic-day",
    name: "Republic Day Sale",
    platforms: ["amazon", "flipkart", "meesho"],
    type: "sale",
    start: "2026-01-20",
    end: "2026-01-26",
  },
  {
    id: "holi",
    name: "Holi / Spring Sale",
    platforms: ["amazon", "flipkart"],
    type: "festive",
    start: "2026-03-10",
    end: "2026-03-18",
  },
  {
    id: "summer",
    name: "Summer Sale",
    platforms: ["amazon", "flipkart", "meesho"],
    type: "sale",
    start: "2026-05-01",
    end: "2026-05-20",
  },
  {
    id: "prime-day",
    name: "Amazon Prime Day",
    platforms: ["amazon"],
    type: "sale",
    start: "2026-07-12",
    end: "2026-07-16",
  },
  {
    id: "independence",
    name: "Independence Day Sale",
    platforms: ["amazon", "flipkart", "meesho"],
    type: "festive",
    start: "2026-08-10",
    end: "2026-08-18",
  },
  {
    id: "bbd",
    name: "Flipkart Big Billion Days",
    platforms: ["flipkart"],
    type: "sale",
    start: "2026-09-15",
    end: "2026-09-22",
  },
  {
    id: "diwali",
    name: "Diwali / Great Indian Festival",
    platforms: ["amazon", "flipkart", "meesho"],
    type: "festive",
    start: "2026-10-25",
    end: "2026-11-05",
  },
];

/** Events active today or starting within `lookaheadDays`. */
export function getActiveMarketEvents(refDate = new Date(), lookaheadDays = 21) {
  const today = startOfDay(refDate).getTime();
  const horizon = today + lookaheadDays * 86400000;

  return MARKET_EVENTS.filter((ev) => {
    const start = parseDate(ev.start).getTime();
    const end = parseDate(ev.end).getTime() + 86400000 - 1;
    const inProgress = today >= start && today <= end;
    const upcoming = start >= today && start <= horizon;
    return inProgress || upcoming;
  }).map((ev) => {
    const start = parseDate(ev.start).getTime();
    const end = parseDate(ev.end).getTime();
    const inProgress = today >= start && today <= end;
    return {
      ...ev,
      phase: inProgress ? "active" : "upcoming",
      daysUntilStart: inProgress ? 0 : Math.ceil((start - today) / 86400000),
    };
  });
}

export function eventsForPlatform(events, platform) {
  return events.filter((e) => e.platforms.includes(platform));
}

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
