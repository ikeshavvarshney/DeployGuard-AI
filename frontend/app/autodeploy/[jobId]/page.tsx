"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

export default function AutoDeployStreamingPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("initializing");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;

    const sse = new EventSource(`http://localhost:8000/api/jobs/${jobId}/stream`);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Show all meaningful log messages
        if (data.event === "log" && data.message) {
          setLogs((prev) => [...prev, data.message]);
        }
        
        // Only show stage_update messages that have actual stage labels
        if (data.event === "stage_update" && data.stage) {
          setStatus(data.stage);
        }

        if (data.event === "complete") {
          setStatus("completed");
          const deployUrl = data.report?.deployment_url;
          if (deployUrl) {
            setUrl(deployUrl);
          } else {
            // Pipeline succeeded but deployment URL is missing — treat as deploy failure
            setError("Deployment completed but no URL was returned. Check that VERCEL_TOKEN is set correctly in your .env file.");
          }
          sse.close();
        }

        if (data.event === "stream_end") {
          sse.close();
          return;
        }

        if (data.event === "error") {
          setStatus("failed");
          setError(data.message || "An unknown error occurred.");
          sse.close();
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    sse.onerror = () => {
      // Only log reconnect noise if we haven't finished yet
      setStatus((prev) => {
        if (prev !== "completed" && prev !== "failed") {
          setLogs((l) => [...l, "[SYSTEM] Connection lost. Retrying..."]);
        } else {
          sse.close(); // already done — stop reconnecting
        }
        return prev;
      });
    };

    return () => sse.close();
  }, [jobId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-sans flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold font-mono text-[#00ff88]">Live Deployment</h1>
            <p className="text-[#666666] font-mono text-sm mt-1">Job ID: {jobId}</p>
          </div>
          <div>
            {status === "completed" ? (
              <span className="px-4 py-2 bg-[#00ff88]/20 text-[#00ff88] rounded-full text-sm font-mono border border-[#00ff88]/50 shadow-[0_0_10px_#00ff88] flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff88]"></span>
                </span>
                LIVE
              </span>
            ) : status === "failed" ? (
              <span className="px-4 py-2 bg-red-500/20 text-red-500 rounded-full text-sm font-mono border border-red-500/50 shadow-[0_0_10px_red]">
                FAILED
              </span>
            ) : (
              <span className="px-4 py-2 bg-yellow-500/20 text-yellow-500 rounded-full text-sm font-mono border border-yellow-500/50 shadow-[0_0_10px_yellow] flex items-center gap-2">
                <LoaderIcon className="w-4 h-4 animate-spin" />
                DEPLOYING
              </span>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 flex-1 min-h-0">
          {/* Terminal Logs */}
          <div className="bg-[#111111] border border-[#222222] rounded-lg overflow-hidden flex flex-col relative">
            <div className="bg-[#1a1a1a] border-b border-[#222222] px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="text-xs text-[#666666] font-mono ml-2">deployment-logs</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 scrollbar-thin max-h-[600px]">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-4">
                  <span className="text-[#444444] select-none">{String(idx + 1).padStart(3, "0")}</span>
                  <span className="text-[#bbbbbb] break-all">{log}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Sidebar / Result Preview */}
          <div className="flex flex-col gap-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg text-sm">
                <h3 className="font-bold mb-1">Deployment Error</h3>
                <p>{error}</p>
              </div>
            )}

            {url ? (
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 flex flex-col h-full">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                  <span className="text-[#00ff88]">✓</span> Deployment Successful
                </h3>
                
                <div className="mb-6">
                  <div className="text-xs text-[#666666] font-mono uppercase mb-2">Live URL</div>
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#00ff88] hover:underline font-mono bg-[#00ff88]/10 p-3 rounded-md border border-[#00ff88]/20"
                  >
                    <span className="truncate">{url}</span>
                    <ExternalLinkIcon className="w-4 h-4 flex-shrink-0" />
                  </a>
                </div>

                <div className="flex-1 border border-[#333333] rounded-lg overflow-hidden bg-black min-h-[300px]">
                  <iframe src={url} className="w-full h-full border-none" title="Live Preview" />
                </div>
              </div>
            ) : status === "completed" || status === "failed" ? (
              // Pipeline finished but no URL — show error state instead of spinner
              <div className="bg-[#111111] border border-red-500/30 rounded-lg p-6 flex flex-col items-center justify-center h-full text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-3xl">
                  ⚠️
                </div>
                <h3 className="text-lg font-bold text-red-400">Deployment Failed</h3>
                <p className="text-sm text-[#666666] mt-2 max-w-xs">
                  {error || "No deployment URL was returned. Check your VERCEL_TOKEN in .env."}
                </p>
              </div>
            ) : (
              <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 border-4 border-[#333333] border-t-[#00ff88] rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-bold text-[#aaaaaa]">Waiting for URL...</h3>
                <p className="text-sm text-[#666666] mt-2">
                  The preview will appear here once the deployment is successfully provisioned on Vercel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
