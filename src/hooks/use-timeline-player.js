'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  buildCumulativeSnapshot,
  recordVisualHold,
  mergeWithVisualHold,
  pruneVisualHold,
  MIN_VISUAL_DURATION_MS,
} from '@/lib/map/alert-engine';

const SPEED_OPTIONS = [1, 2, 5, 10];

export function useTimelinePlayer(
  events,
  { baseSpeed = 30, gapThresholdMs = 800 } = {},
) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  const visualHoldRef = useRef(new Map());
  const snapshotRef = useRef(null);

  const playingRef = useRef(false);
  const cursorRef = useRef(0);
  const speedRef = useRef(1);
  const timerRef = useRef(null);
  const pruneTimerRef = useRef(null);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    stop();
    setCursor(0);
    visualHoldRef.current.clear();
    snapshotRef.current = null;
    setSnapshotVersion(0);
  }, [events]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPruneTimer = () => {
    if (pruneTimerRef.current) {
      clearInterval(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
  };

  const updateSnapshot = useCallback(
    (idx) => {
      if (events.length === 0) return;
      const base = buildCumulativeSnapshot(events, idx);
      recordVisualHold(visualHoldRef.current, base, MIN_VISUAL_DURATION_MS);
      const merged = mergeWithVisualHold(base, visualHoldRef.current);
      snapshotRef.current = merged;
      setSnapshotVersion((v) => v + 1);
    },
    [events],
  );

  const startPruneLoop = useCallback(() => {
    clearPruneTimer();
    pruneTimerRef.current = setInterval(() => {
      const pruned = pruneVisualHold(visualHoldRef.current);
      if (pruned && events.length > 0) {
        const base = buildCumulativeSnapshot(events, cursorRef.current);
        const merged = mergeWithVisualHold(base, visualHoldRef.current);
        snapshotRef.current = merged;
        setSnapshotVersion((v) => v + 1);
      }
    }, 150);
  }, [events]);

  const stopPruneLoop = useCallback(() => {
    clearPruneTimer();
  }, []);

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
    const effectiveSpeed = baseSpeed * speedRef.current;
    const scaledGap = realGapMs / effectiveSpeed;
    const delay = Math.min(scaledGap, gapThresholdMs / speedRef.current);

    timerRef.current = setTimeout(
      () => {
        if (!playingRef.current) return;
        const nextIdx = cursorRef.current + 1;
        cursorRef.current = nextIdx;
        setCursor(nextIdx);
        updateSnapshot(nextIdx);
        scheduleNext();
      },
      Math.max(delay, 30),
    );
  }, [events, baseSpeed, gapThresholdMs, updateSnapshot]);

  const play = useCallback(() => {
    if (events.length === 0) return;
    if (cursorRef.current >= events.length - 1) {
      cursorRef.current = 0;
      setCursor(0);
      visualHoldRef.current.clear();
    }
    playingRef.current = true;
    setPlaying(true);
    updateSnapshot(cursorRef.current);
    startPruneLoop();
    scheduleNext();
  }, [events, scheduleNext, updateSnapshot, startPruneLoop]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    clearTimer();
    setTimeout(() => {
      if (!playingRef.current) stopPruneLoop();
    }, MIN_VISUAL_DURATION_MS + 500);
  }, [stopPruneLoop]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    clearTimer();
    stopPruneLoop();
  }, [stopPruneLoop]);

  const seekTo = useCallback(
    (idx) => {
      const clamped = Math.max(0, Math.min(events.length - 1, idx));
      cursorRef.current = clamped;
      setCursor(clamped);
      visualHoldRef.current.clear();
      updateSnapshot(clamped);
      if (playingRef.current) scheduleNext();
    },
    [events.length, scheduleNext, updateSnapshot],
  );

  const stepForward = useCallback(() => {
    pause();
    const next = Math.min(cursorRef.current + 1, events.length - 1);
    cursorRef.current = next;
    setCursor(next);
    visualHoldRef.current.clear();
    updateSnapshot(next);
  }, [pause, events.length, updateSnapshot]);

  const stepBack = useCallback(() => {
    pause();
    const prev = Math.max(cursorRef.current - 1, 0);
    cursorRef.current = prev;
    setCursor(prev);
    visualHoldRef.current.clear();
    updateSnapshot(prev);
  }, [pause, updateSnapshot]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [play, pause]);

  const cycleSpeed = useCallback(() => {
    setSpeedMultiplier((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
      speedRef.current = next;
      if (playingRef.current) {
        clearTimer();
        queueMicrotask(() => scheduleNext());
      }
      return next;
    });
  }, [scheduleNext]);

  const setSpeed = useCallback(
    (mult) => {
      if (!SPEED_OPTIONS.includes(mult)) return;
      speedRef.current = mult;
      setSpeedMultiplier(mult);
      if (playingRef.current) {
        clearTimer();
        queueMicrotask(() => scheduleNext());
      }
    },
    [scheduleNext],
  );

  useEffect(
    () => () => {
      clearTimer();
      clearPruneTimer();
    },
    [],
  );

  const currentEvent = events[cursor] ?? null;
  const progress = events.length > 1 ? cursor / (events.length - 1) : 0;

  return {
    cursor,
    playing,
    currentEvent,
    progress,
    speedMultiplier,
    speedOptions: SPEED_OPTIONS,
    timelineSnapshot: snapshotRef.current,
    snapshotVersion,
    play,
    pause,
    stop,
    seekTo,
    stepForward,
    stepBack,
    togglePlay,
    cycleSpeed,
    setSpeed,
  };
}
