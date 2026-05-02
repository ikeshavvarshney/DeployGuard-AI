"use client";

import { useState, useMemo } from "react";

/* ---------- TYPES ---------- */

type Command = {
  name: string;
  ecosystem: "npm" | "pip";
  command: string;
};

/* ---------- COPY HOOK ---------- */

function useCopy() {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return { copied, copy };
}

/* ---------- COMMAND BLOCK ---------- */

function CommandBlock({ command }: { command: string }) {
  const { copied, copy } = useCopy();

  return (
    <div className="relative group">
      <div className="bg-[#0D0D1A] border border-[#2A2A3F] rounded-lg p-4 font-mono text-sm overflow-x-auto">
        <code className="text-[#A6ACCD]">{command}</code>
      </div>

      <button
        onClick={() => copy(command)}
        className="absolute top-2 right-2 bg-[#12121A] border border-[#2A2A3F] px-3 py-1 rounded-md text-xs hover:bg-[#1A1A26] transition opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

/* ---------- SECTION ---------- */

function CommandSection({
  title,
  commands,
  joiner,
}: {
  title: string;
  commands: Command[];
  joiner: string;
}) {
  const { copied, copy } = useCopy();

  const combined = useMemo(
    () => commands.map((c) => c.command).join(joiner),
    [commands, joiner]
  );

  if (!commands.length) return null;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-[#6C63FF]">{title}</h3>

        <button
          onClick={() => copy(combined)}
          className="text-sm text-[#8888AA] hover:text-white transition"
        >
          {copied ? "Copied ✓" : "Copy All"}
        </button>
      </div>

      {/* COMMAND LIST */}
      <div className="space-y-3">
        {commands.map((cmd, i) => (
          <div key={i} className="space-y-1">
            <div className="text-xs text-[#8888AA]">{cmd.name}</div>
            <CommandBlock command={cmd.command} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- MAIN MODAL ---------- */

export default function UpdateCommandsModal({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const npmCommands = useMemo(
    () => commands.filter((c) => c.ecosystem === "npm"),
    [commands]
  );

  const pipCommands = useMemo(
    () => commands.filter((c) => c.ecosystem === "pip"),
    [commands]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">

      {/* MODAL */}
      <div className="bg-[#12121A] border border-[#2A2A3F] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl animate-[fadeIn_0.2s_ease]">

        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-[#2A2A3F]">
          <h2 className="text-xl font-bold">Update Commands</h2>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1A1A26] hover:bg-[#2A2A3F] transition"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">

          <CommandSection
            title="Frontend (npm)"
            commands={npmCommands}
            joiner=" && "
          />

          <CommandSection
            title="Backend (pip)"
            commands={pipCommands}
            joiner="\n"
          />

        </div>
      </div>
    </div>
  );
}