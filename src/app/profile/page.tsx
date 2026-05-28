"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import styles from "./profile.module.css";
import { User, ArrowRight } from "lucide-react";

const LANGUAGES = ["English", "Spanish", "French", "German", "Hindi", "Mandarin", "Japanese", "Korean", "Italian", "Portuguese", "Russian", "Arabic"];
const AGE_GROUPS = ["13-18", "18-24", "25-34", "35-44", "45-54", "55+"];
const INTEREST_OPTIONS = ["Gaming", "Music", "Movies", "Travel", "Technology", "Art", "Sports", "Reading", "Fitness", "Food"];

function ProfileForm() {
  const profile = useQuery(api.profiles.getProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const searchParams = useSearchParams();
  const mode = (searchParams?.get("mode") as "language" | "game" | "topic" | "debate" | "politics") || "language";
  const router = useRouter();

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (!nativeLanguage || !learningLanguage || !ageGroup) {
      alert("Please fill in the required fields (Languages and Age Group)");
      return;
    }
    
    setIsSaving(true);
    try {
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

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <User className={styles.icon} />
          </div>
          <h1 className={styles.title}>Your Profile</h1>
          <p className={styles.subtitle}>Tell us about yourself to find the best matches.</p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Match Mode</label>
          <select className={styles.select} value={mode} onChange={(e) => router.replace(`/profile?mode=${e.target.value}`)}>
            <option value="language">Language Only</option>
            <option value="game">Game</option>
            <option value="topic">Topic</option>
            <option value="debate">Debate</option>
            <option value="politics">Politics</option>
          </select>
        </div>

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

        <div className={styles.formGroup}>
          <label className={styles.label}>Interests (Optional)</label>
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
        {mode === "game" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Game (Optional)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g., fortnite"
              value={game}
              onChange={e => setGame(e.target.value.toLowerCase())}
            />
          </div>
        )}
        {mode === "topic" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Topics (Optional, comma separated)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g., music,travel"
              value={topics.join(",")}
              onChange={e => setTopics(e.target.value.split(',').map(t => t.trim()))}
            />
          </div>
        )}
        {mode === "debate" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Debate Topic (Optional)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g., climate change"
              value={debateTopic}
              onChange={e => setDebateTopic(e.target.value)}
            />
          </div>
        )}
        {mode === "politics" && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Political Affiliation or Topic (Optional)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g., local elections, centrist"
              value={politicsTopic}
              onChange={e => setPoliticsTopic(e.target.value)}
            />
          </div>
        )}

        <button 
          className={styles.btnSave} 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Start Matching"} 
          {!isSaving && <ArrowRight className={styles.btnIcon} />}
        </button>
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
