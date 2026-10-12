"use client";

import { useCallback, useEffect, useState } from "react";
import { NAMES } from "@/lib/names";
import { sampleAt } from "@/lib/playback";
import { BedDetail } from "./BedDetail";
import { EegTile } from "./EegTile";

type Tile = { file: string; info: string; probs: number[][]; start_s: number; clock_start_s: number | null };
type Manifest = { fs: number; channels: string[]; classes: string[]; prob_step_s: number; tiles: Tile[] };
type Loaded = { manifest: Manifest; clips: Int16Array[]; t0: number };

export function EegGrid() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [k, setK] = useState(0); // index of the latest model answer, the same for every bed
  const [open, setOpen] = useState<number | null>(null); // index of the opened bed
  const close = useCallback(() => setOpen(null), []);

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

  // All beds share the clock, sample rate, and clip length, so one timer tracks the latest
  // model answer for all of them. It changes every prob_step_s seconds.
  useEffect(() => {
    if (!loaded) return;
    const { manifest, clips, t0 } = loaded;
    const clipSamples = clips[0].length / manifest.channels.length;
    const answers = manifest.tiles[0].probs.length;
    let lastK = -1;
    let raf = 0;
    const tick = (now: number) => {
      const clipS = (sampleAt(now, t0, manifest.fs) % clipSamples) / manifest.fs;
      const kNow = Math.min(Math.floor(clipS / manifest.prob_step_s), answers - 1);
      if (kNow !== lastK) setK((lastK = kNow));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  if (error) return <p className="status">No EEG data. Run scripts/build_beds.py first.</p>;
  if (!loaded) return <p className="status">Loading recordings…</p>;

  const { manifest, clips, t0 } = loaded;
  return (
    <>
      <main className="grid">
        {manifest.tiles.map((t, i) => (
          <EegTile
            key={t.file}
            bed={i + 1}
            data={clips[i]}
            probs={t.probs}
            classes={manifest.classes}
            k={k}
            t0={t0}
            fs={manifest.fs}
            nCh={manifest.channels.length}
            onOpen={() => setOpen(i)}
          />
        ))}
      </main>
      {open !== null && (
        <BedDetail
          bed={open + 1}
          name={NAMES[open]}
          info={manifest.tiles[open].info}
          data={clips[open]}
          probs={manifest.tiles[open].probs}
          classes={manifest.classes}
          k={k}
          channels={manifest.channels}
          t0={t0}
          fs={manifest.fs}
          // Clock time when the dataset lists the recording's start; otherwise time since it started.
          axisStartS={manifest.tiles[open].clock_start_s ?? manifest.tiles[open].start_s}
          axisPrefix={manifest.tiles[open].clock_start_s === null ? "+" : ""}
          onClose={close}
        />
      )}
    </>
  );
}
