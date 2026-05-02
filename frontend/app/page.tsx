"use client";

import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary-color)] font-sans flex flex-col">
      
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center p-6 mt-20 mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <h1 className="text-5xl md:text-7xl font-bold font-mono tracking-tighter mb-6 flex items-center justify-center gap-2 text-center">
          DeployGuard AI
          <span className="w-5 h-12 bg-[var(--primary-color)] animate-pulse block rounded-sm"></span>
        </h1>
        <p className="text-[var(--text-muted-color)] text-2xl md:text-3xl max-w-2xl mx-auto text-center font-light mb-12">
          We don't just deploy apps. <br/>
          <span className="text-[var(--accent-color)] font-semibold">We prove they work.</span>
        </p>
        <button
          onClick={() => router.push('/scan')}
          className="bg-[var(--primary-color)] text-white font-bold text-xl rounded-lg px-8 py-4 hover:bg-[var(--primary-hover-color)] transition-all duration-300 hover:shadow-[0_0_20px_var(--primary-color)] hover:-translate-y-1"
        >
          Start Analysis
        </button>

        {/* Command Translator Teaser */}
        <div className="mt-16 bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 max-w-lg w-full flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
          <div className="bg-[#00ff88]/10 text-[#00ff88] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider mb-3">
            New Feature
          </div>
          <h3 className="text-xl font-bold text-white mb-2 font-mono">Command Translator</h3>
          <p className="text-[#666666] text-sm mb-6">
            English &rarr; Git, SQL, MongoDB, Shell, Docker, npm commands instantly
          </p>
          <button
            onClick={() => router.push('/translate')}
            className="border border-[#00ff88] text-[#00ff88] font-bold text-sm rounded px-6 py-2 hover:bg-[#00ff88]/10 transition-colors"
          >
            Try it &rarr;
          </button>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-[var(--surface-color)] border-y border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold font-mono text-center mb-16 text-[var(--text-primary-color)]">
            How It Works
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { id: 1, title: "Analyze", desc: "Parse repo & config" },
              { id: 2, title: "Deploy", desc: "Sandbox container" },
              { id: 3, title: "Mutate", desc: "Inject code faults" },
              { id: 4, title: "Rank", desc: "LightGBM risk score" },
              { id: 5, title: "Generate Tests", desc: "Groq LLM targets" },
              { id: 6, title: "Verify", desc: "Parallel agents check" },
              { id: 7, title: "Score", desc: "Final reliability grade" }
            ].map((step, idx) => (
              <div 
                key={step.id} 
                className="bg-[var(--surface-2-color)] border border-[var(--border-color)] p-4 rounded-xl flex flex-col items-center text-center animate-in fade-in slide-in-from-left-4"
                style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--primary-color)]/20 text-[var(--primary-color)] flex items-center justify-center font-bold font-mono mb-3">
                  {step.id}
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-[var(--text-muted-color)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold font-mono text-center mb-16 text-[var(--text-primary-color)]">
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: "Mutation Testing", desc: "Stryker integration to automatically inject faults and measure true test coverage." },
            { title: "LLM Test Generation", desc: "Groq-powered models generate precise tests to kill surviving mutants." },
            { title: "Parallel Verification", desc: "Agents verify generated tests concurrently in isolated environments." },
            { title: "LightGBM Risk Ranking", desc: "Machine learning ranks mutants by danger to prioritize what matters." },
            { title: "RAG-powered Fixing", desc: "Simulated RAG lookup to suggest known fixes for deployment failures." },
            { title: "Weighted Reliability Score", desc: "A holistic grade combining mutation score, test effectiveness, and deployment success." }
          ].map((feature, i) => (
            <div 
              key={i} 
              className="bg-[var(--surface-color)] border border-[var(--border-color)] p-8 rounded-2xl hover:border-[var(--primary-color)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(108,99,255,0.1)] group"
            >
              <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[var(--primary-color)] transition-colors">
                {feature.title}
              </h3>
              <p className="text-[var(--text-muted-color)] leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-20 bg-[var(--surface-color)] border-y border-[var(--border-color)] text-center px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold font-mono mb-6 text-[var(--text-primary-color)]">
            Why It Matters
          </h2>
          <div className="text-xl md:text-2xl font-light text-[var(--text-muted-color)] leading-relaxed mb-8">
            "95% test coverage ≠ safe. <br/>
            <span className="text-white font-semibold">Mutation score reveals what tests actually catch.</span>"
          </div>
          <button
            onClick={() => router.push('/scan')}
            className="border-2 border-[var(--primary-color)] text-[var(--primary-color)] font-bold text-lg rounded-lg px-8 py-3 hover:bg-[var(--primary-color)] hover:text-white transition-all duration-300"
          >
            Try It Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-[var(--text-muted-color)] font-mono text-sm">
        <p>DeployGuard AI</p>
        <p className="opacity-50 mt-1">We don't just deploy apps. We prove they work.</p>
      </footer>

    </div>
  );
}
