// All beds play on one clock. Playback starts START_S into each clip, so the
// longest view (the 20 s bed detail) is full from the first frame.
export const START_S = 20;

/** The newest sample index at time `now` (not wrapped to the clip length). */
export const sampleAt = (now: number, t0: number, fs: number) => Math.floor((START_S + (now - t0) / 1000) * fs);

/** Seconds -> "m:ss". */
export const mss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Seconds -> "HH:MM:SS", wrapped to one day. */
export const hms = (s: number) => {
  const t = ((Math.floor(s) % 86400) + 86400) % 86400;
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((v) => String(v).padStart(2, "0")).join(":");
};
