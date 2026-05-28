import re

with open('src/app/call/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace(
    'import { useEffect, useState, useRef } from "react";',
    'import { useEffect, useState, useRef, useCallback } from "react";'
)

# Extract handleAction, handleSkip, setupWebRTC
setupWebRTC_old = """  const setupWebRTC = async (isUser1: boolean) => {
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
  };"""

handleAction_old = """  const handleAction = async (action: "accept" | "decline" | "end") => {
    if (matchId) {
      await updateMatchStatus({ matchId, action });
    }
  };"""

handleSkip_old = """  const handleSkip = () => {
    if (matchId) handleAction("end");
    setMatchId(null);
    hasStartedCall.current = false;
    setRemoteStream(null);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };"""

# Remove them from old locations
content = content.replace(setupWebRTC_old + "\n\n", "")
content = content.replace(setupWebRTC_old + "\n", "")
content = content.replace(setupWebRTC_old, "")

content = content.replace(handleAction_old + "\n\n", "")
content = content.replace(handleAction_old + "\n", "")
content = content.replace(handleAction_old, "")

content = content.replace(handleSkip_old + "\n\n", "")
content = content.replace(handleSkip_old + "\n", "")
content = content.replace(handleSkip_old, "")

# New definitions
new_funcs = """  const handleAction = useCallback(async (action: "accept" | "decline" | "end") => {
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
"""

# Insert new funcs before 1st useEffect
content = content.replace('  // 1. Get user media and find a match', new_funcs + '\n  // 1. Get user media and find a match')

# Update useEffect dependencies
content = content.replace('}, [match, profile, localStream]);', '}, [match, profile, localStream, handleSkip, setupWebRTC]);')
content = content.replace('}, [match?.sdpOffer, match?.sdpAnswer]);', '}, [match, profile, setSDP]);')
content = content.replace('}, [candidates]);', '}, [candidates, profile]);')

# Remove otherStatus
content = content.replace('  const otherStatus = isUser1 ? match?.user2Status : match?.user1Status;\n', '')

with open('src/app/call/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
