"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function DeploymentPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [report, setReport] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    fetch(`/api/proxy/jobs/${jobId}/report`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/proxy/deployment/${jobId}/status`);
        const data = await res.json();
        setStatus(data);
        if (data.live) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono">
        <LoaderIcon className="w-6 h-6 animate-spin text-[#00ff88] mr-2" />
        Loading...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono">
        Deployment not found.
      </div>
    );
  }

  const url = status?.url || report.deployment_url;
  const isLive = status?.live;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Deployment Details</h1>
            <div className="text-[#666666] font-mono text-sm">
              Job ID: {jobId}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLive ? (
              <div className="flex items-center gap-2 bg-[#00ff88]/10 text-[#00ff88] px-4 py-2 rounded-full border border-[#00ff88]/20 font-mono text-sm uppercase tracking-wider">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ff88]"></span>
                </span>
                Live
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full border border-yellow-500/20 font-mono text-sm uppercase tracking-wider">
                <LoaderIcon className="w-4 h-4 animate-spin" />
                Checking...
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-lg p-6 mb-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[#666666] text-xs font-mono uppercase mb-1">URL</div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00ff88] font-mono flex items-center gap-2 hover:underline truncate"
                >
                  {url} <ExternalLinkIcon className="w-4 h-4 inline-block" />
                </a>
              ) : (
                <span className="text-[#666666] font-mono">Pending...</span>
              )}
            </div>
            <div>
              <div className="text-[#666666] text-xs font-mono uppercase mb-1">Project</div>
              <div className="font-mono">{report.vercel_project || "Unknown"}</div>
            </div>
            <div>
              <div className="text-[#666666] text-xs font-mono uppercase mb-1">Response Time</div>
              <div className="font-mono">{status?.response_time_ms ? `${status.response_time_ms}ms` : "-"}</div>
            </div>
            <div>
              <div className="text-[#666666] text-xs font-mono uppercase mb-1">Status Code</div>
              <div className="font-mono">{status?.status_code || "-"}</div>
            </div>
          </div>
        </div>

        {url && isLive && (
          <div className="mt-8 flex flex-col gap-4">
            <h2 className="text-xl font-bold">Preview</h2>
            <div className="border border-[#222222] rounded-lg overflow-hidden bg-black">
              <iframe
                src={url}
                className="w-full h-[400px] border-none"
                title="Deployment Preview"
              />
            </div>
            <div className="flex justify-end gap-4 mt-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#111111] text-[#aaaaaa] border border-[#333333] font-semibold px-6 py-3 rounded-md hover:text-white hover:border-[#666666] transition-colors"
              >
                Open in new tab <ExternalLinkIcon className="w-4 h-4" />
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-semibold px-6 py-3 rounded-md hover:bg-[#00ff88]/90 transition-colors"
              >
                Visit Site
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
