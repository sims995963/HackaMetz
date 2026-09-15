import { useEffect, useState } from 'react';
import { useServerOffset } from './useServerTime';

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
}

function compute(targetMs: number, nowMs: number): Countdown {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isOver: totalMs === 0,
  };
}

/** Compte à rebours vers une date ISO, recalculé chaque seconde sur l'heure serveur. */
export function useCountdown(targetIso: string | null | undefined): Countdown | null {
  const offset = useServerOffset();
  const targetMs = targetIso ? new Date(targetIso).getTime() : null;
  const [countdown, setCountdown] = useState<Countdown | null>(() =>
    targetMs === null ? null : compute(targetMs, Date.now() + offset),
  );

  useEffect(() => {
    if (targetMs === null) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(compute(targetMs, Date.now() + offset));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetMs, offset]);

  return countdown;
}
