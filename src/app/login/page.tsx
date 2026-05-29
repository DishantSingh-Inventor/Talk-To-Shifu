// src/app/login/page.tsx
"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import styles from "../page.module.css"; // reuse styles if appropriate

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const router = useRouter();

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (isAuthenticated) {
    // Already logged in, redirect to home
    router.push("/");
    return null;
  }

  return (
    <div className={styles.container} style={{ justifyContent: "center", alignItems: "center", display: "flex", height: "100vh" }}>
      <button className={styles.loginBtn} onClick={() => void signIn("google")}>Sign In with Google</button>
    </div>
  );
}
