import styles from "./about.module.css";
import { Code, Briefcase, Globe } from "lucide-react";

export default function About() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>About Us</h1>
        <p className={styles.mission}>
          The internet was supposed to connect people, but it is doing the exact opposite. 
          We are trying to achieve the <strong>original goal of social media</strong>: helping people to socialize, learn, make friends, and build meaningful connections securely.
        </p>
      </div>

      <div className={styles.foundersSection}>
        <h2 className={styles.sectionTitle}>Meet the Founders</h2>
        <div className={styles.foundersGrid}>
          {/* Dishant Singh */}
          <div className={styles.founderCard}>
            <div className={styles.avatar}>
              <Globe className={styles.avatarIcon} />
            </div>
            <h3>Dishant Singh</h3>
            <p>Founder</p>
            <div className={styles.socialLinks}>
              <a href="https://github.com/DishantSingh-Inventor" target="_blank" rel="noopener noreferrer" title="GitHub">
                <Code size={24} />
              </a>
              <a href="https://www.linkedin.com/in/dishant-singh-2b8090397/" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                <Briefcase size={24} />
              </a>
            </div>
          </div>

          {/* Bhardwaj Prasad */}
          <div className={styles.founderCard}>
            <div className={styles.avatar}>
              <Globe className={styles.avatarIcon} />
            </div>
            <h3>Bhardwaj Prasad</h3>
            <p>Founder</p>
            <div className={styles.socialLinks}>
              <a href="https://github.com/Bhardwaj-16" target="_blank" rel="noopener noreferrer" title="GitHub">
                <Code size={24} />
              </a>
              <a href="https://www.linkedin.com/in/bhardwaj-s-origin/" target="_blank" rel="noopener noreferrer" title="LinkedIn">
                <Briefcase size={24} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
