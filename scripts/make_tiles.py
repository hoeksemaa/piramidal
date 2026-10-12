"""Cut one EEG clip per CHB-MIT patient for the web grid (23 patients, one cell each).

Usage:
  make_tiles.py CHBMIT_DIR --files    # print the chosen EDF per patient (args for fetch_chbmit.py)
  make_tiles.py CHBMIT_DIR OUT_DIR    # write OUT_DIR/<case>.i16 and OUT_DIR/manifest.json

Each patient's file is the first recording that has the 18 standard channels and a
seizure that starts at least CLIP_S into the file. All clips are CLIP_S long and play
together; each patient's seizure starts at a different moment of the clip (ONSETS).
Clips are filtered (60 Hz notch, 0.5-40 Hz bandpass), int16 uV, sample-major, at the
native 256 Hz.
"""
import json
import os
import re
import sys

import numpy as np

# chb21 is chb01 recorded 1.5 years later, so it is not a separate patient.
CASES = [f"chb{i:02d}" for i in range(1, 25) if i != 21]
# Standard double banana, as CHB-MIT names it.
CHANNELS = [
    "FP1-F7", "F7-T7", "T7-P7", "P7-O1", "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2", "FP2-F8", "F8-T8", "T8-P8", "P8-O2",
    "FZ-CZ", "CZ-PZ",
]
CLIP_S = 180
# Seizure onset in each clip (s): spread over 15-165 s, in a fixed shuffled order.
ONSETS = np.random.default_rng(0).permutation(np.linspace(15, 165, len(CASES)).round().astype(int))


def subject_info(src):
    """-> {case: "F, 11 y"} from SUBJECT-INFO (chb24 is not listed)."""
    info = {}
    for line in open(os.path.join(src, "SUBJECT-INFO")):
        parts = line.split()
        if len(parts) == 3 and parts[0].startswith("chb"):
            info[parts[0]] = f"{parts[1]}, {parts[2]} y"
    return info


def parse_summary(path):
    """-> list of (file, channels, [[start_s, end_s], ...]) in summary order."""
    files, chans = [], []
    for line in open(path):
        line = line.strip()
        if line.startswith(("Channels in EDF", "Channels changed")):
            chans = []
        elif m := re.match(r"Channel \d+: (\S+)", line):
            chans.append(m.group(1))
        elif line.startswith("File Name:"):
            files.append((line.split()[-1], list(chans), []))
        elif m := re.match(r"Seizure(?: \d+)? Start Time:\s*(\d+)", line):
            files[-1][2].append([int(m.group(1)), None])
        elif m := re.match(r"Seizure(?: \d+)? End Time:\s*(\d+)", line):
            files[-1][2][-1][1] = int(m.group(1))
    return files


def pick(src, case):
    """-> (file, seizure [start_s, end_s]) for one patient."""
    for name, chans, seizures in parse_summary(os.path.join(src, f"{case}-summary.txt")):
        if all(c in chans for c in CHANNELS):
            for sz in seizures:
                if sz[0] >= CLIP_S:
                    return name, sz
    raise ValueError(f"{case}: no usable seizure file")


def load(path):
    import mne

    raw = mne.io.read_raw_edf(path, preload=True, verbose="ERROR")
    # MNE renames duplicate channels, e.g. T8-P8 -> T8-P8-0, T8-P8-1.
    picks = [next(n for n in raw.ch_names if n == c or n.startswith(c + "-")) for c in CHANNELS]
    fs = raw.info["sfreq"]
    x = raw.get_data(picks=picks) * 1e6  # V -> uV
    x = mne.filter.notch_filter(x, fs, 60, verbose="ERROR")
    x = mne.filter.filter_data(x, fs, 0.5, 40, verbose="ERROR")
    return x, int(fs)


def main():
    src, out = sys.argv[1:3]
    picks = {case: pick(src, case) for case in CASES}
    if out == "--files":
        print(" ".join(f"{case}/{name}" for case, (name, _) in picks.items()))
        return
    os.makedirs(out, exist_ok=True)
    info = subject_info(src)
    tiles = []
    for (case, (name, (sz_start, sz_end))), onset in zip(picks.items(), ONSETS):
        x, fs = load(os.path.join(src, name))
        # If the file ends too soon after the seizure, start earlier.
        start = min(sz_start - int(onset), x.shape[1] // fs - CLIP_S)
        clip = x[:, start * fs : (start + CLIP_S) * fs]
        np.clip(np.round(clip), -32768, 32767).astype("<i2").T.tofile(os.path.join(out, f"{case}.i16"))
        tiles.append({
            "file": f"{case}.i16",
            "patient": case,
            "info": info.get(case, ""),
            "recording": name,
            "start_s": start,
            "seizure": [sz_start - start, sz_end - start],  # seconds into the clip
        })
        print(f"{case}  {name}  clip {start}-{start + CLIP_S} s  seizure at {sz_start - start}-{sz_end - start} s")
    manifest = {
        "fs": fs,
        "clip_s": CLIP_S,
        "channels": CHANNELS,
        "source": "CHB-MIT Scalp EEG Database (PhysioNet), ODC-By 1.0",
        "tiles": tiles,
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)


if __name__ == "__main__":
    main()
