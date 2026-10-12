// All beds play on one clock. Playback starts START_S into each clip, so the
// longest view (the 20 s bed detail) is full from the first frame.
export const START_S = 20;

/** The newest sample index at time `now` (not wrapped to the clip length). */
export const sampleAt = (now: number, t0: number, fs: number) => Math.floor((START_S + (now - t0) / 1000) * fs);
