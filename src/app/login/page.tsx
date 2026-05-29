// src/app/login/page.tsx
"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import styles from "../page.module.css";

function LoginForm() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") || "/profile";

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push(next);
    }
  }, [isAuthenticated, isLoading, next, router]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div className={styles.loader} />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: "1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>Sign in to continue</h1>
      <button className={styles.btnStart} onClick={() => void signIn("google")}>
        Sign In with Google
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
