"use client";

import styles from "./pricing.module.css";
import { Check } from "lucide-react";

export default function Pricing() {
  const handleSubscribe = (plan: string) => {
    alert(`Payment system integration for the ${plan} plan is coming soon!`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Simple, Transparent Pricing</h1>
        <p className={styles.subtitle}>Choose the plan that fits your social needs. Upgrade anytime.</p>
      </div>

      <div className={styles.grid}>
        {/* Free Plan */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Basic</h3>
            <div className={styles.price}>
              <span className={styles.currency}>₹</span>
              <span className={styles.amount}>0</span>
              <span className={styles.period}>/mo</span>
            </div>
          </div>
          <ul className={styles.features}>
            <li><Check className={styles.checkIcon} /> 15 mins daily call limit</li>
            <li><Check className={styles.checkIcon} /> Unlimited calls with friends</li>
            <li><Check className={styles.checkIcon} /> Ad-supported</li>
            <li className={styles.disabled}>Advanced Language Filters</li>
            <li className={styles.disabled}>Priority Matching</li>
          </ul>
          <button className={styles.btnOutline} onClick={() => handleSubscribe("Basic")}>
            Current Plan
          </button>
        </div>

        {/* Pro Plan */}
        <div className={`${styles.card} ${styles.cardPopular}`}>
          <div className={styles.popularBadge}>Most Popular</div>
          <div className={styles.cardHeader}>
            <h3>Pro</h3>
            <div className={styles.price}>
              <span className={styles.currency}>₹</span>
              <span className={styles.amount}>400</span>
              <span className={styles.period}>/mo</span>
            </div>
          </div>
          <ul className={styles.features}>
            <li><Check className={styles.checkIcon} /> 2 hours daily call limit</li>
            <li><Check className={styles.checkIcon} /> Unlimited calls with friends</li>
            <li><Check className={styles.checkIcon} /> Ad-Free Experience</li>
            <li><Check className={styles.checkIcon} /> Advanced Match Filters</li>
            <li className={styles.disabled}>Priority Matching</li>
          </ul>
          <button className={styles.btnPrimary} onClick={() => handleSubscribe("Pro")}>
            Upgrade to Pro
          </button>
        </div>

        {/* Premium Plan */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Premium</h3>
            <div className={styles.price}>
              <span className={styles.currency}>₹</span>
              <span className={styles.amount}>1200</span>
              <span className={styles.period}>/mo</span>
            </div>
          </div>
          <ul className={styles.features}>
            <li><Check className={styles.checkIcon} /> Unlimited calling</li>
            <li><Check className={styles.checkIcon} /> Unlimited calls with friends</li>
            <li><Check className={styles.checkIcon} /> Ad-Free Experience</li>
            <li><Check className={styles.checkIcon} /> Priority Matching</li>
            <li><Check className={styles.checkIcon} /> Custom Profile Badges</li>
          </ul>
          <button className={styles.btnOutline} onClick={() => handleSubscribe("Premium")}>
            Upgrade to Premium
          </button>
        </div>
      </div>
    </div>
  );
}
