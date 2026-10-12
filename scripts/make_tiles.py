"""Cut 20 five-minute EEG tiles from the CHB-MIT recordings for the web grid.

Usage: make_tiles.py CHBMIT_DIR OUT_DIR
Writes OUT_DIR/tileNN.i16 (int16 uV, sample-major, 18 channels) and OUT_DIR/manifest.json.
Filters: 60 Hz notch, 0.5-40 Hz bandpass. Keeps the native 256 Hz sample rate.
"""
import json
import os
import sys

import mne
import numpy as np

# Standard double banana, as CHB-MIT names it.
CHANNELS = [
    "FP1-F7", "F7-T7", "T7-P7", "P7-O1", "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2", "FP2-F8", "F8-T8", "T8-P8", "P8-O2",
    "FZ-CZ", "CZ-PZ",
]
# Recording -> first seizure start (s), from the chbNN-summary.txt files.
SEIZURE_START = {
    "chb01_18": 1720, "chb03_03": 432, "chb07_13": 3285,
    "chb15_22": 760, "chb18_35": 2196, "chb19_29": 2964,
}
N_TILES = 20
TILE_S = 300


def load(path):
    raw = mne.io.read_raw_edf(path, preload=True, verbose="ERROR")
    # MNE renames duplicate channels, e.g. T8-P8 -> T8-P8-0, T8-P8-1.
    picks = [next(n for n in raw.ch_names if n == c or n.startswith(c + "-")) for c in CHANNELS]
    fs = raw.info["sfreq"]
    x = raw.get_data(picks=picks) * 1e6  # V -> uV
    x = mne.filter.notch_filter(x, fs, 60, verbose="ERROR")
    x = mne.filter.filter_data(x, fs, 0.5, 40, verbose="ERROR")
    return x, int(fs)


def tile_starts(n_samples, fs, seizure_s, count):
    """First tile starts 30 s before the seizure; the rest are spread over seizure-free time."""
    sz = seizure_s - 30
    free = [s for s in range(0, n_samples // fs - TILE_S, TILE_S) if abs(s - sz) >= TILE_S]
    return [sz] + [free[(k * len(free)) // count] for k in range(1, count)]


def main():
    src, out = sys.argv[1:3]
    os.makedirs(out, exist_ok=True)
    recs = list(SEIZURE_START)
    per_rec = [N_TILES // len(recs) + (i < N_TILES % len(recs)) for i in range(len(recs))]
    tiles = []
    for rec, count in zip(recs, per_rec):
        x, fs = load(os.path.join(src, rec + ".edf"))
        for start in tile_starts(x.shape[1], fs, SEIZURE_START[rec], count):
            seg = x[:, start * fs : (start + TILE_S) * fs]
            name = f"tile{len(tiles):02d}.i16"
            data = np.clip(np.round(seg), -32768, 32767).astype("<i2").T  # (samples, channels)
            data.tofile(os.path.join(out, name))
            tiles.append({"file": name, "label": f"{rec} @ {start} s"})
            print(f"{name}  {rec}  {start}-{start + TILE_S} s")
    manifest = {
        "fs": fs,
        "channels": CHANNELS,
        "source": "CHB-MIT Scalp EEG Database (PhysioNet), ODC-By 1.0",
        "tiles": tiles,
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)


if __name__ == "__main__":
    main()
