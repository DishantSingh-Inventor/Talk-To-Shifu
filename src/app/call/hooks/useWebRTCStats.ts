"use client";

import { useState, useEffect, useRef } from "react";

export type ConnectionQuality = "Good" | "Fair" | "Poor" | "Disconnected";

export function useWebRTCStats(pcInstance: RTCPeerConnection | null) {
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>("Disconnected");
  const [isUsingTurn, setIsUsingTurn] = useState(false);
  const hasLoggedTurnUsage = useRef(false);

  useEffect(() => {
    if (!pcInstance) {
      setConnectionQuality("Disconnected");
      setIsUsingTurn(false);
      hasLoggedTurnUsage.current = false;
      return;
    }

    const interval = setInterval(async () => {
      // Check states
      if (
        pcInstance.connectionState === "failed" ||
        pcInstance.connectionState === "closed" ||
        pcInstance.iceConnectionState === "failed" ||
        pcInstance.iceConnectionState === "closed"
      ) {
        setConnectionQuality("Poor");
        return;
      }

      if (
        pcInstance.connectionState !== "connected" &&
        pcInstance.iceConnectionState !== "connected" &&
        pcInstance.iceConnectionState !== "completed"
      ) {
        setConnectionQuality("Disconnected");
        return;
      }

      try {
        const stats = await pcInstance.getStats();
        let rtt = 0;
        let packetLoss = 0;
        let usingTurn = false;
        let activeCandidatePairFound = false;

        stats.forEach((report) => {
          // Check nominated succeeded candidate pair
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
            activeCandidatePairFound = true;
            if (typeof report.currentRoundTripTime === "number") {
              rtt = report.currentRoundTripTime * 1000; // to ms
            }

            // Get local candidate to inspect if it is TURN relay
            const localCandidate = stats.get(report.localCandidateId);
            if (localCandidate) {
              if (localCandidate.candidateType === "relay" || localCandidate.type === "relay") {
                usingTurn = true;
              }
            }
          }

          // Check inbound audio/video stream packet loss
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 1;
            packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
          }
        });

        setIsUsingTurn(usingTurn);

        if (activeCandidatePairFound && !hasLoggedTurnUsage.current) {
          hasLoggedTurnUsage.current = true;
          console.log(
            `[WebRTC Stats] Match connected. Connection Type: ${
              usingTurn
                ? "🔴 TURN Relay (Relayed via server - high cost, higher latency)"
                : "🟢 Direct P2P (STUN/Host - direct connection, zero cost, low latency)"
            }`
          );
        }

        // Quality rules
        if (rtt < 120 && packetLoss < 2) {
          setConnectionQuality("Good");
        } else if (rtt < 280 && packetLoss < 5) {
          setConnectionQuality("Fair");
        } else {
          setConnectionQuality("Poor");
        }
      } catch (err) {
        console.warn("Failed to check WebRTC stats:", err);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [pcInstance]);

  return {
    connectionQuality,
    isUsingTurn,
  };
}
