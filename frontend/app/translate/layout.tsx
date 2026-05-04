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
      <main className="flex-1 relative">
        {children}
      </main>
    </div>
  );
}
