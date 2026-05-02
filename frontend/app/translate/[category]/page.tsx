"use client";

import { useState, useRef, useEffect, use } from "react";
import { GitBranch, Database, Server, Terminal, Box, Package, ArrowRight, RotateCcw } from "lucide-react";
import CommandOutput from "../../../components/CommandOutput";
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
  const [history, setHistory] = useState<{ query: string; category: string }[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const icon = ICONS[category] || <Terminal className="w-5 h-5 text-[#00ff88]" />;
  const examples = EXAMPLES[category] || [];

  const handleTranslate = async (textToTranslate: string = query) => {
    if (!textToTranslate.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

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
    <div className="flex h-full min-h-[calc(100vh-4rem)] bg-[#0a0a0a]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-[#111111] border border-[#1a1a1a] rounded-lg">
            {icon}
          </div>
          <h1 className="text-2xl font-bold text-white capitalize">{category}</h1>
        </div>

        {/* Examples */}
        <div className="mb-4 flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setQuery(ex); textareaRef.current?.focus(); }}
              className="text-xs px-3 py-1.5 rounded bg-[#111111] border border-[#1a1a1a] text-[#888888] hover:border-[#00ff88]/50 hover:text-white transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="relative mb-6 group">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to do in plain English..."
            className={`w-full bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 pr-32 text-white resize-none focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] transition-all ${jetbrainsMono.className}`}
            rows={3}
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <span className="text-[10px] text-[#666666] hidden sm:inline-block">
              {navigator?.platform?.toLowerCase().includes("mac") ? "Cmd" : "Ctrl"} + Enter
            </span>
            <button
              onClick={() => handleTranslate()}
              disabled={loading || !query.trim()}
              className="bg-[#00ff88] text-black font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#00cc6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Translate <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="w-full bg-[#0d0d0d] border border-[#1a1a1a] border-l-4 border-l-[#00ff88] rounded-r-lg mt-6 p-8 flex items-center justify-center animate-in fade-in">
            <span className={`text-[#00ff88] ${jetbrainsMono.className} animate-pulse text-lg flex items-center gap-2`}>
              Translating <span className="w-2.5 h-5 bg-[#00ff88] inline-block animate-ping"></span>
            </span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="w-full bg-[#1a0a0a] border border-[#331111] border-l-4 border-l-red-500 rounded-r-lg mt-6 p-4 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-red-500 font-bold mb-1">Error</h3>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Result Output */}
        {result && !loading && (
          <CommandOutput
            command={result.command}
            explanation={result.explanation}
            category={result.category || category}
            variations={result.variations}
            onVariationClick={handleChipClick}
          />
        )}
      </div>

      {/* History Sidebar (Desktop only) */}
      <div className="hidden lg:flex w-80 border-l border-[#1a1a1a] bg-[#111111] p-6 flex-col h-full">
        <h2 className="text-sm font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Session History
        </h2>
        
        {history.length === 0 ? (
          <div className="text-sm text-[#666666] italic">No recent translations</div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => { setQuery(h.query); handleTranslate(h.query); }}
                className="text-left bg-[#0a0a0a] border border-[#1a1a1a] rounded p-3 hover:border-[#00ff88]/30 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#00ff88] bg-[#00ff88]/10 px-1.5 py-0.5 rounded">
                    {h.category}
                  </span>
                </div>
                <p className={`text-xs text-[#cccccc] group-hover:text-white line-clamp-2 ${jetbrainsMono.className}`}>
                  {h.query.length > 40 ? h.query.substring(0, 40) + '...' : h.query}
                </p>
              </button>
            ))}
          </div>
        )}
        
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="mt-4 text-xs text-[#666666] hover:text-white transition-colors w-full text-center py-2"
          >
            Clear history
          </button>
        )}
      </div>
    </div>
  );
}
