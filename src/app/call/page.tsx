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
  const updateMediaStatus = useMutation(api.matches.updateMediaStatus);

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
  const [pcInstance, setPcInstance] = useState<RTCPeerConnection | null>(null);

  // Helper declarations for reactive call parameters (defined at top to be accessible in hooks)
  const isUser1 = match?.user1 === profile?.userId;
  const myStatus = isUser1 ? match?.user1Status : match?.user2Status;
  const isConnected = match?.status === "active";
  const myDisplayName = isConnected ? `${isUser1 ? match?.user1Name : match?.user2Name}` : "You";
  const peerDisplayName = isConnected ? `${isUser1 ? match?.user2Name : match?.user1Name}` : "Stranger";

  const peerMuted = isConnected ? (isUser1 ? match?.user2Muted : match?.user1Muted) : false;
  const peerVideoOff = isConnected ? (isUser1 ? match?.user2VideoOff : match?.user1VideoOff) : false;
  const peerSpeaking = isConnected ? (isUser1 ? match?.user2Speaking : match?.user1Speaking) : false;

  const myMuted = isMuted;
  const myVideoOff = isVideoOff;
  const mySpeaking = isConnected ? (isUser1 ? match?.user1Speaking : match?.user2Speaking) : false;
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteMediaStream = useRef<MediaStream | null>(null);
  const hasStartedCall = useRef(false);
  const addedCandidates = useRef<Set<string>>(new Set());
  const sdpOfferProcessed = useRef(false);
  const sdpAnswerProcessed = useRef(false);

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
    remoteMediaStream.current = null;
    setPcInstance(null);
    addedCandidates.current.clear();
    sdpOfferProcessed.current = false;
    sdpAnswerProcessed.current = false;
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
    console.log("Initializing RTCPeerConnection with STUN & TURN servers...");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:openrelay.metered.ca:80" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ]
    });

    peerConnection.current = pc;
    setPcInstance(pc);

    localStream?.getTracks().forEach(track => {
      console.log("Adding local track to PeerConnection:", track.kind);
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind, "Streams:", event.streams.map(s => s.id));
      if (event.streams && event.streams[0]) {
        console.log("Setting remote stream from event.streams[0] (wrapping in a new MediaStream instance to trigger React state updates)...");
        // Always wrap in a new MediaStream instance so the reference changes and React updates the video source
        setRemoteStream(new MediaStream(event.streams[0].getTracks()));
      } else {
        console.log("No streams found on event, reconstructing remoteMediaStream...");
        if (!remoteMediaStream.current) {
          remoteMediaStream.current = new MediaStream();
        }
        remoteMediaStream.current.addTrack(event.track);
        // Force React state update with a new MediaStream reference so UI re-renders
        setRemoteStream(new MediaStream(remoteMediaStream.current.getTracks()));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && matchId) {
        console.log("Local ICE candidate generated:", event.candidate.candidate);
        addIceCandidate({ matchId, candidate: JSON.stringify(event.candidate) });
      } else if (!event.candidate) {
        console.log("Local ICE candidate gathering completed.");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state change:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.warn("ICE connection failed! This usually means NAT traversal failed and a TURN server is required.");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state change:", pc.connectionState);
    };

    if (isUser1) {
      console.log("User 1: Creating offer SDP...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (matchId) {
        await setSDP({ matchId, type: "offer", sdp: JSON.stringify(offer) });
      }
    }
  }, [localStream, matchId, addIceCandidate, setSDP]);

  // 1. Get user media once on mount
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    const initMedia = async () => {
      try {
        console.log("Requesting camera and microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        activeStream = stream;
        setLocalStream(stream);
        
        // Enumerate devices once stream is initialized
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audios = devices.filter((d) => d.kind === "audioinput");
        const videos = devices.filter((d) => d.kind === "videoinput");
        setAudioDevices(audios);
        setVideoDevices(videos);
        if (audios.length > 0) setSelectedAudioId(audios[0].deviceId);
        if (videos.length > 0) setSelectedVideoId(videos[0].deviceId);
      } catch (e: any) {
        console.warn("Media access warning or fallback triggered:", e);

        // If video not available or blocked, fallback to audio only
        try {
          console.log("Attempting audio-only fallback...");
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          activeStream = audioStream;
          setLocalStream(audioStream);
          setIsVideoOff(true);
          
          // Enumerate devices for audio fallback
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audios = devices.filter((d) => d.kind === "audioinput");
          setAudioDevices(audios);
          if (audios.length > 0) setSelectedAudioId(audios[0].deviceId);
        } catch (audioErr: any) {
          console.error("Audio fallback failed:", audioErr);
          if (audioErr.message?.includes("DAILY_LIMIT_REACHED")) {
            setMediaError("You have reached your daily call limit. Please upgrade your subscription to continue calling non-friends.");
          } else {
            setMediaError("Camera and microphone access is required. Please allow permissions and retry.");
          }
        }
      }
    };
    
    if (profile && !localStream && !mediaError) {
      initMedia();
    }
    
    return () => {
      if (activeStream) {
        console.log("Stopping all tracks of active local stream...");
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [profile, localStream, mediaError]);

  // 2. Perform matchmaking automatically when local stream is ready and matchId is empty
  useEffect(() => {
    if (!profile || !localStream || matchId || mediaError) return;

    let isSubscribed = true;

    const startMatching = async () => {
      try {
        console.log("Searching for a new match on Convex...");
        const mId = await findMatch();
        if (isSubscribed) {
          console.log("Match successfully found with ID:", mId);
          setMatchId(mId);
        }
      } catch (err: any) {
        console.error("Matchmaking error:", err);
        if (isSubscribed) {
          if (err.message?.includes("DAILY_LIMIT_REACHED")) {
            setMediaError("You have reached your daily call limit. Please upgrade your subscription to continue calling non-friends.");
          } else {
            setMediaError(`Backend Error: ${err.message || err}`);
          }
        }
      }
    };

    startMatching();

    return () => {
      isSubscribed = false;
    };
  }, [profile, localStream, matchId, findMatch, mediaError]);

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

  // 3. Handle WebRTC Signaling (SDP offer/answer exchange)
  useEffect(() => {
    if (!match || !profile || !pcInstance) return;
    const isUser1 = match.user1 === profile.userId;
    const pc = pcInstance;

    const addPendingCandidates = async () => {
      if (!candidates) return;
      for (const c of candidates) {
        if (c.senderId !== profile.userId && !addedCandidates.current.has(c._id)) {
          try {
            const candidateInit = JSON.parse(c.candidate);
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            addedCandidates.current.add(c._id);
            console.log("Successfully added pending ICE candidate:", c._id);
          } catch (e) {
            console.warn("Failed to add pending ICE candidate:", e);
          }
        }
      }
    };

    const handleSignaling = async () => {
      if (!isUser1 && match.sdpOffer && !sdpOfferProcessed.current) {
        try {
          sdpOfferProcessed.current = true;
          console.log("User 2: Setting remote offer SDP...");
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpOffer)));
          console.log("User 2: Creating local answer SDP...");
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log("User 2: Sending answer SDP...");
          await setSDP({ matchId: match._id, type: "answer", sdp: JSON.stringify(answer) });
          // Now that remote description is set, add any pending candidates immediately
          await addPendingCandidates();
        } catch (err) {
          console.error("Error during User2 signaling setup:", err);
          sdpOfferProcessed.current = false;
        }
      }

      if (isUser1 && match.sdpAnswer && !sdpAnswerProcessed.current) {
        try {
          sdpAnswerProcessed.current = true;
          console.log("User 1: Setting remote answer SDP...");
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(match.sdpAnswer)));
          // Now that remote description is set, add any pending candidates immediately
          await addPendingCandidates();
        } catch (err) {
          console.error("Error during User1 signaling setup:", err);
          sdpAnswerProcessed.current = false;
        }
      }
    };

    handleSignaling();
  }, [match, profile, pcInstance, setSDP, candidates]);

  // 4. Handle incoming ICE candidates continuously as they arrive
  useEffect(() => {
    if (!candidates || !profile || !pcInstance) return;
    const pc = pcInstance;

    candidates.forEach(async (c) => {
      if (c.senderId !== profile.userId && !addedCandidates.current.has(c._id)) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            const candidateInit = JSON.parse(c.candidate);
            console.log("Adding inline ICE candidate:", candidateInit.candidate);
            await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            addedCandidates.current.add(c._id);
            console.log("Successfully added inline ICE candidate:", c._id);
          } catch (e) {
            console.warn("Failed to add inline ICE candidate:", e);
          }
        } else {
          console.log("Skipping inline ICE candidate (remoteDescription not set yet):", c._id);
        }
      }
    });
  }, [candidates, profile, pcInstance]);

  // 5. Synchronize local video element srcObject with fallback/programmatic play
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        console.log("Setting local video srcObject");
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(err => console.warn("Local play blocked:", err));
    }
  }, [localStream, isVideoOff]);

  // 6. Synchronize remote video element srcObject with fallback/programmatic play
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        console.log("Setting remote video srcObject");
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(err => console.warn("Remote play blocked:", err));
    }
  }, [remoteStream, peerVideoOff]);

  const toggleMute = () => {
    if (localStream && localStream.getAudioTracks().length > 0) {
      const nextMute = !isMuted;
      localStream.getAudioTracks()[0].enabled = !nextMute;
      setIsMuted(nextMute);
      if (matchId) {
        updateMediaStatus({ matchId, muted: nextMute });
      }
    }
  };

  const toggleVideo = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      const nextVideoOff = !isVideoOff;
      localStream.getVideoTracks()[0].enabled = !nextVideoOff;
      setIsVideoOff(nextVideoOff);
      if (matchId) {
        updateMediaStatus({ matchId, videoOff: nextVideoOff });
      }
    }
  };

  // Speaking detection using Web Audio API (PCM Time Domain Peak amplitude)
  useEffect(() => {
    if (!localStream || isMuted || !matchId) {
      if (matchId) {
        updateMediaStatus({ matchId, speaking: false });
      }
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;

    const detectSpeaking = () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let lastSpeakingState = false;
        let silenceCounter = 0;

        const checkVolume = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(dataArray);

          // Find maximum deviation from silence center (128 in 8-bit unsigned PCM)
          let maxVal = 0;
          for (let i = 0; i < bufferLength; i++) {
            const val = Math.abs(dataArray[i] - 128);
            if (val > maxVal) {
              maxVal = val;
            }
          }

          // speaking peak amplitude threshold
          const isSpeaking = maxVal > 25;

          if (isSpeaking) {
            silenceCounter = 0;
            if (!lastSpeakingState) {
              lastSpeakingState = true;
              updateMediaStatus({ matchId, speaking: true });
            }
          } else {
            silenceCounter++;
            if (silenceCounter > 20) { // require 20 frames of silence to avoid flickering
              if (lastSpeakingState) {
                lastSpeakingState = false;
                updateMediaStatus({ matchId, speaking: false });
              }
            }
          }

          animationFrameId = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch (err) {
        console.warn("Audio Context speaking detection failed:", err);
      }
    };

    detectSpeaking();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
    };
  }, [localStream, isMuted, matchId, updateMediaStatus]);

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


  return (
    <div className={styles.container}>
      {showAd && (
        <div className={styles.adBanner}>
          <p>Advertisement: Support us or Upgrade to Pro to remove ads and get more calling time!</p>
          <button className={styles.adUpgradeBtn} onClick={() => router.push("/pricing")}>Upgrade Now</button>
        </div>
      )}
      <div className={styles.videoGrid}>
        {/* Local Video Container */}
        <div className={`${styles.videoContainer} ${mySpeaking ? styles.speakingActive : ""}`}>
          {myVideoOff ? (
            <div className={styles.avatarPlaceholderContainer}>
              <div className={`${styles.avatarBig} ${mySpeaking ? styles.speakingPulse : ""}`}>
                {myDisplayName.substring(0, 2).toUpperCase()}
              </div>
              {mySpeaking && (
                <div className={styles.speakingWave}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              <p className={styles.placeholderText}>Camera is off</p>
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay playsInline muted className={styles.video} />
          )}
          <div className={styles.videoLabel}>
            {myDisplayName}
            {myMuted && <MicOff size={14} className={styles.mutedBadge} />}
          </div>
        </div>
        
        {/* Stranger Video Container */}
        <div className={`${styles.videoContainer} ${peerSpeaking ? styles.speakingActive : ""}`}>
          {peerVideoOff || !remoteStream ? (
            <div className={styles.avatarPlaceholderContainer}>
              <div className={`${styles.avatarBig} ${peerSpeaking ? styles.speakingPulse : ""}`}>
                {peerDisplayName.substring(0, 2).toUpperCase()}
              </div>
              {peerSpeaking && (
                <div className={styles.speakingWave}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
              {(!remoteStream && match?.status === "waiting") && <p className={styles.placeholderText}>Finding someone...</p>}
              {(!remoteStream && match?.status === "connecting") && <p className={styles.placeholderText}>Found someone! Connecting call...</p>}
              {(remoteStream && peerVideoOff) && <p className={styles.placeholderText}>Camera is turned off</p>}
            </div>
          ) : (
            <video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
          )}
          <div className={styles.videoLabel}>
            {peerDisplayName}
            {peerMuted && <MicOff size={14} className={styles.mutedBadge} />}
          </div>
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
