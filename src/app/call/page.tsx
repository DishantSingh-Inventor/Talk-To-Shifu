"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import styles from "./call.module.css";
import { Video, VideoOff, Mic, MicOff, PhoneOff, AlertTriangle, UserPlus, SkipForward, Check, X, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CallPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.getProfile, isAuthenticated ? {} : "skip");
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

  // States for device selection
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>("");
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCamMenu, setShowCamMenu] = useState(false);
  
  const queuedCandidates = useRef<RTCIceCandidateInit[]>([]);
  
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

  // Refresh and list all available media devices
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audios = devices.filter((d) => d.kind === "audioinput");
      const videos = devices.filter((d) => d.kind === "videoinput");
      setAudioDevices(audios);
      setVideoDevices(videos);
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, []);

  // Switch microphone input track dynamically in-flight
  const switchAudioDevice = async (deviceId: string) => {
    try {
      setSelectedAudioId(deviceId);
      if (!localStream) return;

      // Stop existing audio tracks
      localStream.getAudioTracks().forEach((track) => track.stop());

      // Get new audio stream track for specific device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });
      const newTrack = newStream.getAudioTracks()[0];

      // Replace track in localStream
      localStream.getAudioTracks().forEach((track) => localStream.removeTrack(track));
      localStream.addTrack(newTrack);

      // Replace track in WebRTC active connection
      if (peerConnection.current) {
        const senders = peerConnection.current.getSenders();
        const audioSender = senders.find((s) => s.track && s.track.kind === "audio");
        if (audioSender) {
          await audioSender.replaceTrack(newTrack);
        }
      }

      // Keep the correct mute status
      newTrack.enabled = !isMuted;
    } catch (err) {
      console.error("Failed to switch microphone:", err);
    }
  };

  // Switch camera input track dynamically in-flight
  const switchVideoDevice = async (deviceId: string) => {
    try {
      setSelectedVideoId(deviceId);
      if (!localStream) return;

      // Stop existing video tracks
      localStream.getVideoTracks().forEach((track) => track.stop());

      // Get new video stream track for specific device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getVideoTracks()[0];

      // Replace track in localStream
      localStream.getVideoTracks().forEach((track) => localStream.removeTrack(track));
      localStream.addTrack(newTrack);

      // Update the local HTML video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Replace track in WebRTC active connection
      if (peerConnection.current) {
        const senders = peerConnection.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }
      }

      // Keep the correct video status
      newTrack.enabled = !isVideoOff;
    } catch (err) {
      console.error("Failed to switch camera:", err);
    }
  };

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
        
        // Enumerate devices once stream is initialized
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === "audioinput");
        const videos = devices.filter((d) => d.kind === "videoinput");
        setAudioDevices(audios);
        setVideoDevices(videos);
        if (audios.length > 0) setSelectedAudioId(audios[0].deviceId);
        if (videos.length > 0) setSelectedVideoId(videos[0].deviceId);

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
            
            // Enumerate devices for audio fallback
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audios = devices.filter((d) => d.kind === "audioinput");
            setAudioDevices(audios);
            if (audios.length > 0) setSelectedAudioId(audios[0].deviceId);

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

  // Auto-accept calls immediately when a match is found (bypassing manual Accept popup)
  useEffect(() => {
    if (!match || !profile) return;
    const isUser1 = match.user1 === profile.userId;
    const myStatus = isUser1 ? match.user1Status : match.user2Status;

    if (match.status === "connecting" && myStatus === "waiting") {
      handleAction("accept");
    }
  }, [match, profile, handleAction]);

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

    const processQueue = async () => {
      while (queuedCandidates.current.length > 0) {
        const candidate = queuedCandidates.current.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Error adding queued ice candidate:", e);
          }
        }
      }
    };

    const handleSignaling = async () => {
      if (!isUser1 && match.sdpOffer && pc.signalingState === "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpOffer)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await setSDP({ matchId: match._id, type: "answer", sdp: JSON.stringify(answer) });
        await processQueue();
      }

      if (isUser1 && match.sdpAnswer && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpAnswer)));
        await processQueue();
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
          const candidateInit = JSON.parse(c.candidate);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
          } else {
            // Queue candidate if remote description is not set yet
            if (!queuedCandidates.current.some((q) => q.candidate === candidateInit.candidate)) {
              queuedCandidates.current.push(candidateInit);
            }
          }
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    });
  }, [candidates, profile]);

  const toggleMute = () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
      localStream.getAudioTracks()[0].enabled = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
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

  // --- Render guards (after all hooks) ---

  if (authLoading) return <div className={styles.loading}>Loading...</div>;

  if (!isAuthenticated) {
    router.push("/login?next=/call");
    return <div className={styles.loading}>Redirecting to login...</div>;
  }

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
  const isConnected = match?.status === "active";
  const myDisplayName = isConnected ? `${isUser1 ? match?.user1Name : match?.user2Name}` : "You";
  const peerDisplayName = isConnected ? `${isUser1 ? match?.user2Name : match?.user1Name}` : "Stranger";

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
          <div className={styles.videoLabel}>{myDisplayName}</div>
        </div>
        
        <div className={styles.videoContainer}>
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
          ) : (
            <div className={styles.placeholderVideo}>
              {match?.status === "waiting" && <p>Finding someone...</p>}
              {match?.status === "connecting" && <p>Found someone! Connecting call...</p>}
            </div>
          )}
          <div className={styles.videoLabel}>{peerDisplayName}</div>
        </div>
      </div>

      {/* Manual Acceptance Overlay has been removed to skip and connect directly */}

      {/* Controls */}
      <div className={styles.controls}>
        {/* Microphone capsule with 3-dot option dropdown */}
        <div className={styles.controlWrapper}>
          <button className={styles.controlBtn} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <MicOff /> : <Mic />}
          </button>
          <button 
            className={styles.moreBtn} 
            onClick={() => {
              setShowMicMenu(!showMicMenu);
              setShowCamMenu(false);
              refreshDevices();
            }} 
            title="Microphone Options"
          >
            <MoreVertical size={16} />
          </button>
          {showMicMenu && (
            <div className={styles.deviceMenu}>
              <div className={styles.menuHeader}>Select Microphone</div>
              {audioDevices.length === 0 ? (
                <div className={styles.noDevices}>No microphones found</div>
              ) : (
                audioDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    className={`${styles.menuItem} ${selectedAudioId === device.deviceId ? styles.activeItem : ""}`}
                    onClick={() => {
                      switchAudioDevice(device.deviceId);
                      setShowMicMenu(false);
                    }}
                  >
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Camera capsule with 3-dot option dropdown */}
        <div className={styles.controlWrapper}>
          <button className={styles.controlBtn} onClick={toggleVideo} title={isVideoOff ? "Turn Video On" : "Turn Video Off"}>
            {isVideoOff ? <VideoOff /> : <Video />}
          </button>
          <button 
            className={styles.moreBtn} 
            onClick={() => {
              setShowCamMenu(!showCamMenu);
              setShowMicMenu(false);
              refreshDevices();
            }} 
            title="Camera Options"
          >
            <MoreVertical size={16} />
          </button>
          {showCamMenu && (
            <div className={styles.deviceMenu}>
              <div className={styles.menuHeader}>Select Camera</div>
              {videoDevices.length === 0 ? (
                <div className={styles.noDevices}>No cameras found</div>
              ) : (
                videoDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    className={`${styles.menuItem} ${selectedVideoId === device.deviceId ? styles.activeItem : ""}`}
                    onClick={() => {
                      switchVideoDevice(device.deviceId);
                      setShowCamMenu(false);
                    }}
                  >
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

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
