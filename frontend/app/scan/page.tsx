"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [showBranch, setShowBranch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDeploy = async () => {
    if (!repo) {
      setError("Please enter a GitHub URL");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/proxy/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: repo, branch }),
      });
      if (!res.ok) {
        throw new Error("Failed to start job");
      }
      const data = await res.json();
      console.log(data)

      if (!data?.job_id) {
        throw new Error("Invalid response: missing job_id");
      }

      // 🔥 RESET loading BEFORE redirect
      setLoading(false);

      router.push(`/dashboard/${data.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid URL or Server Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary-color)] font-sans flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
      {/* Center: Input Card */}
      <div className="w-full max-w-xl bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl p-8 shadow-2xl relative transition-all duration-300 ease-in-out hover:scale-[1.01]">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-mono tracking-tighter mb-2">Analyze Your Repository</h1>
          <p className="text-[var(--text-muted-color)] text-sm">
            Paste any public GitHub repo URL. We'll handle the rest.
          </p>
        </div>

        {error && (
          <div className="absolute -top-12 left-0 right-0 bg-[var(--danger-color)]/10 border border-[var(--danger-color)]/50 text-[var(--danger-color)] p-2 text-center rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted-color)] mb-1">
              GitHub Repository URL
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary-color)] focus:outline-none focus:border-[var(--primary-color)] font-mono transition-colors"
              disabled={loading}
            />
          </div>

          {showBranch ? (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-[var(--text-muted-color)] mb-1">
                Branch Name
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary-color)] focus:outline-none focus:border-[var(--primary-color)] font-mono transition-colors"
                disabled={loading}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowBranch(true)}
              className="text-xs text-[var(--primary-color)] hover:text-[var(--primary-hover-color)] transition-colors hover:underline"
            >
              + Specify branch (default: main)
            </button>
          )}

          <button
            onClick={handleDeploy}
            disabled={loading}
            className="w-full bg-[var(--primary-color)] text-[var(--text-primary-color)] font-bold text-lg rounded-lg py-4 mt-6 hover:bg-[var(--primary-hover-color)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:shadow-[0_0_15px_var(--primary-color)]"
          >
            {loading ? (
              <span className="w-6 h-6 border-2 border-[var(--bg-color)] border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Analyze & Deploy"
            )}
          </button>
        </div>
      </div>

      {/* Back to home */}
      <div className="mt-8">
        <button onClick={() => router.push('/')} className="text-sm text-[var(--text-muted-color)] hover:text-[var(--text-primary-color)] transition-colors">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
