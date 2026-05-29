"use client";

import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTheme } from "./ThemeProvider";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Video, Moon, Sun, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import styles from "./Header.module.css";
import { useEffect, useState, useRef } from "react";

export function Header() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifications = useQuery(api.notifications.listNotifications, isAuthenticated ? {} : "skip") || [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markRead = useMutation(api.notifications.markRead);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNotificationClick = (n: any) => {
    if (!n.read) {
      markRead({ notificationId: n._id });
    }
    setShowNotifications(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navigate = (path: string) => {
    router.push(path);
    closeMenu();
  };

  return (
    <nav className={styles.nav} ref={menuRef}>
      <Link href="/" className={styles.logo} onClick={closeMenu}>
        <Video className={styles.logoIcon} />
        <span>Talk to Shifu</span>
      </Link>

      {/* Desktop nav links */}
      <div className={styles.desktopLinks}>
        <Link href="/about" className={styles.navLink}>About</Link>
        <Link href="/pricing" className={styles.navLink}>Pricing</Link>
        {isAuthenticated && (
          <>
            <Link href="/friends" className={styles.navLink}>
              Friends
            </Link>
            <Link href="/profile" className={styles.navLink}>Profile</Link>
          </>
        )}
      </div>

      <div className={styles.desktopRight}>
        {mounted && (
          <button
            className={styles.iconBtn}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        {/* Notifications bell — desktop */}
        {isAuthenticated && (
          <div className={styles.notificationWrapper}>
            <button
              className={styles.iconBtn}
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className={styles.notificationMenu}>
                {notifications.map((n) => (
                  <p key={n._id} onClick={() => handleNotificationClick(n)}>
                    {n.type}: {n.payload?.message || ""}
                  </p>
                ))}
                {notifications.length === 0 && <p>No notifications</p>}
              </div>
            )}
          </div>
        )}

        {!isLoading && (
          isAuthenticated ? (
            <button className={styles.btnOutline} onClick={() => void signOut()}>
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <button className={styles.btnPrimary} onClick={() => void signIn("google")}>
              Login with Google
            </button>
          )
        )}
      </div>

      {/* Hamburger — visible on mobile */}
      <button
        className={styles.hamburger}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link href="/about" className={styles.mobileLink} onClick={closeMenu}>About Us</Link>
          <Link href="/pricing" className={styles.mobileLink} onClick={closeMenu}>Pricing</Link>
          {isAuthenticated && (
            <>
              <button className={styles.mobileLink} onClick={() => navigate("/friends")}>
                Friends
              </button>
              <button className={styles.mobileLink} onClick={() => navigate("/profile")}>
                Profile & Settings
              </button>
              <button className={styles.mobileLink} onClick={() => {
                setShowNotifications(!showNotifications);
              }}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </button>
              {showNotifications && (
                <div className={styles.notificationInline}>
                  {notifications.map((n) => (
                    <p key={n._id} onClick={() => { handleNotificationClick(n); closeMenu(); }}>
                      {n.type}: {n.payload?.message || ""}
                    </p>
                  ))}
                  {notifications.length === 0 && <p>No notifications</p>}
                </div>
              )}
            </>
          )}

          <div className={styles.mobileDivider} />

          {mounted && (
            <button className={styles.mobileLink} onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              closeMenu();
            }}>
              {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          )}

          {!isLoading && (
            isAuthenticated ? (
              <button className={styles.mobileLinkDanger} onClick={() => { void signOut(); closeMenu(); }}>
                Sign Out
              </button>
            ) : (
              <button className={styles.mobileLinkPrimary} onClick={() => { void signIn("google"); closeMenu(); }}>
                Login with Google
              </button>
            )
          )}
        </div>
      )}
    </nav>
  );
}
