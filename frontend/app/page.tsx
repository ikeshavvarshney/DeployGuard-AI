"use client";

import { useRouter } from "next/navigation";
import { Shield, Bug, Brain, Terminal, BarChart3, Rocket } from "lucide-react";

const FEATURES = [
  { icon: <Bug className="w-6 h-6" />, title: "Mutation Testing", desc: "Stryker-powered fault injection to measure true test quality beyond coverage metrics." },
  { icon: <Brain className="w-6 h-6" />, title: "LLM Test Generation", desc: "AI models generate targeted tests that kill surviving mutants automatically." },
  { icon: <Shield className="w-6 h-6" />, title: "Task Assigner", desc: "Match features to the best contributor using AI skill analysis and commit history." },
  { icon: <Terminal className="w-6 h-6" />, title: "Command Translator", desc: "Convert plain English into precise Git, SQL, Docker, and Shell commands." },
  { icon: <BarChart3 className="w-6 h-6" />, title: "Risk Classifier", desc: "LightGBM-powered ranking of mutants by danger score and code criticality." },
  { icon: <Rocket className="w-6 h-6" />, title: "Vercel Auto-Deploy", desc: "One-click automated deployment with live URL validation and health checks." },
];

const STEPS = [
  { id: 1, title: "Analyze", desc: "Parse repo structure and config" },
  { id: 2, title: "Deploy", desc: "Build in sandbox container" },
  { id: 3, title: "Mutate", desc: "Inject code faults via Stryker" },
  { id: 4, title: "Rank", desc: "LightGBM risk scoring" },
  { id: 5, title: "Test", desc: "Run & generate tests" },
  { id: 6, title: "Verify", desc: "LLM agent analysis" },
  { id: 7, title: "Score", desc: "Final reliability grade" },
];

export default function LandingPage() {
  const router = useRouter();

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-32 hero-grid-bg">
        {/* Glow accent */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#00ff88]/5 blur-[120px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl animate-fadeInUp">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Deploy<span className="text-[#00ff88]">Guard</span> AI
          </h1>
          <p className="text-[#888888] text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
            We don&apos;t just deploy apps.{" "}
            <span className="text-[#00ff88] font-semibold">We prove they work.</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/scan")}
              className="bg-[#00ff88] text-black font-bold text-base rounded-lg px-8 py-3.5 hover:bg-[#00cc6a] transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(0,255,136,0.15)]"
            >
              Start Pipeline
            </button>
            <button
              onClick={scrollToFeatures}
              className="border border-[#333333] text-[#888888] font-medium text-base rounded-lg px-8 py-3.5 hover:border-[#00ff88] hover:text-[#00ff88] transition-all duration-200"
            >
              Explore Tools ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight animate-fadeInUp">
            Core Features
          </h2>
          <p className="text-[#888888] text-center mb-16 max-w-lg mx-auto animate-fadeInUp">
            A full-stack autonomous pipeline for deployment verification
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="dg-card p-6 group cursor-default"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88] mb-4 group-hover:bg-[#00ff88]/20 transition-colors duration-200">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold text-base mb-2 group-hover:text-[#00ff88] transition-colors duration-200">
                  {f.title}
                </h3>
                <p className="text-[#888888] text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="py-24 bg-[#111111] border-y border-[#1a1a1a] px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 tracking-tight animate-fadeInUp">
            How It Works
          </h2>

          {/* Desktop: horizontal stepper */}
          <div className="hidden lg:flex items-start justify-between gap-2">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex-1 flex flex-col items-center text-center relative">
                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className="absolute top-4 left-1/2 w-full h-[1px] bg-[#1a1a1a]" />
                )}
                <div className="relative z-10 w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#00ff88]/30 text-[#00ff88] flex items-center justify-center font-bold text-sm mb-3">
                  {step.id}
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
                <p className="text-[#888888] text-xs leading-snug">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Mobile: vertical stepper */}
          <div className="lg:hidden space-y-6">
            {STEPS.map((step) => (
              <div key={step.id} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#00ff88]/30 text-[#00ff88] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {step.id}
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{step.title}</h3>
                  <p className="text-[#888888] text-xs mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="py-12 text-center px-6 border-t border-[#1a1a1a]">
        <p className="text-white font-bold text-lg mb-2">
          Deploy<span className="text-[#00ff88]">Guard</span> AI
        </p>
        <p className="text-[#888888] text-sm mb-6">
          We don&apos;t just deploy apps. We prove they work.
        </p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="text-[#444444] text-xs font-mono hover:text-[#00ff88] transition-colors"
        >
          View on GitHub →
        </a>
      </footer>
    </div>
  );
}
