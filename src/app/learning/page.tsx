import styles from "./learning.module.css";
import { BookOpen } from "lucide-react";

export default function Learning() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.iconContainer}>
            <BookOpen className={styles.icon} size={48} />
        </div>
        <h1 className={styles.title}>Start Learning</h1>
        <p className={styles.subtitle}>
          This feature is coming soon! Get ready to explore new subjects and learn with the community.
        </p>
      </div>
    </div>
  );
}
