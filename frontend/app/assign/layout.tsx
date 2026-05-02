import Link from "next/link";

export default function AssignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <nav
        className="h-14 border-b border-[#00ff88]/30 flex items-center justify-between px-6 bg-[#111111] sticky top-0 z-10"
        style={{ borderBottomWidth: "1px", borderBottomColor: "rgba(0,255,136,0.25)" }}
      >
        <div className="flex-1">
          <Link
            href="/"
            className="text-[#666666] hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span>←</span> DeployGuard AI
          </Link>
        </div>
        <div className="flex-1 text-center font-semibold tracking-wide text-white text-sm">
          Task Assigner
        </div>
        <div className="flex-1" />
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
