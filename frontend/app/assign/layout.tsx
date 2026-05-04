import Link from "next/link";

export default function AssignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <main className="flex-1">{children}</main>
    </div>
  );
}
