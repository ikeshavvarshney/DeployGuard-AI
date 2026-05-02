"use client";

import { useState } from "react";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

interface CommandOutputProps {
  command: string;
  explanation: string;
  category: string;
  variations?: string[];
  onVariationClick: (v: string) => void;
}

export default function CommandOutput({
  command,
  explanation,
  category,
  variations = [],
  onVariationClick,
}: CommandOutputProps) {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  return (
    <div className="w-full bg-[#0d0d0d] border border-[#1a1a1a] border-l-4 border-l-[#00ff88] rounded-r-lg mt-6 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[#111111]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#1a1a1a] text-[#00ff88] text-xs font-bold uppercase tracking-wider">
            {category}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-[#666666] hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#00ff88]" />
              <span className="text-[#00ff88]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Command Output */}
      <div className="p-4 overflow-x-auto">
        <pre className={`${jetbrainsMono.className} text-[14px] text-[#00ff88] whitespace-pre-wrap break-words`}>
          {command}
        </pre>
      </div>

      {/* Explanation Section */}
      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs text-[#888888] hover:text-white transition-colors bg-[#111111]/50"
        >
          <span>Explanation</span>
          {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 pt-2 text-sm text-[#888888] bg-[#111111]/30">
            {explanation}
          </div>
        )}
      </div>

      {/* Variations */}
      {variations.length > 0 && (
        <div className="border-t border-[#1a1a1a] p-4 bg-[#0a0a0a]/50">
          <div className="text-xs text-[#666666] mb-2 uppercase tracking-wide">Try a variation</div>
          <div className="flex flex-wrap gap-2">
            {variations.map((v, i) => (
              <button
                key={i}
                onClick={() => onVariationClick(v)}
                className="text-xs px-3 py-1.5 rounded-full bg-[#1a1a1a] text-[#888888] hover:bg-[#00ff88]/10 hover:text-[#00ff88] transition-colors border border-transparent hover:border-[#00ff88]/30"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
