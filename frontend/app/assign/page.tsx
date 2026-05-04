"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Users, Loader2, AlertCircle, ChevronRight, Zap } from "lucide-react";
import ContributorCard, { type Contributor } from "../../components/ContributorCard";
import PipelineLoader from "../../components/PipelineLoader";
import DualOutputPanel from "../../components/DualOutputPanel";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ subsets: ["latin"] });

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AssigneeResult {
  username: string;
  name: string | null;
  avatar_url: string;
  email: string;
  skills: string[];
  skill_matches: string[];
}

interface RankingEntry {
  username: string;
  score: number;
  reason: string;
}

interface AssignmentResult {
  assignee: AssigneeResult;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rankings: RankingEntry[];
}

// ─── Confidence Badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    HIGH: { color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
    MEDIUM: { color: "#ffaa00", bg: "rgba(255,170,0,0.1)" },
    LOW: { color: "#ff4444", bg: "rgba(255,68,68,0.1)" },
  };
  const { color, bg } = cfg[level] ?? cfg.MEDIUM;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}40` }}
    >
      {level}
    </span>
  );
}

// ─── Small Avatar ──────────────────────────────────────────────────────────────

function MiniAvatar({ src, username }: { src: string; username: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-7 h-7 rounded-full bg-[#00ff88] flex items-center justify-center text-black font-bold text-xs flex-shrink-0">
        {username[0]?.toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={username}
      width={28}
      height={28}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Assignment Result Card ─────────────────────────────────────────────────────

function AssignmentCard({
  result,
  task,
  contributors,
  onReassign,
}: {
  result: AssignmentResult;
  task: string;
  contributors: Contributor[];
  onReassign: () => void;
}) {
  const { assignee, reason, confidence, rankings } = result;

  const subjectWords = task.split(" ").slice(0, 6).join(" ");
  const mailtoHref = assignee.email
    ? `mailto:${assignee.email}?subject=${encodeURIComponent(`Task Assignment: ${subjectWords}`)}&body=${encodeURIComponent(`${task}\n\nAssigned by DeployGuard AI Task Assigner.`)}`
    : "#";

  // Build other candidates (all ranked, excluding assignee)
  const others = rankings
    .filter((r) => r.username !== assignee.username)
    .map((r) => ({
      ...r,
      contributor: contributors.find((c) => c.username === r.username),
    }));

  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="animate-fadeInUp space-y-4">
      {/* Main result card */}
      <div className="bg-[#111111] border border-[#1a1a1a] border-l-4 border-l-[#00ff88] rounded-r-xl p-5 relative">
        {/* Confidence badge top-right */}
        <div className="absolute top-4 right-4">
          <ConfidenceBadge level={confidence} />
        </div>

        <p className="text-[#888888] text-xs uppercase tracking-widest mb-3">Assigned to</p>

        {/* Assignee identity */}
        <div className="flex items-center gap-3 mb-4">
          {avatarFailed ? (
            <div className="w-12 h-12 rounded-full bg-[#00ff88] flex items-center justify-center text-black font-bold text-lg flex-shrink-0">
              {(assignee.username[0] || "?").toUpperCase()}
            </div>
          ) : (
            <img
              src={assignee.avatar_url}
              alt={assignee.username}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <div>
            <p className="text-white font-bold text-lg leading-tight">{assignee.name || assignee.username}</p>
            <p className="text-[#888888] text-sm">@{assignee.username}</p>
          </div>
        </div>

        {/* Reason */}
        <p className="text-[#888888] text-sm leading-relaxed mb-4">{reason}</p>

        {/* Skill match tags */}
        {assignee.skill_matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {assignee.skill_matches.map((s) => (
              <span
                key={s}
                className={`${jetbrains.className} text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20`}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="border-t border-[#1a1a1a] my-4" />

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {assignee.email ? (
            <a
              href={mailtoHref}
              className="flex-1 text-center border border-[#00ff88] text-[#00ff88] font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00ff88]/10 transition-all duration-200"
            >
              Send Task via Email
            </a>
          ) : (
            <div className="flex-1 text-center border border-[#1a1a1a] text-[#444444] text-sm rounded-lg px-4 py-2.5 cursor-not-allowed">
              No email provided
            </div>
          )}
          <button
            onClick={onReassign}
            className="px-4 py-2.5 border border-[#1a1a1a] text-[#888888] text-sm rounded-lg hover:border-[#00ff88] hover:text-white transition-all duration-200"
          >
            Reassign
          </button>
        </div>
      </div>

      {/* Other candidates */}
      {others.length > 0 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
          <p className="text-[#888888] text-xs uppercase tracking-widest mb-3">Other candidates</p>
          <div className="space-y-2.5">
            {others.map((r) => (
              <div key={r.username} className="flex items-center gap-3">
                <MiniAvatar
                  src={r.contributor?.avatar_url ?? ""}
                  username={r.username}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{r.contributor?.name || r.username}</p>
                </div>
                {/* Confidence bar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00ff88] rounded-full transition-all duration-700"
                      style={{ width: `${Math.round(r.score * 100)}%` }}
                    />
                  </div>
                  <span className="text-[#888888] text-xs w-8 text-right font-mono">{Math.round(r.score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AssignPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);

  const [showTask, setShowTask] = useState(false);
  const [task, setTask] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const [rawAssignResponse, setRawAssignResponse] = useState("");

  const taskSectionRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const hasReadyContributor = contributors.some((c) => c.email.trim().length > 0);

  // ── localStorage persistence for repo URL ──
  useEffect(() => {
    const saved = localStorage.getItem("deployguard_last_repo");
    if (saved) setRepoUrl(saved);
  }, []);

  const handleRepoUrlChange = (value: string) => {
    setRepoUrl(value);
    localStorage.setItem("deployguard_last_repo", value);
  };

  // ── Fetch contributors ──
  const handleFetch = async () => {
    if (!repoUrl.trim()) return;
    setFetchLoading(true);
    setFetchError(null);
    setContributors([]);
    setShowTask(false);
    setResult(null);

    try {
      const res = await fetch("/api/proxy/assign/fetch-contributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Error ${res.status}`);

      // Pre-populate skills from languages
      const hydrated: Contributor[] = (data.contributors as Omit<Contributor, "skills">[]).map((c) => ({
        ...c,
        skills: [...(c.languages ?? [])],
        email: "",
      }));
      setContributors(hydrated);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch contributors");
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Update one contributor ──
  const handleContributorChange = useCallback((index: number, updated: Contributor) => {
    setContributors((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }, []);

  // ── Continue to task section ──
  const handleContinue = () => {
    setShowTask(true);
    setTimeout(() => taskSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // ── Assign task ──
  const handleAssign = async () => {
    if (!task.trim()) return;
    setAssignLoading(true);
    setAssignError(null);
    setResult(null);
    setRawAssignResponse("");

    try {
      const payload = {
        task: task.trim(),
        contributors: contributors.map((c) => ({
          username: c.username,
          name: c.name,
          bio: c.bio,
          email: c.email,
          skills: c.skills,
          commit_count: c.commit_count,
          avatar_url: c.avatar_url,
        })),
      };
      const res = await fetch("/api/proxy/assign/assign-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Error ${res.status}`);
      setResult(data as AssignmentResult);
      setRawAssignResponse(JSON.stringify(data, null, 2));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleTaskKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAssign();
    }
  };

  return (
    <div className={`${inter.className} min-h-screen bg-[#0a0a0a] pb-24`}>
      <div className="max-w-3xl mx-auto px-4 pt-12 space-y-8">

        {/* ── Hero heading ── */}
        <div className="text-center animate-fadeInUp">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Task <span className="text-[#00ff88]">Assigner</span>
          </h1>
          <p className="text-[#888888] text-lg">
            Fetch your repo contributors, add their skills, assign tasks with AI
          </p>
        </div>

        {/* ── Repo input card ── */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 space-y-3 animate-fadeInUp-1">
          <label className="text-[#888888] text-xs uppercase tracking-widest block">GitHub Repository</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => handleRepoUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="https://github.com/owner/repo"
            className={`${jetbrains.className} w-full bg-[#0a0a0a] border rounded-lg px-4 py-3 text-white text-sm placeholder-[#444444] focus:outline-none focus:ring-1 transition-all duration-200 ${
              fetchError ? "border-[#ff4444] focus:border-[#ff4444] focus:ring-[#ff4444]/20" : "border-[#1a1a1a] focus:border-[#00ff88] focus:ring-[#00ff88]/20"
            }`}
          />
          {fetchError && (
            <div className="flex items-start gap-2 text-[#ff4444] text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}
          <button
            onClick={handleFetch}
            disabled={fetchLoading || !repoUrl.trim()}
            className="w-full bg-[#00ff88] text-black font-bold py-3 rounded-lg hover:bg-[#00cc6a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {fetchLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching contributors...
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                Fetch Contributors
              </>
            )}
          </button>
        </div>

        {/* Pipeline Loader for fetch */}
        <PipelineLoader isVisible={fetchLoading} />

        {/* ── Contributors section ── */}
        {contributors.length > 0 && (
          <section className="space-y-4 animate-fadeInUp">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">Contributors</h2>
              <span className="bg-[#00ff88]/10 text-[#00ff88] text-xs font-bold px-2 py-0.5 rounded-full border border-[#00ff88]/20">
                {contributors.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contributors.map((c, i) => (
                <ContributorCard
                  key={c.username}
                  contributor={c}
                  onChange={(updated) => handleContributorChange(i, updated)}
                />
              ))}
            </div>

            <button
              onClick={handleContinue}
              disabled={!hasReadyContributor}
              className="w-full bg-[#00ff88] text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#00cc6a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue to Task Assignment
              <ChevronRight className="w-4 h-4" />
            </button>
            {!hasReadyContributor && (
              <p className="text-center text-[#444444] text-xs">
                Add at least one contributor&apos;s email to continue
              </p>
            )}
          </section>
        )}

        {/* ── Task assignment section ── */}
        {showTask && (
          <section ref={taskSectionRef} className="space-y-4 scroll-mt-20 animate-fadeInUp">
            <h2 className="text-xl font-bold text-white tracking-tight">Describe the Task</h2>

            <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={handleTaskKeyDown}
                placeholder="Describe the feature or task in plain English... e.g. Build a Redis caching layer for mutation results"
                rows={4}
                className={`${jetbrains.className} w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444444] resize-none focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/20 transition-all duration-200`}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-[#444444] font-mono">{task.length} chars</span>
                <span className="text-[10px] text-[#444444]">
                  {typeof navigator !== "undefined" && navigator?.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"} + Enter to assign
                </span>
              </div>
            </div>

            {assignError && (
              <div className="flex items-start gap-2 text-[#ff4444] text-sm bg-[#ff4444]/5 border border-[#ff4444]/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <button
              onClick={handleAssign}
              disabled={assignLoading || !task.trim()}
              className="w-full bg-[#00ff88] text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#00cc6a] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {assignLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className={`${jetbrains.className} text-sm`}>AI is analyzing contributor skills</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Assign Task
                </>
              )}
            </button>
          </section>
        )}

        {/* Pipeline Loader for assign */}
        <PipelineLoader isVisible={assignLoading} />

        {/* ── Assignment result ── */}
        {result && (
          <div ref={resultRef} className="scroll-mt-20">
            <AssignmentCard
              result={result}
              task={task}
              contributors={contributors}
              onReassign={() => {
                setResult(null);
                setAssignError(null);
                setRawAssignResponse("");
              }}
            />

            <DualOutputPanel
              rawOutput={rawAssignResponse}
              parsedContent={
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[#888888]">Assignee:</span>
                    <span className="text-white font-medium text-sm">{result.assignee.name || result.assignee.username}</span>
                    <ConfidenceBadge level={result.confidence} />
                  </div>
                  <p className="text-sm text-[#888888] leading-relaxed">{result.reason}</p>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
