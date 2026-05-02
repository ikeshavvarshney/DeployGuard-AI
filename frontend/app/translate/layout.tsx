import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function TranslateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-white ${inter.className} flex flex-col`}>
      <nav className="h-16 border-b border-[#1a1a1a] flex items-center justify-between px-6 bg-[#111111] sticky top-0 z-10">
        <div className="flex-1">
          <Link 
            href="/"
            className="text-[#666666] hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span>&larr;</span> DeployGuard AI
          </Link>
        </div>
        <div className="flex-1 text-center font-semibold tracking-wide">
          Command Translator
        </div>
        <div className="flex-1"></div>
      </nav>
      <main className="flex-1 relative">
        {children}
      </main>
    </div>
  );
}
