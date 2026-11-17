"use client";

import type { ReactNode } from "react";
import { useConnect } from "@/components/connect/connect-flow";
import { cn } from "@/lib/utils";

type ConnectButtonProps = {
  children?: ReactNode;
  plan?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ink" | "outline-dark";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  onClick?: () => void;
};

export function ConnectButton({
  children = "Connect your store",
  plan,
  className,
  variant = "primary",
  size = "md",
  full = false,
  onClick,
}: ConnectButtonProps) {
  const { open } = useConnect();

  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "ink"
        ? "btn-ink"
        : variant === "outline-dark"
          ? "btn-outline-dark"
          : "btn-primary";

  const sizeClass = size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : "";

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        open(plan);
      }}
      className={cn("btn", variantClass, sizeClass, full && "w-full", className)}
    >
      {children}
    </button>
  );
}
