"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ChatMessage {
  sender: "me" | "peer";
  text: string;
  timestamp: number;
}

export function useCallChat() {
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatReady, setIsChatReady] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastSentTimestamps = useRef<number[]>([]);
  const peerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear chat when call ends or skips
  const clearChat = useCallback(() => {
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch (e) {
        console.warn("Error closing data channel:", e);
      }
      dataChannelRef.current = null;
    }
    setMessages([]);
    setChatMessage("");
    setIsChatReady(false);
    setIsPeerTyping(false);
    setUnreadCount(0);
    isTypingRef.current = false;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
  }, []);

  // Set up data channel listeners
  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    console.log("Setting up DataChannel:", channel.label);
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log("DataChannel is open!");
      setIsChatReady(true);
    };

    channel.onclose = () => {
      console.log("DataChannel is closed!");
      setIsChatReady(false);
    };

    channel.onerror = (err) => {
      console.error("DataChannel error:", err);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat") {
          const newMsg: ChatMessage = {
            sender: "peer",
            text: data.text,
            timestamp: data.timestamp || Date.now(),
          };
          setMessages((prev) => [...prev, newMsg]);

          // Increment unread count if chat is closed
          setShowChat((currentShowChat) => {
            if (!currentShowChat) {
              setUnreadCount((prevCount) => prevCount + 1);
            }
            return currentShowChat;
          });
        } else if (data.type === "typing") {
          setIsPeerTyping(data.active);
          
          // Fallback timeout to clear typing indicator if peer disconnects or fails to send typing stop
          if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
          if (data.active) {
            peerTypingTimeoutRef.current = setTimeout(() => {
              setIsPeerTyping(false);
            }, 5000);
          }
        }
      } catch (e) {
        // Fallback for plain text messages in case peer is on old version
        console.warn("Failed to parse JSON message, treating as plain text:", e);
        const newMsg: ChatMessage = {
          sender: "peer",
          text: event.data,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setShowChat((currentShowChat) => {
          if (!currentShowChat) {
            setUnreadCount((prevCount) => prevCount + 1);
          }
          return currentShowChat;
        });
      }
    };
  }, []);

  // Send message implementation with length check, rate limiting and structured protocol
  const sendMessage = useCallback((textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : chatMessage).trim();
    if (!text) return;

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.warn("Data channel is not open.");
      return;
    }

    // Length limit check (500 characters)
    if (text.length > 500) {
      alert("Message is too long. Limit is 500 characters.");
      return;
    }

    // Rate limiting check (5 messages/second)
    const now = Date.now();
    lastSentTimestamps.current = lastSentTimestamps.current.filter((t) => now - t < 1000);
    if (lastSentTimestamps.current.length >= 5) {
      alert("You are sending messages too fast! Rate limit is 5 messages per second.");
      return;
    }
    lastSentTimestamps.current.push(now);

    // Send via DataChannel
    try {
      dataChannelRef.current.send(
        JSON.stringify({
          type: "chat",
          text: text,
          timestamp: now,
        })
      );

      // Append locally
      setMessages((prev) => [...prev, { sender: "me", text, timestamp: now }]);
      
      // Clear input
      if (textToSend === undefined) {
        setChatMessage("");
      }

      // Stop typing indicator immediately upon sending
      if (isTypingRef.current) {
        isTypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        dataChannelRef.current.send(JSON.stringify({ type: "typing", active: false }));
      }
    } catch (e) {
      console.error("Failed to send message over data channel:", e);
    }
  }, [chatMessage]);

  // Handle local typing indicator logic
  const handleTyping = useCallback((text: string) => {
    setChatMessage(text);

    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      try {
        dataChannelRef.current.send(JSON.stringify({ type: "typing", active: true }));
      } catch (e) {
        console.warn("Failed to send typing start indicator:", e);
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
        try {
          dataChannelRef.current.send(JSON.stringify({ type: "typing", active: false }));
        } catch (e) {
          console.warn("Failed to send typing stop indicator:", e);
        }
      }
    }, 1500);
  }, []);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
    };
  }, []);

  return {
    showChat,
    setShowChat,
    unreadCount,
    messages,
    chatMessage,
    setChatMessage,
    isChatReady,
    isPeerTyping,
    sendMessage,
    handleTyping,
    setupDataChannel,
    clearChat,
    dataChannelRef,
  };
}
