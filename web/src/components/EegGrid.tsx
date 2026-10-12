"use client";

import { useEffect, useState } from "react";
import { EegTile } from "./EegTile";

type Manifest = { fs: number; channels: string[]; tiles: { file: string; label: string }[] };

export function EegGrid() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/eeg/manifest.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="status">No EEG data. Run scripts/make_tiles.py first.</p>;
  if (!manifest) return <p className="status">Loading…</p>;

  return (
    <main className="grid">
      {manifest.tiles.map((t) => (
        <EegTile key={t.file} url={`/eeg/${t.file}`} label={t.label} fs={manifest.fs} nCh={manifest.channels.length} />
      ))}
    </main>
  );
}
