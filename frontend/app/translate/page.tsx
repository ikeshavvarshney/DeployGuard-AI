"use client";

import Link from "next/link";
import { GitBranch, Database, Server, Terminal, Box, Package } from "lucide-react";

export default function TranslateLanding() {
  const categories = [
    {
      id: "git",
      name: "Git",
      icon: <GitBranch className="w-10 h-10 text-[#00ff88]" />,
      hint: "undo last commit, create branch from tag..."
    },
    {
      id: "sql",
      name: "SQL",
      icon: <Database className="w-10 h-10 text-[#00ff88]" />,
      hint: "find duplicate emails, top 5 users by orders..."
    },
    {
      id: "mongodb",
      name: "MongoDB",
      icon: <Server className="w-10 h-10 text-[#00ff88]" />,
      hint: "find docs where age > 25, update all inactive users..."
    },
    {
      id: "shell",
      name: "Shell",
      icon: <Terminal className="w-10 h-10 text-[#00ff88]" />,
      hint: "delete files older than 7 days, find large files..."
    },
    {
      id: "docker",
      name: "Docker",
      icon: <Box className="w-10 h-10 text-[#00ff88]" />,
      hint: "remove all stopped containers, copy file from container..."
    },
    {
      id: "npm",
      name: "npm",
      icon: <Package className="w-10 h-10 text-[#00ff88]" />,
      hint: "check outdated packages, install and save as dev dependency..."
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-[#0a0a0a]">
      <div className="text-center mb-16 max-w-2xl mt-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-1">
          Command Translator
          <span className="w-4 h-9 bg-[#00ff88] animate-pulse inline-block ml-2"></span>
        </h1>
        <p className="text-[#666666] text-xl">
          Type what you want to do. Get the exact command.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-5xl mb-24">
        {categories.map((cat) => (
          <Link
            href={`/translate/${cat.id}`}
            key={cat.id}
            className="group bg-[#111111] border border-[#1a1a1a] rounded-xl p-8 flex flex-col items-center text-center transition-all duration-300 hover:border-[#00ff88] hover:shadow-[0_0_20px_rgba(0,255,136,0.1)] hover:scale-[1.02]"
          >
            <div className="mb-4 bg-[#1a1a1a] p-4 rounded-full group-hover:bg-[#00ff88]/10 transition-colors">
              {cat.icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{cat.name}</h3>
            <p className="text-sm text-[#666666] group-hover:text-[#888888] transition-colors line-clamp-2">
              "{cat.hint}"
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-auto text-[#666666] text-xs font-mono">
        Powered by Groq · Gemma 1B · Runs in ~1s
      </div>
    </div>
  );
}
