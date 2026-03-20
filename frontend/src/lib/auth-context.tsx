"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken, logout as clearToken, type AuthResponse } from "@/lib/auth";
import { LoginDialog } from "@/components/login-dialog";

interface User {
  userId: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: User | null;
  openLoginDialog: () => void;
  setUser: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      userId: payload.sub ?? payload.nameid,
      email: payload.email,
      displayName: payload.displayName ?? payload.display_name ?? payload.email,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const parsed = parseToken(token);
      if (parsed) setUserState(parsed);
    }
  }, []);

  const openLoginDialog = useCallback(() => setDialogOpen(true), []);

  const setUser = useCallback((data: AuthResponse) => {
    setUserState({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
    });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUserState(null);
  }, []);

  return (
    <AuthContext value={{ isLoggedIn: !!user, user, openLoginDialog, setUser, logout }}>
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
