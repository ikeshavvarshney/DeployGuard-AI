"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams } from "next/navigation";
import AgentObservatory, { AgentEvent, VoteRecord } from "@/components/AgentObservatory";
import PipelineStatus from "@/components/PipelineStatus";
import MutationScore from "@/components/MutationScore";
import LogStream from "@/components/LogStream";
import ReliabilityReport from "@/components/ReliabilityReport";
import MutantInspector from "@/components/MutantInspector";
import TestCasePanel from "@/components/TestCasePanel";

interface State {
  stages: Record<string, { status: string; timestamp?: string }>;
  logs: string[];
  mutationScoreBefore: number | null;
  mutationScoreAfter: number | null;
  tests: any[];
  mutants: any[];
  finalReport: any | null;
  progress: number;
  agentEvents: AgentEvent[];
  activeAgents: string[];
  voteHistory: VoteRecord[];
}

type Action =
  | { type: "SET_STAGE"; payload: { stage: string; status: string; timestamp?: string } }
  | { type: "ADD_LOG"; payload: string }
  | { type: "SET_MUTATION_SCORE"; payload: { before: number; after: number } }
  | { type: "ADD_TEST"; payload: any }
  | { type: "SET_MUTANTS"; payload: any[] }
  | { type: "SET_FINAL_REPORT"; payload: any }
  | { type: "SET_PROGRESS"; payload: number }
  | { type: "ADD_AGENT_EVENT"; payload: AgentEvent };

const STAGE_ORDER = [
  "analyzing", "deploying", "mutating", "ranking",
  "generating", "verifying", "fixing", "scoring", "completed"
];

const initialState: State = {
  stages: STAGE_ORDER.reduce((acc, stage) => {
    acc[stage] = { status: "pending" };
    return acc;
  }, {} as Record<string, { status: string; timestamp?: string }>),
  logs: [],
  mutationScoreBefore: null,
  mutationScoreAfter: null,
  tests: [],
  mutants: [],
  finalReport: null,
  progress: 0,
  agentEvents: [],
  activeAgents: [],
  voteHistory: [],
};

function updateVoteHistory(history: VoteRecord[], event: AgentEvent): VoteRecord[] {
  if (event.event_type === 'agent_vote') {
    const mutantId = event.data?.mutant_id;
    if (!mutantId) return history;
    const existing = history.find(h => h.mutant_id === mutantId);
    const newVote = { agent: event.data?.agent || "Unknown", vote: event.data?.vote, reasoning: event.data?.reasoning || "" };
    if (existing) {
      return history.map(h => h.mutant_id === mutantId ? { ...h, votes: [...h.votes, newVote] } : h);
    } else {
      return [...history, { mutant_id: mutantId, votes: [newVote], consensus: null }];
    }
  }
  if (event.event_type === 'consensus') {
    const mutantId = event.data?.mutant_id;
    if (!mutantId) return history;
    return history.map(h => h.mutant_id === mutantId ? { ...h, consensus: event.data?.majority } : h);
  }
  return history;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STAGE":
      return {
        ...state,
        stages: {
          ...state.stages,
          [action.payload.stage]: {
            status: action.payload.status,
            timestamp: action.payload.timestamp || new Date().toLocaleTimeString(),
          },
        },
      };
    case "ADD_LOG":
      return { ...state, logs: [...state.logs, action.payload] };
    case "SET_MUTATION_SCORE":
      return {
        ...state,
        mutationScoreBefore: action.payload.before,
        mutationScoreAfter: action.payload.after,
      };
    case "ADD_TEST":
      const existingIdx = state.tests.findIndex(t => t.mutant_id === action.payload.mutant_id && t.code === action.payload.code);
      if (existingIdx >= 0) {
        const newTests = [...state.tests];
        newTests[existingIdx] = { ...newTests[existingIdx], ...action.payload };
        return { ...state, tests: newTests };
      }
      return { ...state, tests: [...state.tests, action.payload] };
    case "SET_MUTANTS":
      return { ...state, mutants: action.payload };
    case "SET_FINAL_REPORT":
      return { ...state, finalReport: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "ADD_AGENT_EVENT":
      const ev = action.payload;
      let activeAgents = state.activeAgents;
      const agentName = ev.data?.agent;
      if (agentName) {
        if (ev.event_type === 'agent_start' && !activeAgents.includes(agentName)) {
          activeAgents = [...activeAgents, agentName];
        } else if (ev.event_type === 'agent_done') {
          activeAgents = activeAgents.filter(a => a !== agentName);
        }
      }
      return {
        ...state,
        agentEvents: [...state.agentEvents, ev].slice(-200),
        activeAgents,
        voteHistory: (ev.event_type === 'agent_vote' || ev.event_type === 'consensus')
          ? updateVoteHistory(state.voteHistory, ev)
          : state.voteHistory
      };
    default:
      return state;
  }
}

export default function Dashboard() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showObservatory, setShowObservatory] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const sse = new EventSource(`http://localhost:8000/api/jobs/${jobId}/stream`);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event_type) {
          dispatch({ type: "ADD_AGENT_EVENT", payload: data });
        }

        if (data.event === "log") {
          dispatch({ type: "ADD_LOG", payload: data.message });
        }

        if (data.event === "stage_update") {
          dispatch({
            type: "SET_STAGE",
            payload: { stage: data.stage, status: data.status },
          });
        }

        if (data.event === "mutation_score") {
          dispatch({
            type: "SET_MUTATION_SCORE",
            payload: { before: data.before, after: data.after },
          });
        }

        if (data.event === "test_generated") {
          dispatch({ type: "ADD_TEST", payload: data.test });
        }

        if (data.event === "mutants_update") {
          dispatch({ type: "SET_MUTANTS", payload: data.mutants });
        }

        if (data.event === "progress") {
          dispatch({ type: "SET_PROGRESS", payload: data.progress });
        }

        if (data.event === "complete") {
          dispatch({ type: "SET_STAGE", payload: { stage: "completed", status: "done" } });
          dispatch({ type: "SET_FINAL_REPORT", payload: data.report });
          // Fallback to extract mutants/tests from report if not sent via events
          if (data.report.mutants && state.mutants.length === 0) {
            dispatch({ type: "SET_MUTANTS", payload: data.report.mutants });
          }
          sse.close();
        }

        if (data.event === "error") {
          dispatch({ type: "ADD_LOG", payload: `[ERROR] ${data.message}` });
          dispatch({ type: "SET_STAGE", payload: { stage: "failed", status: "failed" } });
          sse.close();
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    sse.onerror = () => {
      dispatch({ type: "ADD_LOG", payload: "[SYSTEM] Connection lost. Retrying..." });
    };

    return () => sse.close();
  }, [jobId]);

  const isComplete = state.stages["completed"]?.status === "done" || state.stages["failed"]?.status === "failed";

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary-color)] p-6 font-sans">
      {/* Header */}
      <div className="mb-8 border-b border-[var(--border-color)] pb-4 flex justify-between items-end animate-in fade-in slide-in-from-top-4">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tighter text-[var(--primary-color)]">
            DeployGuard Pipeline
          </h1>
          <p className="text-[var(--text-muted-color)] font-mono text-sm mt-1">Job ID: {jobId}</p>
        </div>
        <div className="flex gap-4 items-center">
          <button
            className="lg:hidden px-3 py-1 bg-[var(--surface-2-color)] border border-[var(--border-color)] rounded text-xs font-mono text-[var(--text-primary-color)] hover:border-[var(--primary-color)] transition-colors"
            onClick={() => setShowObservatory(!showObservatory)}
          >
            {showObservatory ? "Hide Agent Observatory" : "Show Agent Observatory"}
          </button>
          {state.stages["failed"]?.status === "failed" ? (
            <span className="inline-block px-3 py-1 bg-[var(--danger-color)]/20 text-[var(--danger-color)] rounded text-sm font-mono border border-[var(--danger-color)]/50 shadow-[0_0_10px_var(--danger-color)]">
              STATUS: FAILED
            </span>
          ) : isComplete ? (
            <span className="inline-block px-3 py-1 bg-[var(--accent-color)]/20 text-[var(--accent-color)] rounded text-sm font-mono border border-[var(--accent-color)]/50 shadow-[0_0_10px_var(--accent-color)]">
              STATUS: COMPLETE
            </span>
          ) : (
            <span className="inline-block px-3 py-1 bg-[var(--warning-color)]/20 text-[var(--warning-color)] rounded text-sm font-mono border border-[var(--warning-color)]/50 shadow-[0_0_10px_var(--warning-color)] animate-pulse">
              STATUS: RUNNING
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {state.stages["failed"]?.status === "failed" && (
        <div className="max-w-[1600px] mx-auto mb-6 bg-[var(--danger-color)]/10 border border-[var(--danger-color)] text-[var(--danger-color)] p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="font-bold">Pipeline Execution Failed</h3>
            <p className="text-sm opacity-90">{state.logs[state.logs.length - 1] || "An unknown error occurred during execution."}</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="max-w-[1600px] mx-auto mb-8 animate-in fade-in">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-mono text-[var(--primary-color)]">Pipeline Progress</span>
          <span className="text-sm font-mono text-[var(--text-primary-color)]">{state.progress}%</span>
        </div>
        <div className="w-full h-3 bg-[var(--surface-color)] rounded-full overflow-hidden border border-[var(--border-color)]">
          <div
            className="h-full bg-[var(--primary-color)] transition-all duration-500 ease-out relative shadow-[0_0_15px_var(--primary-color)]"
            style={{ width: `${state.progress}%` }}
          >
            <div className="absolute top-0 bottom-0 left-0 right-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[280px_1fr_340px] gap-6 max-w-[1600px] mx-auto">

        {/* LEFT COLUMN: Pipeline & Logs */}
        <div className="space-y-6 flex flex-col h-[calc(100vh-200px)]">
          <PipelineStatus stages={state.stages} />
          <LogStream logs={state.logs} />
        </div>

        {/* CENTER COLUMN: Dashboard Details */}
        <div className="space-y-6 overflow-y-auto h-[calc(100vh-200px)] pr-2 scrollbar-thin">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MutationScore scoreBefore={state.mutationScoreBefore} scoreAfter={state.mutationScoreAfter} />
            <ReliabilityReport report={state.finalReport} isComplete={isComplete} />
          </div>

          <div className="grid grid-cols-1 gap-6 h-[600px]">
            <div className="h-full">
              <MutantInspector mutants={state.mutants} />
            </div>
            <div className="h-full">
              <TestCasePanel tests={state.tests} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Agent Observatory */}
        <div className={`lg:block ${showObservatory ? 'block' : 'hidden'} h-[calc(100vh-200px)]`}>
          <AgentObservatory
            events={state.agentEvents}
            voteHistory={state.voteHistory}
            activeAgents={state.activeAgents}
          />
        </div>

      </div>
    </div>
  );
}
