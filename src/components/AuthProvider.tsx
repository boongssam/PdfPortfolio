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

// 서버의 허용 계정 목록(ALLOWED_EMAILS)에 있는지 확인. 403일 때만 거부하고, 네트워크 오류 등은 통과시킵니다.
async function isAllowed(user: User): Promise<boolean> {
  try {
    const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    return res.status !== 403;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth(), async (u) => {
        if (u && !(await isAllowed(u))) {
          await signOut(firebaseAuth());
          alert(`${u.email} 계정은 이 앱을 사용할 수 없습니다.`);
          return; // signOut이 이 콜백을 다시 호출합니다(u = null).
        }
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  const login = async () => {
    await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
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
