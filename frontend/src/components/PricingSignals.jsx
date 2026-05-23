import React from "react";
import { BarChart3, Calendar, Package, Store } from "lucide-react";

const CHIP =
  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border";

export function PricingSignals({ sku }) {
  const ctx = sku.pricingContext;
  if (!ctx) return null;

  const { historical, market, crossPlatform, inventory } = ctx;

  return (
    <div
      className="col-span-12 flex flex-col gap-1.5 mt-2 pt-2 border-t border-[#1A1A1A]"
      data-testid={`pricing-signals-${sku.id}`}
    >
      <div className="flex flex-wrap gap-1.5">
        <span
          className={`${CHIP} text-[#8B8B96] border-[#262626] bg-[#0B0B0B]`}
          title={historical.summary}
        >
          <BarChart3 className="h-2.5 w-2.5" />
          12m {historical.trend} · {historical.vsAvgPct >= 0 ? "+" : ""}
          {historical.vsAvgPct.toFixed(0)}% vs avg
        </span>
        <span
          className={`${CHIP} ${
            market.inSaleWindow
              ? "text-[#007AFF] border-[#007AFF]/40 bg-[#007AFF]/10"
              : "text-[#8B8B96] border-[#262626] bg-[#0B0B0B]"
          }`}
          title={market.summary}
        >
          <Calendar className="h-2.5 w-2.5" />
          {market.inSaleWindow
            ? market.activeEvents[0]?.name ?? "Sale live"
            : market.upcomingEvents[0]
            ? `${market.upcomingEvents[0].name} · ${market.upcomingEvents[0].daysUntilStart}d`
            : "No event · 21d"}
        </span>
        <span
          className={`${CHIP} ${
            crossPlatform.alert
              ? "text-[#F59E0B] border-[#F59E0B]/40 bg-[#F59E0B]/10"
              : "text-[#8B8B96] border-[#262626] bg-[#0B0B0B]"
          }`}
          title={crossPlatform.summary}
        >
          <Store className="h-2.5 w-2.5" />
          AMZ {crossPlatform.amazon ?? "—"} · MSH {crossPlatform.meesho ?? "—"}
        </span>
        <span
          className={`${CHIP} ${
            inventory.pressure
              ? "text-[#EF4444] border-[#EF4444]/40 bg-[#EF4444]/10"
              : "text-[#10B981] border-[#10B981]/40 bg-[#10B981]/10"
          }`}
          title={inventory.summary}
        >
          <Package className="h-2.5 w-2.5" />
          {inventory.pressure
            ? `Stock ${inventory.dailySales}/${inventory.dailyInbound} per day`
            : "Stock OK"}
        </span>
      </div>
      {ctx.alerts?.length > 0 && (
        <ul className="space-y-0.5">
          {ctx.alerts.map((a, i) => (
            <li
              key={`${a.type}-${i}`}
              className="text-[10px] text-[#F59E0B] leading-snug font-mono"
              data-testid={`pricing-alert-${sku.id}-${a.type}`}
            >
              ▸ {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
