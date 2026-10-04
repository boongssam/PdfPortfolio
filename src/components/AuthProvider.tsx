"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Firebase 로그인 오류 코드를 선생님이 이해할 수 있는 문장으로 바꿉니다.
function loginErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  if (code === "auth/admin-restricted-operation")
    return "등록되지 않은 계정입니다. 관리자에게 Authentication 사용자 등록을 요청하세요.";
  if (code === "auth/user-disabled") return "사용이 중지된 계정입니다.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/popup-blocked") return "팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.";
  return (e as Error).message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth(), (u) => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const login = async () => {
    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
    } catch (e) {
      const message = loginErrorMessage(e);
      if (message) throw new Error(message);
    }
  };
  const logout = () => signOut(firebaseAuth());

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

/** 로그인한 사용자만 내용을 볼 수 있게 감싸는 컴포넌트. 자식에게 user를 넘겨줍니다. */
export function RequireAuth({ children }: { children: (user: User) => React.ReactNode }) {
  const { user, loading, login } = useAuth();
  const [error, setError] = useState("");

  if (loading) return <p className="py-20 text-center text-slate-500">불러오는 중…</p>;
  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm text-slate-500">
          평가 기준과 학생 평가 결과는 로그인한 선생님 계정에만 저장됩니다.
        </p>
        <button
          className="btn-primary mt-6"
          onClick={() => login().catch((e: Error) => setError(e.message))}
        >
          Google 계정으로 로그인
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
  return <>{children(user)}</>;
}
