"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Report } from "./types";

export function LLMInspector({ report: r }: { report: Report }) {
  const [tab, setTab] = useState<"raw" | "parsed">("raw");
  const [copied, setCopied] = useState(false);
  const [tokAnim, setTokAnim] = useState(0);

  const rafRef = useRef<number | null>(null);

  // Animate token count safely
  useEffect(() => {
    let frame = 0;
    const target = r.tokens_used || 0;

    const animate = () => {
      frame++;
      const progress = Math.min(frame / 40, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setTokAnim(Math.round(target * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [r.tokens_used]);

  // Safe clipboard
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.raw_llm_output || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Clipboard write failed");
    }
  };

  // Memoized parsed JSON
  const parsedData = useMemo(() => ({
    score: r.risk_score,
    verdict: r.verdict,
    confidence: r.confidence,
    reasons: r.reasons,
    risk_factors: r.risk_factors,
    suggestions: r.suggestions,
  }), [r]);

  // Simple safe syntax highlighting (no HTML injection)
  const renderJSON = (obj: any, indent = 0): React.ReactNode[] => {
    const spacing = " ".repeat(indent);

    return Object.entries(obj).flatMap(([key, value], i) => {
      const isLast = i === Object.entries(obj).length - 1;

      if (typeof value === "object" && value !== null) {
        return [
          <div key={`${key}-start`}>
            <span className="text-blue-400">"{key}"</span>: {"{"}
          </div>,
          ...renderJSON(value, indent + 2),
          <div key={`${key}-end`}>
            {spacing}
            {"}"}
            {!isLast && ","}
          </div>,
        ];
      }

      return (
        <div key={key}>
          {spacing}
          <span className="text-blue-400">"{key}"</span>:{" "}
          {typeof value === "string" ? (
            <span className="text-green-400">"{value}"</span>
          ) : (
            <span className="text-orange-400">{String(value)}</span>
          )}
          {!isLast && ","}
        </div>
      );
    });
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/60 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">
          🔬 LLM Output Inspector
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          ~{tokAnim} tokens
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 bg-slate-900/40">
        {(["raw", "parsed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t
                ? "bg-slate-700 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "raw" ? "Raw Output" : "Parsed Output"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative">
        {tab === "raw" ? (
          <div className="p-4">
            <pre className="p-4 rounded-xl bg-[#0d1117] text-[11px] font-mono text-slate-300 overflow-auto max-h-[300px] leading-relaxed border border-slate-800/50 whitespace-pre-wrap break-all">
              {r.raw_llm_output || "(No raw output available)"}
            </pre>

            <div className="flex items-center justify-between mt-3">
              <div className="text-[11px] text-slate-600 font-mono space-y-0.5">
                <div>Prompt: ~{r.prompt_tokens || 0} tokens</div>
                <div>Response: ~{r.response_tokens || 0} tokens</div>
                <div>Cost: ~$0.00 (local model)</div>
              </div>

              <button
                onClick={copy}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                {copied ? "Copied!" : "Copy Raw Output"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <pre className="p-4 rounded-xl bg-[#0d1117] text-[11px] font-mono overflow-auto max-h-[300px] leading-relaxed border border-slate-800/50">
              {"{\n"}
              {renderJSON(parsedData, 2)}
              {"\n}"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}