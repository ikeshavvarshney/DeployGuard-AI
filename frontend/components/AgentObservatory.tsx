import React, { useState, useEffect, useRef } from 'react';

export type AgentEvent = {
  event_type: 'agent_start' | 'agent_thinking' | 'agent_response' | 'agent_vote' | 
               'consensus' | 'rollback' | 'retry' | 'agent_done' | 'info' | 'error' | string;
  stage: string;
  message: string;
  data: Record<string, any>;
  timestamp: number;
};

export type VoteRecord = {
  mutant_id: string;
  votes: { agent: string; vote: boolean; reasoning: string }[];
  consensus: boolean | null;
};

interface AgentObservatoryProps {
  events: AgentEvent[];
  voteHistory: VoteRecord[];
  activeAgents: string[];
}

export default function AgentObservatory({ events, voteHistory, activeAgents }: AgentObservatoryProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    if (feedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) newExpanded.delete(index);
    else newExpanded.add(index);
    setExpandedRows(newExpanded);
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'agent_start': return <span className="text-blue-400">▶</span>;
      case 'agent_thinking': return <span className="text-purple-400 animate-pulse">◌</span>;
      case 'agent_response': return <span className="text-purple-400">◉</span>;
      case 'agent_vote': return <span className="text-green-400">✓</span>;
      case 'consensus': return <span className="text-teal-400">⊕</span>;
      case 'rollback': return <span className="text-red-400">↩</span>;
      case 'retry': return <span className="text-amber-400">↺</span>;
      case 'agent_done': return <span className="text-gray-400">■</span>;
      default: return <span className="text-gray-400">•</span>;
    }
  };

  const renderExpandableContent = (event: AgentEvent) => {
    let content = "";
    if (event.event_type === 'agent_thinking' && event.data?.prompt_preview) content = event.data.prompt_preview;
    if (event.event_type === 'agent_response' && event.data?.raw_output) content = event.data.raw_output;
    if (event.event_type === 'agent_vote' && event.data?.reasoning) content = event.data.reasoning;
    if (event.event_type === 'rollback') content = `Reason: ${event.data?.reason}\nAction: ${event.data?.action}`;
    if (event.event_type === 'retry') content = `Reason: ${event.data?.reason}`;

    if (event.event_type === 'agent_start' && event.data?.agent === 'Jest-Executor' && event.data?.file) {
      return (
        <div className="mt-2 p-3 bg-[#050505] border border-[#333] rounded text-xs font-mono overflow-x-auto">
          <div className="text-[#888] mb-2">Target File: <span className="text-[#00ff88]">{event.data.file}</span> (Line {event.data.line})</div>
          <div className="text-red-400 bg-red-950/30 px-2 py-1 mb-1 rounded">- {event.data.original_code}</div>
          <div className="text-green-400 bg-green-950/30 px-2 py-1 rounded">+ {event.data.mutated_code}</div>
        </div>
      );
    }

    if (!content) return null;

    return (
      <div className="mt-2 p-2 bg-[#050505] border border-[#333] rounded text-[#00ff88] text-xs font-mono whitespace-pre-wrap">
        {content}
      </div>
    );
  };

  const renderVoteBoard = () => {
    let accepted = 0;
    let rejected = 0;

    const cards = voteHistory.map(v => {
      if (v.consensus === true) accepted++;
      if (v.consensus === false) rejected++;

      const isAccepted = v.consensus === true;
      const isRejected = v.consensus === false;
      const borderClass = isAccepted ? 'border-green-500/30 bg-green-500/5' : 
                         isRejected ? 'border-red-500/30 bg-red-500/5' : 'border-[#333] bg-[#111]';

      return (
        <div key={v.mutant_id} className={`p-2 rounded border ${borderClass} mb-2 text-xs font-mono`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-white">Mutant: {v.mutant_id}</span>
            <span className={isAccepted ? 'text-green-400' : isRejected ? 'text-red-400' : 'text-gray-400'}>
              {v.consensus === true ? 'ACCEPTED ✓' : v.consensus === false ? 'REJECTED ↩' : 'PENDING...'}
            </span>
          </div>
          <div className="space-y-1">
            {v.votes.map((vote, i) => (
              <div key={i} className="flex justify-between text-[#888]">
                <span>{vote.agent}</span>
                <span className={vote.vote ? 'text-green-400' : 'text-red-400'}>
                  {vote.vote ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    });

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[#888] font-bold text-sm uppercase">Vote Board</h3>
          <span className="text-xs text-[#555]">{accepted} accepted · {rejected} rolled back</span>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {cards}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl flex flex-col h-[calc(100vh-80px)] overflow-hidden font-sans">
      
      {/* Active Agents Header */}
      <div className="p-4 border-b border-[#222] bg-[#111]">
        <h3 className="text-[#888] font-bold text-xs uppercase mb-2">Active Agents</h3>
        <div className="flex flex-wrap gap-2">
          {activeAgents.length === 0 && <span className="text-xs text-[#555]">No agents running</span>}
          {activeAgents.map(agent => (
            <div key={agent} className="flex items-center gap-1.5 bg-[#222] border border-[#333] px-2 py-1 rounded text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
              {agent}
            </div>
          ))}
        </div>
      </div>

      {/* Live Feed */}
      <div className="flex-1 flex flex-col min-h-0 border-b border-[#222]">
        <div className="p-2 border-b border-[#222] bg-[#111] flex justify-between items-center">
          <span className="text-[#888] font-bold text-xs uppercase ml-2">Live Feed</span>
          {!autoScroll && (
            <button 
              onClick={() => { setAutoScroll(true); feedRef.current?.scrollTo(0, feedRef.current.scrollHeight); }}
              className="text-xs text-blue-400 hover:text-blue-300 px-2"
            >
              Resume Auto-scroll ↓
            </button>
          )}
        </div>
        <div 
          ref={feedRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-2 text-sm font-mono"
        >
          {events.map((ev, idx) => (
            <div 
              key={idx} 
              className={`border border-[#222] rounded p-2 ${expandedRows.has(idx) ? 'bg-[#1a1a1a]' : 'hover:bg-[#111]'} transition-colors cursor-pointer`}
              onClick={() => toggleRow(idx)}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{renderIcon(ev.event_type)}</div>
                <div className="flex-1 w-full">
                  <div className="flex items-baseline gap-2 mb-1 w-full">
                    <span className="text-[#555] text-xs shrink-0">
                      {new Date(ev.timestamp * 1000).toLocaleTimeString([], { hour12: false })}
                    </span>
                    {ev.data?.agent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222] text-[#888] border border-[#333] shrink-0">
                        {ev.data.agent}
                      </span>
                    )}
                    {(ev.event_type === 'agent_thinking' || ev.event_type === 'agent_response' || ev.event_type === 'agent_vote' || ev.event_type === 'rollback' || ev.event_type === 'retry') && (
                      <span className="text-[10px] text-[#444] ml-auto shrink-0">Click to expand ⤓</span>
                    )}
                  </div>
                  <div className="text-[#ddd] text-xs leading-relaxed">{ev.message}</div>
                </div>
              </div>
              {expandedRows.has(idx) && renderExpandableContent(ev)}
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-center text-[#555] text-xs mt-10">Waiting for agent activity...</div>
          )}
        </div>
      </div>

      {/* Vote Board */}
      <div className="h-1/3 min-h-[200px] p-4 bg-[#0a0a0a] overflow-hidden flex flex-col">
        {renderVoteBoard()}
      </div>
      
    </div>
  );
}
