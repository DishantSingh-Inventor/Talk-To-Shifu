import Link from "next/link";
import styles from "./Footer.module.css";
import { Video } from "lucide-react";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link href="/" className={styles.logo}>
            <Video className={styles.logoIcon} />
            <span>Talk to Shifu</span>
          </Link>
          <p className={styles.tagline}>
            Bringing back the true purpose of social media.
          </p>
        </div>
        
        <div className={styles.links}>
          <div className={styles.linkGroup}>
            <h4>Company</h4>
            <Link href="/about">About Us</Link>
            <Link href="/pricing">Subscriptions</Link>
          </div>
          <div className={styles.linkGroup}>
            <h4>Legal</h4>
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p>&copy; {new Date().getFullYear()} Talk to Shifu. All rights reserved.</p>
      </div>
    </footer>
  );
}
