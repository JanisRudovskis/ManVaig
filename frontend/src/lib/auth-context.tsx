"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getToken, logout as clearToken, type AuthResponse } from "@/lib/auth";
import { LoginDialog } from "@/components/login-dialog";

interface User {
  userId: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
  avatarUrl: string | null;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  openLoginDialog: () => void;
  setUser: (data: AuthResponse) => void;
  updateAvatarUrl: (url: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): User | null {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(token.split(".")[1]), c => c.charCodeAt(0))
      )
    );
    return {
      userId: payload.sub ?? payload.nameid,
      email: payload.email,
      displayName: payload.displayName ?? payload.display_name ?? payload.email,
      emailConfirmed: payload.emailConfirmed === "true",
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      const parsed = parseToken(token);
      if (parsed) setUserState(parsed);
    }
    setIsLoading(false);
  }, []);

  // Listen for auto-logout events (401 from authFetch)
  useEffect(() => {
    const handler = () => {
      setUserState(null);
      router.push("/login");
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [router]);

  const openLoginDialog = useCallback(() => setDialogOpen(true), []);

  const setUser = useCallback((data: AuthResponse) => {
    setUserState({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
      emailConfirmed: data.emailConfirmed,
      avatarUrl: data.avatarUrl ?? null,
    });
  }, []);

  const updateAvatarUrl = useCallback((url: string) => {
    setUserState((prev) =>
      prev ? { ...prev, avatarUrl: url } : prev
    );
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUserState(null);
  }, []);

  return (
    <AuthContext value={{ isLoggedIn: !!user, isLoading, user, openLoginDialog, setUser, updateAvatarUrl, logout }}>
      {children}
      <LoginDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={setUser}
      />
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
