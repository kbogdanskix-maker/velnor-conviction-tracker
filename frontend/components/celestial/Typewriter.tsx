"use client";

import { useState, useEffect } from "react";
import { useAnimationPrefs } from "@/contexts/AnimationContext";

interface TypewriterProps {
  text: string;
  delay?: number;       // ms before typing starts
  speed?: number;       // ms per character
  className?: string;
  onDone?: () => void;
}

/**
 * Typewriter effect — types text one character at a time.
 * Renders a blinking cursor that disappears after completion.
 */
export default function Typewriter({
  text,
  delay = 0,
  speed = 35,
  className = "",
  onDone,
}: TypewriterProps) {
  const { prefs } = useAnimationPrefs();
  const skip = prefs.reduceMotion || prefs.disableTypewriter;

  const [displayed, setDisplayed] = useState(skip ? text : "");
  const [started, setStarted] = useState(skip);
  const [done, setDone] = useState(skip);

  useEffect(() => {
    if (skip) { setDisplayed(text); setDone(true); return; }
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay, skip, text]);

  useEffect(() => {
    if (skip || !started) return;
    if (displayed.length >= text.length) {
      setDone(true);
      onDone?.();
      return;
    }
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [started, displayed, text, speed, onDone, skip]);

  return (
    <span className={className}>
      {displayed}
      {!done && started && !skip && (
        <span className="inline-block w-[2px] h-[1em] bg-vela-teal/80 ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}
