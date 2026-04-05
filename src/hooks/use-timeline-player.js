'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimelinePlayer(events, { speed = 30, gapThresholdMs = 800 } = {}) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  useEffect(() => {
    stop();
    setCursor(0);
  }, [events]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback(() => {
    clearTimer();
    const idx = cursorRef.current;
    if (!playingRef.current || idx >= events.length - 1) {
      if (idx >= events.length - 1) setPlaying(false);
      return;
    }

    const curr = events[idx];
    const next = events[idx + 1];
    if (!curr || !next) return;

    const realGapMs = new Date(next.timestamp) - new Date(curr.timestamp);
    const scaledGap = realGapMs / speed;
    const delay = Math.min(scaledGap, gapThresholdMs);

    timerRef.current = setTimeout(() => {
      if (!playingRef.current) return;
      const nextIdx = cursorRef.current + 1;
      cursorRef.current = nextIdx;
      setCursor(nextIdx);
      scheduleNext();
    }, Math.max(delay, 50));
  }, [events, speed, gapThresholdMs]);

  const play = useCallback(() => {
    if (events.length === 0) return;
    if (cursorRef.current >= events.length - 1) {
      cursorRef.current = 0;
      setCursor(0);
    }
    playingRef.current = true;
    setPlaying(true);
    scheduleNext();
  }, [events, scheduleNext]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    clearTimer();
  }, []);

  const stop = useCallback(() => {
    pause();
  }, [pause]);

  const seekTo = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(events.length - 1, idx));
    cursorRef.current = clamped;
    setCursor(clamped);
    if (playingRef.current) scheduleNext();
  }, [events.length, scheduleNext]);

  const stepForward = useCallback(() => {
    pause();
    seekTo(cursorRef.current + 1);
  }, [pause, seekTo]);

  const stepBack = useCallback(() => {
    pause();
    seekTo(cursorRef.current - 1);
  }, [pause, seekTo]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause(); else play();
  }, [play, pause]);

  useEffect(() => () => clearTimer(), []);

  const currentEvent = events[cursor] ?? null;
  const progress = events.length > 1 ? cursor / (events.length - 1) : 0;

  return {
    cursor,
    playing,
    currentEvent,
    progress,
    play,
    pause,
    stop,
    seekTo,
    stepForward,
    stepBack,
    togglePlay,
  };
}
