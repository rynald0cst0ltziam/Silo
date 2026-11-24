"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** After Stripe Checkout, refresh until the webhook has recorded the subscription (max ~45s). */
export function CheckoutRefresh() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 15) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
