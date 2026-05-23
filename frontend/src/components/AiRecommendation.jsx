import React, { useEffect, useRef, useState } from "react";
import { Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { fetchRecommendation } from "../lib/api";

// ---- Tiny client-side queue ---------------------------------------------
// The LLM backend serializes work internally, so firing 7 parallel requests
// causes them to pile up and exceed axios timeouts. We serialize them on the
// client so only one is in flight at any time. Retries jump to the front.
let __chain = Promise.resolve();
function enqueue(fn) {
  const next = __chain.then(fn, fn);
  // Swallow errors so one failure doesn't poison the whole chain.
  __chain = next.catch(() => undefined);
  return next;
}

/**
 * Inline AI recommendation for a single SKU.
 * - On mount: if a cached value is present, render it instantly (no fetch).
 *   Otherwise, queue a fetch and persist the result to the parent cache.
 * - Exposes a Retry on error.
 */
export function AiRecommendation({ sku, cached, onLoaded }) {
  const initial = cached ? "ok" : "loading";
  const [state, setState] = useState(initial); // loading | ok | error
  const [data, setData] = useState(cached || null);
  const [errMsg, setErrMsg] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function load() {
    setState("loading");
    setErrMsg("");
    try {
      const res = await enqueue(() => fetchRecommendation(sku));
      if (!mounted.current) return;
      setData(res);
      setState("ok");
      onLoaded?.(sku.id, res);
    } catch (e) {
      if (!mounted.current) return;
      setErrMsg(e?.message || "Network error");
      setState("error");
    }
  }

  useEffect(() => {
    if (cached) return; // already have it — no fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") {
    return (
      <div
        data-testid={`ai-rec-loading-${sku.id}`}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-3.5 w-3.5 text-[#007AFF] shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-11/12 bg-[#262626] animate-pulse" />
          <div className="h-3 w-7/12 bg-[#1F1F1F] animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid={`ai-rec-error-${sku.id}`}
        className="flex items-center gap-2 text-[#EF4444]"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span
          className="text-xs"
          style={{ fontFamily: "DM Sans, sans-serif" }}
        >
          Recommendation failed{errMsg ? ` — ${errMsg}` : ""}.
        </span>
        <button
          type="button"
          data-testid={`ai-rec-retry-${sku.id}`}
          onClick={load}
          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid={`ai-rec-ok-${sku.id}`}
      className="flex items-start gap-2"
    >
      <Sparkles className="h-3.5 w-3.5 text-[#007AFF] shrink-0 mt-0.5" />
      <p
        className="text-sm text-[#D4D4D4] leading-snug"
        style={{ fontFamily: "DM Sans, sans-serif" }}
      >
        {data?.recommendation}
        {data?.source === "fallback" && (
          <span className="ml-2 text-[10px] uppercase tracking-widest text-[#52525A] font-mono">
            · heuristic
          </span>
        )}
      </p>
    </div>
  );
}
