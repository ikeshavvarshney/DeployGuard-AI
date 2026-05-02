"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Check, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contributor {
  username: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  languages: string[];
  commit_count: number;
  email: string;
  skills: string[];
}

interface ContributorCardProps {
  contributor: Contributor;
  onChange: (updated: Contributor) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContributorCard({ contributor, onChange }: ContributorCardProps) {
  const [skillInput, setSkillInput] = useState("");
  const skillInputRef = useRef<HTMLInputElement>(null);
  const hasEmail = contributor.email.trim().length > 0;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...contributor, email: e.target.value });
  };

  const addSkill = (raw: string) => {
    const skill = raw.trim().replace(/,$/, "").trim();
    if (!skill || contributor.skills.includes(skill)) return;
    onChange({ ...contributor, skills: [...contributor.skills, skill] });
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    onChange({ ...contributor, skills: contributor.skills.filter((s) => s !== skill) });
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === "Backspace" && skillInput === "" && contributor.skills.length > 0) {
      removeSkill(contributor.skills[contributor.skills.length - 1]);
    }
  };

  // Avatar fallback: green circle with first letter
  const initials = (contributor.username[0] || "?").toUpperCase();

  return (
    <div
      className="bg-[#111111] rounded-lg p-4 transition-all duration-200"
      style={{
        border: hasEmail ? "1px solid #00ff88" : "1px solid #1a1a1a",
        borderLeft: hasEmail ? "2px solid #00ff88" : "2px solid #1a1a1a",
      }}
    >
      {/* Avatar + Info Row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="relative flex-shrink-0">
          <img
            src={contributor.avatar_url}
            alt={contributor.username}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const sibling = target.nextElementSibling as HTMLElement | null;
              if (sibling) sibling.style.display = "flex";
            }}
          />
          {/* Fallback avatar */}
          <div
            className="w-10 h-10 rounded-full bg-[#00ff88] items-center justify-center text-black font-bold text-sm flex-shrink-0"
            style={{ display: "none" }}
          >
            {initials}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm truncate">{contributor.name || contributor.username}</span>
            <span className="text-[#666666] text-xs flex-shrink-0">@{contributor.username}</span>
          </div>
          {contributor.bio && (
            <p
              className="text-[#666666] text-xs mt-0.5 truncate"
              title={contributor.bio}
            >
              {contributor.bio}
            </p>
          )}
          <p className="text-[#444444] text-xs mt-0.5">{contributor.commit_count} commits</p>
        </div>
      </div>

      {/* Email Input */}
      <div className="relative mb-3">
        <input
          type="email"
          value={contributor.email}
          onChange={handleEmailChange}
          placeholder="Add email address..."
          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/20 transition-colors pr-8"
        />
        {hasEmail && (
          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00ff88]" />
        )}
      </div>

      {/* Skills Tag Input */}
      <div
        className="min-h-[40px] bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-[#00ff88] focus-within:ring-1 focus-within:ring-[#00ff88]/20 transition-colors"
        onClick={() => skillInputRef.current?.focus()}
      >
        {contributor.skills.map((skill) => (
          <span
            key={skill}
            className="flex items-center gap-1 bg-[#00ff88]/10 text-[#00ff88] text-xs px-2 py-0.5 rounded-full border border-[#00ff88]/20 font-mono"
          >
            {skill}
            <button
              onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
              className="text-[#00ff88]/60 hover:text-[#00ff88] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={skillInputRef}
          value={skillInput}
          onChange={(e) => {
            const val = e.target.value;
            if (val.endsWith(",")) {
              addSkill(val);
            } else {
              setSkillInput(val);
            }
          }}
          onKeyDown={handleSkillKeyDown}
          placeholder={contributor.skills.length === 0 ? "Add skills (e.g. React, Python)..." : ""}
          className="flex-1 min-w-[120px] bg-transparent text-xs text-white placeholder-[#444444] focus:outline-none"
        />
      </div>
    </div>
  );
}
