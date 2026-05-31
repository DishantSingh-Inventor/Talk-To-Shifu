"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import styles from "./profile.module.css";
import { 
  User, 
  ArrowRight, 
  Globe, 
  Compass, 
  Sparkles,
  Mail,
  Award,
  BookOpen,
  Gamepad2
} from "lucide-react";

const LANGUAGES = ["English", "Spanish", "French", "German", "Hindi", "Mandarin", "Japanese", "Korean", "Italian", "Portuguese", "Russian", "Arabic"];
const AGE_GROUPS = ["13-18", "18-24", "25-34", "35-44", "45-54", "55+"];
const INTEREST_OPTIONS = ["Gaming", "Music", "Movies", "Travel", "Technology", "Art", "Sports", "Reading", "Fitness", "Food"];

function ProfileForm() {
  const profile = useQuery(api.profiles.getProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const updateName = useMutation(api.profiles.updateName);
  
  const searchParams = useSearchParams();
  const mode = (searchParams?.get("mode") as "language" | "game" | "topic" | "debate" | "politics") || "language";
  const router = useRouter();

  const [name, setName] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [learningLanguage, setLearningLanguage] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [game, setGame] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [debateTopic, setDebateTopic] = useState("");
  const [politicsTopic, setPoliticsTopic] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setNativeLanguage(profile.nativeLanguage || "");
      setLearningLanguage(profile.learningLanguage || "");
      setAgeGroup(profile.ageGroup || "");
      setInterests(profile.interests || []);
      setGame(profile.game || "");
      setTopics(profile.topics || []);
      setDebateTopic(profile.debateTopic || "");
      setPoliticsTopic(profile.politicsTopic || "");
    }
  }, [profile]);

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a valid display name.");
      return;
    }
    if (!nativeLanguage || !learningLanguage || !ageGroup) {
      alert("Please fill in the required fields (Languages and Age Group)");
      return;
    }
    
    setIsSaving(true);
    try {
      // Save display name in users table
      await updateName({ name });

      // Save profile preferences
      await updateProfile({
        nativeLanguage,
        learningLanguage,
        ageGroup,
        interests,
        ...(mode === "game" && { game }),
        ...(mode === "topic" && { topics }),
        ...(mode === "debate" && { debateTopic }),
        ...(mode === "politics" && { politicsTopic }),
      });
      router.push("/call");
    } catch (e) {
      console.error(e);
      alert("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (profile === undefined) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
      </div>
    );
  }

  if (profile === null) {
    router.push("/login?next=/profile");
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Redirecting to login...</p>
      </div>
    );
  }

  const userEmail = profile.email || "user@shifu.com";
  const userInitials = name ? name.substring(0, 2) : userEmail.substring(0, 2);
  const tier = profile.subscriptionTier || "free";

  return (
    <div className={styles.container}>
      <div className={styles.profileWrapper}>
        {/* Top Premium Banner */}
        <div className={styles.banner}></div>

        {/* Profile Header Block */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>{userInitials}</div>
            <div className={styles.userInfo}>
              <h2 className={styles.userName}>{name || "Anonymous User"}</h2>
              <p className={styles.userHandle}>@{userEmail.split("@")[0]}</p>
            </div>
          </div>

          {/* Quick Statistics and Badge indicators */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <Award className={styles.statIcon} />
              <div className={styles.statText}>
                <h4>Membership</h4>
                <p>
                  {tier === "pro" && <span className={styles.badgePro}>PRO</span>}
                  {tier === "premium" && <span className={styles.badgePremium}>PREMIUM</span>}
                  {tier === "free" && <span className={styles.badgeFree}>FREE</span>}
                </p>
              </div>
            </div>
            <div className={styles.statCard}>
              <Globe className={styles.statIcon} />
              <div className={styles.statText}>
                <h4>Talk limit</h4>
                <p>{tier === "free" ? "15 mins daily" : (tier === "pro" ? "2 hrs daily" : "Unlimited")}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <Mail className={styles.statIcon} />
              <div className={styles.statText}>
                <h4>Email</h4>
                <p style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{userEmail}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Container: Two Columns */}
        <div className={styles.gridForm}>
          
          {/* Left Column: Personal Identity */}
          <div className={styles.formColumn}>
            <h3 className={styles.sectionTitle}>
              <User size={18} /> Personal Identity
            </h3>

            {/* Display Name Input */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Display Name *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Enter display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Native Language Select */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Native Language *</label>
              <select 
                className={styles.select} 
                value={nativeLanguage} 
                onChange={(e) => setNativeLanguage(e.target.value)}
              >
                <option value="">Select your native language</option>
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* Learning Language Select */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Language you want to speak *</label>
              <select 
                className={styles.select} 
                value={learningLanguage} 
                onChange={(e) => setLearningLanguage(e.target.value)}
              >
                <option value="">Select language to learn/speak</option>
                {LANGUAGES.filter(l => l !== nativeLanguage).map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* Age Group Chips */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Age Group *</label>
              <div className={styles.chipsContainer}>
                {AGE_GROUPS.map(age => (
                  <button 
                    key={age}
                    className={`${styles.chip} ${ageGroup === age ? styles.chipActive : ''}`}
                    onClick={() => setAgeGroup(age)}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Preferences & Mode */}
          <div className={styles.formColumn}>
            <h3 className={styles.sectionTitle}>
              <Compass size={18} /> Call Preferences
            </h3>

            {/* Match Mode Selection */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Match Mode</label>
              <select className={styles.select} value={mode} onChange={(e) => router.replace(`/profile?mode=${e.target.value}`)}>
                <option value="language">Language Only</option>
                <option value="game">Game Teammates</option>
                <option value="topic">General Topic</option>
                <option value="debate">Debate</option>
                <option value="politics">Politics Discussion</option>
              </select>
            </div>

            {/* Contextual Mode Fields */}
            {mode === "game" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Game (e.g. Fortnite, Valorant) *</label>
                <div style={{ position: "relative" }}>
                  <Gamepad2 size={16} className={styles.inputIcon} />
                  <input
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    type="text"
                    placeholder="Enter game title"
                    value={game}
                    onChange={e => setGame(e.target.value.toLowerCase())}
                  />
                </div>
              </div>
            )}
            {mode === "topic" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Topics (comma separated) *</label>
                <div style={{ position: "relative" }}>
                  <BookOpen size={16} className={styles.inputIcon} />
                  <input
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    type="text"
                    placeholder="e.g., tech, travel, music"
                    value={topics.join(",")}
                    onChange={e => setTopics(e.target.value.split(',').map(t => t.trim()))}
                  />
                </div>
              </div>
            )}
            {mode === "debate" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Debate Subject *</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g., AI and the future of work"
                  value={debateTopic}
                  onChange={e => setDebateTopic(e.target.value)}
                />
              </div>
            )}
            {mode === "politics" && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Political Topic or Stance *</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g., centrist, global economics"
                  value={politicsTopic}
                  onChange={e => setPoliticsTopic(e.target.value)}
                />
              </div>
            )}

            {/* Interest Chips */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Interests / Tags</label>
              <div className={styles.chipsContainer}>
                {INTEREST_OPTIONS.map(interest => (
                  <button 
                    key={interest}
                    className={`${styles.chip} ${interests.includes(interest) ? styles.chipActive : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={styles.footerActions}>
          <button 
            className={styles.btnSave} 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? "Saving details..." : "Save Preferences & Connect"} 
            {!isSaving && <ArrowRight className={styles.btnIcon} />}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <Suspense fallback={
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
      </div>
    }>
      <ProfileForm />
    </Suspense>
  );
}
