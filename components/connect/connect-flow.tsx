"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type ConnectContextValue = {
  open: (plan?: string) => void;
};

const ConnectContext = createContext<ConnectContextValue | null>(null);

export function useConnect() {
  const ctx = useContext(ConnectContext);
  if (!ctx) throw new Error("useConnect must be used inside ConnectProvider");
  return ctx;
}

export function ConnectProvider({ children }: { children: ReactNode }) {
  const open = useCallback((_plan?: string) => {
    window.location.href = "/dashboard/connect";
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <ConnectContext.Provider value={value}>
      {children}
    </ConnectContext.Provider>
  );
}
