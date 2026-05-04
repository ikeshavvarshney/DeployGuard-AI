"use client";

import Link from "next/link";
import { GitBranch, Database, Server, Terminal, Box, Package } from "lucide-react";

export default function TranslateLanding() {
  const categories = [
    {
      id: "git",
      name: "Git",
      icon: <GitBranch className="w-6 h-6" />,
      hint: "undo last commit, create branch from tag..."
    },
    {
      id: "sql",
      name: "SQL",
      icon: <Database className="w-6 h-6" />,
      hint: "find duplicate emails, top 5 users by orders..."
    },
    {
      id: "mongodb",
      name: "MongoDB",
      icon: <Server className="w-6 h-6" />,
      hint: "find docs where age > 25, update all inactive users..."
    },
    {
      id: "shell",
      name: "Shell",
      icon: <Terminal className="w-6 h-6" />,
      hint: "delete files older than 7 days, find large files..."
    },
    {
      id: "docker",
      name: "Docker",
      icon: <Box className="w-6 h-6" />,
      hint: "remove all stopped containers, copy file from container..."
    },
    {
      id: "npm",
      name: "npm",
      icon: <Package className="w-6 h-6" />,
      hint: "check outdated packages, install and save as dev dependency..."
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-6 bg-[#0a0a0a]">
      <div className="text-center mb-16 max-w-2xl mt-8 animate-fadeInUp">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Command <span className="text-[#00ff88]">Translator</span>
        </h1>
        <p className="text-[#888888] text-lg">
          Type what you want to do. Get the exact command.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-5xl mb-24">
        {categories.map((cat, i) => (
          <Link
            href={`/translate/${cat.id}`}
            key={cat.id}
            className="dg-card p-6 flex items-start gap-4 group animate-fadeInUp"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="w-10 h-10 rounded-lg bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88] flex-shrink-0 group-hover:bg-[#00ff88]/20 transition-colors duration-200">
              {cat.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold text-base mb-1 group-hover:text-[#00ff88] transition-colors duration-200">
                {cat.name}
              </h3>
              <p className="text-[#888888] text-sm leading-relaxed line-clamp-2">
                {cat.hint}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-auto text-[#444444] text-xs font-mono">
        Powered by Ollama · Gemma 1B · Runs locally
      </div>
    </div>
  );
}
