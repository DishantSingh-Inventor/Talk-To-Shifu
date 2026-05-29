"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "../../../convex/_generated/dataModel";
import styles from "./call.module.css";
import { Video, VideoOff, Mic, MicOff, PhoneOff, AlertTriangle, UserPlus, SkipForward, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CallPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  if (isLoading) return <div className={styles.loading}>Loading...</div>;
  if (!isAuthenticated) return <button className={styles.loginBtn} onClick={() => void signIn('google')}>Sign In</button>;
  const profile = useQuery(api.profiles.getProfile);
  const findMatch = useMutation(api.matches.findMatch);
  const updateMatchStatus = useMutation(api.matches.updateMatchStatus);
  const setSDP = useMutation(api.matches.setSDP);
  const addIceCandidate = useMutation(api.matches.addIceCandidate);
  const incrementCallTime = useMutation(api.profiles.incrementCallTime);

  const [matchId, setMatchId] = useState<Id<"matches"> | null>(null);
  const match = useQuery(api.matches.getMatch, matchId ? { matchId } : "skip");
  const candidates = useQuery(api.matches.getIceCandidates, matchId ? { matchId } : "skip");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [showAd, setShowAd] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const hasStartedCall = useRef(false);

  const handleAction = useCallback(async (action: "accept" | "decline" | "end") => {
    if (matchId) {
      await updateMatchStatus({ matchId, action });
    }
  }, [matchId, updateMatchStatus]);

  const handleSkip = useCallback(() => {
    if (matchId) handleAction("end");
    setMatchId(null);
    hasStartedCall.current = false;
    setRemoteStream(null);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  }, [matchId, handleAction]);

  const setupWebRTC = useCallback(async (isUser1: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnection.current = pc;

    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && matchId) {
        addIceCandidate({ matchId, candidate: JSON.stringify(event.candidate) });
      }
    };

    if (isUser1) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (matchId) {
        await setSDP({ matchId, type: "offer", sdp: JSON.stringify(offer) });
      }
    }
  }, [localStream, matchId, addIceCandidate, setSDP]);

  // 1. Get user media and find a match
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        // Find match if profile is loaded
        if (profile) {
          const mId = await findMatch();
          setMatchId(mId);
        }
      } catch (e: any) {
        console.warn("Media access warning or match error:", e);
        if (e.message?.includes("DAILY_LIMIT_REACHED")) {
          setMediaError("You have reached your daily call limit. Please upgrade your subscription to continue calling non-friends.");
          return;
        }

        // If video not available, fallback to audio only
        if (e instanceof DOMException && e.name === "NotReadableError") {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setLocalStream(audioStream);
            if (localVideoRef.current) localVideoRef.current.srcObject = audioStream;
            setIsVideoOff(true);
            // Proceed with matching using audio only
            if (profile) {
              const mId = await findMatch();
              setMatchId(mId);
            }
          } catch (audioErr: any) {
            console.warn("Audio fallback failed:", audioErr);
            if (audioErr.message?.includes("DAILY_LIMIT_REACHED")) {
              setMediaError("You have reached your daily call limit. Please upgrade your subscription to continue calling non-friends.");
            } else if (audioErr instanceof DOMException) {
              setMediaError("Camera and microphone access is required. Please allow permissions and retry.");
            } else {
              setMediaError(`Backend Error: ${audioErr.message || audioErr}`);
            }
          }
        } else if (e instanceof DOMException) {
          setMediaError("Camera and microphone access is required. Please allow permissions and retry.");
        } else {
          setMediaError(`Backend Error: ${e.message || e}`);
        }
      }
    };
    
    if (profile && !matchId) {
      init();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [profile, matchId, findMatch]);

  // 2. Handle connection acceptance and WebRTC setup
  useEffect(() => {
    if (!match || !profile || !localStream) return;

    const isUser1 = match.user1 === profile.userId;

    if (match.status === "ended") {
      // Cleanup and find next match
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSkip();
      return;
    }

    if (match.status === "active" && !hasStartedCall.current) {
      hasStartedCall.current = true;
      setupWebRTC(isUser1);
      if (profile.subscriptionTier !== "pro" && profile.subscriptionTier !== "premium") {
        setShowAd(true);
      }
    }
  }, [match, profile, localStream, handleSkip, setupWebRTC]);

  // Heartbeat for Call Limit
  useEffect(() => {
    if (match?.status !== "active" || !profile) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await incrementCallTime({ matchId: match._id, intervalSeconds: 10 });
        if (!res.allowed) {
          alert("You have reached your daily call limit. Please upgrade your subscription to continue calling non-friends.");
          handleSkip();
          router.push("/pricing");
        }
      } catch (err) {
        console.error("Heartbeat error", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [match, profile, incrementCallTime, handleSkip, router]);

  // 3. Handle WebRTC Signaling (SDP and ICE)
  useEffect(() => {
    if (!match || !profile || !peerConnection.current) return;
    const isUser1 = match.user1 === profile.userId;
    const pc = peerConnection.current;

    const handleSignaling = async () => {
      if (!isUser1 && match.sdpOffer && pc.signalingState === "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpOffer)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await setSDP({ matchId: match._id, type: "answer", sdp: JSON.stringify(answer) });
      }

      if (isUser1 && match.sdpAnswer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpAnswer)));
      }
    };

    handleSignaling();
  }, [match, profile, setSDP]);

  useEffect(() => {
    if (!candidates || !profile || !peerConnection.current) return;
    const pc = peerConnection.current;

    candidates.forEach(async (c) => {
      if (c.senderId !== profile.userId) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(c.candidate)));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    });
  }, [candidates, profile]);

  const toggleMute = () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
      // Invert audio track enabled state
      localStream.getAudioTracks()[0].enabled = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      // Invert video track enabled state
      localStream.getVideoTracks()[0].enabled = !isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);

  const handleAddFriend = async () => {
    if (match?.user2) {
      try {
        await sendFriendRequest({ targetId: match.user2 });
        alert('Friend request sent');
      } catch (e) {
        console.error('Error sending friend request', e);
        alert('Failed to send friend request');
      }
    } else {
      alert('No participant to add as friend');
    }
  };

  if (!profile) return <div className={styles.loading}>Loading profile...</div>;

  if (mediaError) {
    return (
      <div className={styles.container} style={{ justifyContent: "center", alignItems: "center", display: "flex" }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", padding: "2rem", borderRadius: "1rem", textAlign: "center", maxWidth: "400px" }}>
          <AlertTriangle size={48} color="red" style={{ marginBottom: "1rem" }} />
          <h2>Hardware Error</h2>
          <p>{mediaError}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "6px", background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
        </div>
      </div>
    );
  }

  const isUser1 = match?.user1 === profile.userId;
  const myStatus = isUser1 ? match?.user1Status : match?.user2Status;

  return (
    <div className={styles.container}>
      {showAd && (
        <div className={styles.adBanner}>
          <p>Advertisement: Support us or Upgrade to Pro to remove ads and get more calling time!</p>
          <button className={styles.adUpgradeBtn} onClick={() => router.push("/pricing")}>Upgrade Now</button>
        </div>
      )}
      <div className={styles.videoGrid}>
        <div className={styles.videoContainer}>
          <video ref={localVideoRef} autoPlay playsInline muted className={styles.video} />
          <div className={styles.videoLabel}>You</div>
        </div>
        
        <div className={styles.videoContainer}>
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
          ) : (
            <div className={styles.placeholderVideo}>
              {match?.status === "waiting" && <p>Finding someone...</p>}
              {match?.status === "connecting" && <p>Found someone! Waiting for acceptance...</p>}
            </div>
          )}
          <div className={styles.videoLabel}>Stranger</div>
        </div>
      </div>

      {/* Acceptance Overlay */}
      {match?.status === "connecting" && myStatus === "waiting" && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h2>Connection Found!</h2>
            <p>They matched your language preferences.</p>
            <div className={styles.dialogActions}>
              <button className={styles.btnDecline} onClick={() => handleAction("decline")}>
                <X size={20} /> Decline
              </button>
              <button className={styles.btnAccept} onClick={() => handleAction("accept")}>
                <Check size={20} /> Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        <button className={styles.controlBtn} onClick={toggleVideo} title={isVideoOff ? "Turn Video On" : "Turn Video Off"}>
          {isVideoOff ? <VideoOff /> : <Video />}
        </button>
        <button className={styles.controlBtnAction} title="Add Friend" onClick={handleAddFriend}>
          <UserPlus size={20} />
        </button>
        <button className={styles.controlBtnAction} title="Report User" onClick={() => setShowReportMenu(!showReportMenu)}>
          <AlertTriangle />
        </button>
        {showReportMenu && (
          <div className={styles.reportMenu} style={{ position: "absolute", bottom: "60px", right: "10px", background: "rgba(0,0,0,0.8)", color: "white", padding: "8px", borderRadius: "6px", zIndex: 10 }}>
            <p style={{ margin: 0, cursor: "pointer" }} onClick={() => { alert("Reported: Fake Interests"); setShowReportMenu(false); }}>Fake Interests</p>
            <p style={{ margin: 0, cursor: "pointer" }} onClick={() => { alert("Reported: Fake Native Language"); setShowReportMenu(false); }}>Fake Native Language</p>
            <p style={{ margin: 0, cursor: "pointer" }} onClick={() => { alert("Reported: Sexual Harassment"); setShowReportMenu(false); }}>Sexual Harassment</p>
            <p style={{ margin: 0, cursor: "pointer" }} onClick={() => { alert("Reported: Other"); setShowReportMenu(false); }}>Other</p>
          </div>
        )}
        <button className={styles.controlBtnSkip} onClick={handleSkip} title="Skip">
          <SkipForward /> Skip
        </button>
        <button className={styles.controlBtnEnd} onClick={() => router.push("/")} title="End Call">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
