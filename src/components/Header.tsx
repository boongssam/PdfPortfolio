"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/rubrics", label: "평가 기준" },
  { href: "/evaluate", label: "PDF 평가하기" },
  { href: "/results", label: "평가 결과" },
];

export function Header() {
  const pathname = usePathname();
  const { user, loading, login, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          활동지 AI 평가
        </Link>
        <nav className="flex gap-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.email}</span>
            <button className="text-slate-600 underline-offset-2 hover:underline" onClick={logout}>
              로그아웃
            </button>
          </div>
        ) : (
          !loading && (
            <button className="btn-primary ml-auto" onClick={() => login().catch((e: Error) => alert(e.message))}>
              Google 로그인
            </button>
          )
        )}
      </div>
    </header>
  );
}
