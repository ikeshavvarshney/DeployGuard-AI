"use client";

import { useState } from "react";
import Link from "next/link";

const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

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

interface DeploymentCardProps {
  jobId: string;
  url: string | null;
  live: boolean;
}

export function DeploymentCard({ jobId, url, live }: DeploymentCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-lg p-5 font-sans relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {/* Vercel Logo Inline SVG */}
          <svg
            className="w-4 h-4 text-[#666666]"
            viewBox="0 0 76 65"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
          <span className="text-sm font-semibold text-[#aaaaaa]">Vercel Deploy</span>
        </div>
        {live ? (
          <div className="flex items-center gap-2 text-[#00ff88] font-mono text-[10px] uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff88]"></span>
            </span>
            Live
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-500 font-mono text-[10px] uppercase tracking-wider">
            <LoaderIcon className="w-3 h-3 animate-spin" />
            Deploying
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="text-xs text-[#666666] font-mono mb-1">URL</div>
        <div className="flex items-center justify-between bg-[#0a0a0a] border border-[#222222] rounded px-3 py-2">
          <div className="font-mono text-sm text-[#00ff88] truncate mr-2">
            {url || "Pending..."}
          </div>
          <button
            onClick={copyToClipboard}
            disabled={!url}
            className="text-[#666666] hover:text-white transition-colors p-1"
            title="Copy URL"
          >
            {copied ? <CheckIcon className="w-4 h-4 text-[#00ff88]" /> : <CopyIcon className="w-4 h-4" />}
          </button>
        </div>
        {/* Toast */}
        {copied && (
          <div className="absolute bottom-16 right-5 bg-[#00ff88] text-black text-xs font-bold px-2 py-1 rounded shadow animate-pulse">
            Copied!
          </div>
        )}
      </div>

      <Link
        href={`/deployment/${jobId}`}
        className="block w-full text-center border border-[#333333] text-[#aaaaaa] hover:text-white hover:border-[#666666] transition-colors py-2 rounded text-sm font-medium flex items-center justify-center gap-2"
      >
        View Full Deployment <ExternalLinkIcon className="w-3 h-3" />
      </Link>
    </div>
  );
}
