"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

interface DualOutputPanelProps {
  rawOutput: string;
  parsedContent: React.ReactNode;
  contextTokenEstimate?: number;
  isLoading?: boolean;
}

export default function DualOutputPanel({
  rawOutput,
  parsedContent,
  contextTokenEstimate,
  isLoading,
}: DualOutputPanelProps) {
  const [tab, setTab] = useState<"parsed" | "raw">("parsed");
  const [copied, setCopied] = useState(false);

  // Estimate output tokens: word count × 1.33
  const outputTokens = rawOutput
    ? Math.round(rawOutput.split(/\s+/).filter(Boolean).length * 1.33)
    : 0;

  const contextTokens =
    contextTokenEstimate ??
    (rawOutput ? Math.round(rawOutput.length / 4) : 0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (isLoading || !rawOutput) return null;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden animate-fadeInUp mt-6">
      {/* Tab bar */}
      <div className="flex border-b border-[#1a1a1a]">
        <button
          onClick={() => setTab("parsed")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
            tab === "parsed"
              ? "text-[#00ff88] border-b-2 border-[#00ff88] bg-[#0a0a0a]"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Parsed Output
        </button>
        <button
          onClick={() => setTab("raw")}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
            tab === "raw"
              ? "text-[#00ff88] border-b-2 border-[#00ff88] bg-[#0a0a0a]"
              : "text-[#888888] hover:text-white"
          }`}
        >
          Raw LLM Output
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === "parsed" ? (
          <div>{parsedContent}</div>
        ) : (
          <div className="relative">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1 text-xs text-[#666666] hover:text-white transition-colors bg-[#1a1a1a] px-2 py-1 rounded z-10"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[#00ff88]" />
                  <span className="text-[#00ff88]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Raw output */}
            <pre
              className={`${jetbrainsMono.className} text-[13px] text-[#cccccc] bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 pr-20 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words`}
            >
              {rawOutput}
            </pre>

            {/* Token stats */}
            <div className="flex gap-3 mt-3">
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#1a1a1a] text-[#888888] border border-[#222222]">
                ~{outputTokens} output tokens
              </span>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#1a1a1a] text-[#888888] border border-[#222222]">
                ~{contextTokens} context tokens
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
