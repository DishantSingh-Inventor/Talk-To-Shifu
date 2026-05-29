// src/components/HomeClient.tsx
"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import styles from "@/app/page.module.css";
import { Globe2, Shield, UserPlus } from "lucide-react";

export default function HomeClient() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Connect across the <span className={styles.gradientText}>globe.</span>
          </h1>
          <p className={styles.subtitle}>
            Finally, an authentic platform that actually helps you socialize. Learn new languages, dive into deep debates, find gaming teammates, and build real connections safely.
          </p>
          <div className={styles.heroActions}>
            {!mounted || isLoading ? (
              <div className={styles.loader} />
            ) : isAuthenticated ? (
              <>
                <button className={styles.btnStart} onClick={() => router.push("/profile")}>Start Matching</button>
                <button className={styles.btnSecondary} onClick={() => router.push("/learning")}>Start Learning</button>
              </>
            ) : (
              <>
                <button className={styles.btnStart} onClick={() => router.push("/login?next=/profile")}>Start Meeting</button>
                <button className={styles.btnSecondary} onClick={() => router.push("/login?next=/learning")}>Start Learning</button>
              </>
            )}
          </div>
        </div>
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <Globe2 className={styles.featureIcon} />
            <h3>Language Filters</h3>
            <p>Connect with people who speak your language or the one you&apos;re learning.</p>
          </div>
          <div className={styles.featureCard}>
            <UserPlus className={styles.featureIcon} />
            <h3>Add Friends</h3>
            <p>Add people you vibe with as friends to easily connect with them again in the future.</p>
          </div>
          <div className={styles.featureCard}>
            <Shield className={styles.featureIcon} />
            <h3>Safe & Secure</h3>
            <p>Your safety is our priority. Enjoy peace of mind with our robust built‑in reporting system and complete control over who you choose to interact with.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
