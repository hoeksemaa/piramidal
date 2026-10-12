"use client";

import { useEffect, useState } from "react";
import { EegTile } from "./EegTile";

type Tile = { file: string; probs: number[][] };
type Manifest = { fs: number; channels: string[]; classes: string[]; prob_step_s: number; tiles: Tile[] };
type Loaded = { manifest: Manifest; clips: Int16Array[]; t0: number };

export function EegGrid() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const manifest: Manifest = await (await fetch("/eeg/manifest.json")).json();
      const clips = await Promise.all(
        manifest.tiles.map(async (t) => new Int16Array(await (await fetch(`/eeg/${t.file}`)).arrayBuffer())),
      );
      // One shared start time, so every patient's clip plays in step.
      setLoaded({ manifest, clips, t0: performance.now() });
    })().catch(() => setError(true));
  }, []);

  if (error) return <p className="status">No EEG data. Run scripts/build_beds.py first.</p>;
  if (!loaded) return <p className="status">Loading recordings…</p>;

  const { manifest, clips, t0 } = loaded;
  return (
    <main className="grid">
      {manifest.tiles.map((t, i) => (
        <EegTile
          key={t.file}
          bed={i + 1}
          data={clips[i]}
          probs={t.probs}
          classes={manifest.classes}
          stepS={manifest.prob_step_s}
          t0={t0}
          fs={manifest.fs}
          nCh={manifest.channels.length}
        />
      ))}
    </main>
  );
}
