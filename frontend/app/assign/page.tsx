"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Users, Loader2, AlertCircle, ChevronRight, Zap } from "lucide-react";
import ContributorCard, { type Contributor } from "../../components/ContributorCard";
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
    MEDIUM: { color: "#ffcc00", bg: "rgba(255,204,0,0.1)" },
    LOW: { color: "#ff4d6d", bg: "rgba(255,77,109,0.1)" },
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      {/* Main result card */}
      <div
        className="bg-[#0d0d0d] rounded-r-lg p-5 relative"
        style={{ borderLeft: "4px solid #00ff88", borderTop: "1px solid #1a1a1a", borderRight: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}
      >
        {/* Confidence badge top-right */}
        <div className="absolute top-4 right-4">
          <ConfidenceBadge level={confidence} />
        </div>

        <p className="text-[#666666] text-xs uppercase tracking-widest mb-3">Assigned to</p>

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
            <p className="text-[#666666] text-sm">@{assignee.username}</p>
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
              className="flex-1 text-center border border-[#00ff88] text-[#00ff88] font-bold text-sm rounded px-4 py-2 hover:bg-[#00ff88]/10 transition-colors"
            >
              Send Task via Email
            </a>
          ) : (
            <div className="flex-1 text-center border border-[#333333] text-[#444444] text-sm rounded px-4 py-2 cursor-not-allowed">
              No email provided
            </div>
          )}
          <button
            onClick={onReassign}
            className="px-4 py-2 border border-[#333333] text-[#666666] text-sm rounded hover:border-[#555555] hover:text-white transition-colors"
          >
            Reassign
          </button>
        </div>
      </div>

      {/* Other candidates */}
      {others.length > 0 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
          <p className="text-[#666666] text-xs uppercase tracking-widest mb-3">Other candidates</p>
          <div className="space-y-2">
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
                  <span className="text-[#666666] text-xs w-8 text-right">{Math.round(r.score * 100)}%</span>
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

  const taskSectionRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const hasReadyContributor = contributors.some((c) => c.email.trim().length > 0);

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
      <div className="max-w-3xl mx-auto px-4 pt-16 space-y-10">

        {/* ── Hero heading ── */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-2">
            Task Assigner
            <span className="w-4 h-9 bg-[#00ff88] animate-pulse inline-block" />
          </h1>
          <p className="text-[#666666] text-lg">
            Fetch your repo contributors, add their skills, assign tasks with AI
          </p>
        </div>

        {/* ── Repo input card ── */}
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 space-y-3">
          <label className="text-[#888888] text-xs uppercase tracking-widest block">GitHub Repository</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="https://github.com/owner/repo"
            className={`${jetbrains.className} w-full bg-[#0a0a0a] border rounded px-4 py-3 text-white text-sm placeholder-[#444444] focus:outline-none focus:ring-1 transition-colors ${
              fetchError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "border-[#1a1a1a] focus:border-[#00ff88] focus:ring-[#00ff88]/20"
            }`}
          />
          {fetchError && (
            <div className="flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}
          <button
            onClick={handleFetch}
            disabled={fetchLoading || !repoUrl.trim()}
            className="w-full bg-[#00ff88] text-black font-bold py-3 rounded hover:bg-[#00cc6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* ── Contributors section ── */}
        {contributors.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Contributors</h2>
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
              className="w-full bg-[#00ff88] text-black font-bold py-3 rounded flex items-center justify-center gap-2 hover:bg-[#00cc6a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue to Task Assignment
              <ChevronRight className="w-4 h-4" />
            </button>
            {!hasReadyContributor && (
              <p className="text-center text-[#555555] text-xs">
                Add at least one contributor's email to continue
              </p>
            )}
          </section>
        )}

        {/* ── Task assignment section ── */}
        {showTask && (
          <section ref={taskSectionRef} className="space-y-4 scroll-mt-20">
            <h2 className="text-xl font-bold text-white">Describe the Task</h2>

            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={handleTaskKeyDown}
              placeholder="Describe the feature or task in plain English... e.g. Build a Redis caching layer for mutation results"
              rows={4}
              className={`${jetbrains.className} w-full bg-[#111111] border border-[#1a1a1a] rounded-lg px-4 py-3 text-white text-sm placeholder-[#444444] resize-none focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/20 transition-colors`}
            />

            {assignError && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <button
              onClick={handleAssign}
              disabled={assignLoading || !task.trim()}
              className="w-full bg-[#00ff88] text-black font-bold py-3 rounded flex items-center justify-center gap-2 hover:bg-[#00cc6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assignLoading ? (
                <>
                  <span className={`${jetbrains.className} text-sm`}>AI is analyzing contributor skills</span>
                  <span className="w-2 h-5 bg-black animate-pulse inline-block ml-1" />
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Assign Task
                </>
              )}
            </button>
            <p className="text-center text-[#444444] text-xs">
              {navigator?.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"} + Enter to assign
            </p>
          </section>
        )}

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
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
