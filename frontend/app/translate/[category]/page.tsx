"use client";

import { useState, useRef, use } from "react";
import { GitBranch, Database, Server, Terminal, Box, Package, ArrowRight, RotateCcw, ChevronLeft } from "lucide-react";
import CommandOutput from "../../../components/CommandOutput";
import PipelineLoader from "../../../components/PipelineLoader";
import DualOutputPanel from "../../../components/DualOutputPanel";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

const ICONS: Record<string, React.ReactNode> = {
  git: <GitBranch className="w-5 h-5 text-[#00ff88]" />,
  sql: <Database className="w-5 h-5 text-[#00ff88]" />,
  mongodb: <Server className="w-5 h-5 text-[#00ff88]" />,
  shell: <Terminal className="w-5 h-5 text-[#00ff88]" />,
  docker: <Box className="w-5 h-5 text-[#00ff88]" />,
  npm: <Package className="w-5 h-5 text-[#00ff88]" />,
};

const EXAMPLES: Record<string, string[]> = {
  git: ["undo last commit keeping changes", "create branch from specific tag", "find which commit deleted a file"],
  sql: ["find users with duplicate emails", "get top 5 customers by total orders", "delete records older than 30 days"],
  mongodb: ["find all docs where field is null", "update nested array element", "aggregate total sales by month"],
  shell: ["find and delete files older than 7 days", "kill process running on port 3000", "recursively find large files over 100mb"],
  docker: ["remove all stopped containers", "copy file from running container to host", "show resource usage of all containers"],
  npm: ["check which packages are outdated", "install package as dev dependency only", "run script with environment variable"],
};

export default function CategoryTranslatePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = use(params);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState("");
  const [history, setHistory] = useState<{ query: string; category: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const icon = ICONS[category] || <Terminal className="w-5 h-5 text-[#00ff88]" />;
  const examples = EXAMPLES[category] || [];

  const handleTranslate = async (textToTranslate: string = query) => {
    if (!textToTranslate.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    setRawResponse("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToTranslate, category }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Status ${res.status}` }));
        throw new Error(errorData.error || "Translation failed");
      }

      const data = await res.json();
      setResult(data);
      setRawResponse(JSON.stringify(data, null, 2));
      
      // Add to history
      setHistory(prev => {
        const newHistory = [{ query: textToTranslate, category }, ...prev.filter(h => h.query !== textToTranslate)].slice(0, 5);
        return newHistory;
      });

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const handleChipClick = (text: string) => {
    setQuery(text);
    handleTranslate(text);
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)] bg-[#0a0a0a]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full animate-fadeInUp">
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/translate" className="p-2 bg-[#111111] border border-[#1a1a1a] rounded-lg hover:border-[#00ff88] transition-all duration-200">
            <ChevronLeft className="w-4 h-4 text-[#888888]" />
          </a>
          <div className="p-2 bg-[#111111] border border-[#1a1a1a] rounded-lg">
            {icon}
          </div>
          <h1 className="text-2xl font-bold text-white capitalize tracking-tight">{category}</h1>

          {/* Mobile history toggle */}
          <button
            className="lg:hidden ml-auto p-2 bg-[#111111] border border-[#1a1a1a] rounded-lg text-[#888888] hover:text-white hover:border-[#00ff88] transition-all duration-200"
            onClick={() => setShowHistory(!showHistory)}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile History (collapsible) */}
        {showHistory && (
          <div className="lg:hidden mb-6 bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 animate-fadeInUp">
            <h2 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-3">Session History</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#444444] italic">No recent translations</p>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(h.query); handleTranslate(h.query); setShowHistory(false); }}
                    className="w-full text-left bg-[#0a0a0a] border border-[#1a1a1a] rounded p-2.5 hover:border-[#00ff88]/30 transition-colors"
                  >
                    <span className="text-[10px] uppercase font-bold text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded">{h.category}</span>
                    <p className={`text-xs text-[#cccccc] mt-1 line-clamp-1 ${jetbrainsMono.className}`}>
                      {h.query.length > 40 ? h.query.substring(0, 40) + "..." : h.query}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Examples */}
        <div className="mb-4 flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setQuery(ex); textareaRef.current?.focus(); }}
              className="text-xs px-3 py-1.5 rounded bg-[#111111] border border-[#1a1a1a] text-[#888888] hover:border-[#00ff88]/50 hover:text-white transition-all duration-200"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 mb-6">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to do in plain English..."
              className={`w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-white resize-none focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/20 transition-all duration-200 ${jetbrainsMono.className}`}
              rows={3}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-[#444444] font-mono">
                {query.length} chars
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#444444] hidden sm:inline-block">
                  {typeof navigator !== "undefined" && navigator?.platform?.toLowerCase().includes("mac") ? "Cmd" : "Ctrl"} + Enter
                </span>
                <button
                  onClick={() => handleTranslate()}
                  disabled={loading || !query.trim()}
                  className="bg-[#00ff88] text-black font-bold px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-[#00cc6a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  Translate <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        <PipelineLoader isVisible={loading} />

        {/* Error State */}
        {error && (
          <div className="bg-[#ff4444]/5 border border-[#ff4444]/20 border-l-4 border-l-[#ff4444] rounded-r-lg p-4 animate-fadeInUp">
            <h3 className="text-[#ff4444] font-bold text-sm mb-1">Error</h3>
            <p className="text-[#ff4444]/80 text-sm">{error}</p>
          </div>
        )}

        {/* Result Output */}
        {result && !loading && (
          <div className="animate-fadeInUp">
            <CommandOutput
              command={result.command}
              explanation={result.explanation}
              category={result.category || category}
              variations={result.variations}
              onVariationClick={handleChipClick}
            />

            <DualOutputPanel
              rawOutput={rawResponse}
              parsedContent={
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#888888] block mb-1">Command</span>
                    <pre className={`${jetbrainsMono.className} text-sm text-[#00ff88] bg-[#0a0a0a] p-3 rounded-lg border border-[#1a1a1a]`}>{result.command}</pre>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#888888] block mb-1">Explanation</span>
                    <p className="text-sm text-[#cccccc] leading-relaxed">{result.explanation}</p>
                  </div>
                </div>
              }
            />
          </div>
        )}
      </div>

      {/* History Sidebar (Desktop only) */}
      <div className="hidden lg:flex w-72 border-l border-[#1a1a1a] bg-[#111111] p-5 flex-col h-full">
        <h2 className="text-xs font-bold text-[#888888] mb-6 uppercase tracking-wider flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5" /> Session History
        </h2>
        
        {history.length === 0 ? (
          <div className="text-sm text-[#444444] italic">No recent translations</div>
        ) : (
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => { setQuery(h.query); handleTranslate(h.query); }}
                className="text-left bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 hover:border-[#00ff88]/30 transition-all duration-200 group"
              >
                <div className="mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded">
                    {h.category}
                  </span>
                </div>
                <p className={`text-xs text-[#888888] group-hover:text-white line-clamp-2 transition-colors ${jetbrainsMono.className}`}>
                  {h.query.length > 40 ? h.query.substring(0, 40) + "..." : h.query}
                </p>
              </button>
            ))}
          </div>
        )}
        
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="mt-4 text-xs text-[#444444] hover:text-white transition-colors w-full text-center py-2"
          >
            Clear history
          </button>
        )}
      </div>
    </div>
  );
}
