"""Build the bed wall's data from raw CHB-MIT EDF files, through SPaRCNet.

Usage:
  build_beds.py CHBMIT_DIR --files                # print the chosen EDF per patient (args for fetch_chbmit.py)
  build_beds.py CHBMIT_DIR MODEL_PT OUT_DIR       # write OUT_DIR/<case>.i16 and OUT_DIR/manifest.json

One path from raw EEG to both outputs, so the wall shows exactly what the model sees:
  raw EDF -> SPaRCNet's 16 bipolar channels, in its order -> resample to 200 Hz
          -> 60 Hz notch + 0.5-40 Hz bandpass -> (a) the 3-minute display clip, int16 uV
                                                 (b) SPaRCNet: 6 class probabilities every 2 s
Prediction k covers clip time [2k - 10, 2k) s, so each clip is read with 10 s of history.

Each patient's file is the first recording that has the 16 channels and a seizure that
starts at least CLIP_S into the file. All clips play together; each patient's seizure
starts at a different moment of the clip (ONSETS).
"""
import json
import os
import re
import sys
from fractions import Fraction

import numpy as np
from scipy.signal import resample_poly
from scipy.stats import mannwhitneyu

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sparcnet  # noqa: E402

# chb21 is chb01 recorded 1.5 years later, so it is not a separate patient.
CASES = [f"chb{i:02d}" for i in range(1, 25) if i != 21]
# SPaRCNet's channels in its input order, with modern names (T7 = T3, P7 = T5, T8 = T4, P8 = T6).
CHANNELS = [
    "Fp1-F7", "F7-T7", "T7-P7", "P7-O1", "Fp2-F8", "F8-T8", "T8-P8", "P8-O2",
    "Fp1-F3", "F3-C3", "C3-P3", "P3-O1", "Fp2-F4", "F4-C4", "C4-P4", "P4-O2",
]
CLIP_S = 180
CONTEXT_S = sparcnet.WIN // sparcnet.FS  # history for the first prediction
STEP_S = sparcnet.STEP // sparcnet.FS
PAD_S = 30  # extra data on both sides, so filter edge effects fall outside what we keep
# Seizure onset in each clip (s): spread over 15-165 s, in a fixed shuffled order.
ONSETS = np.random.default_rng(0).permutation(np.linspace(15, 165, len(CASES)).round().astype(int))


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
        if all(c.upper() in chans for c in CHANNELS):
            for sz in seizures:
                if sz[0] >= CLIP_S:
                    return name, sz
    raise ValueError(f"{case}: no usable seizure file")


def subject_info(src):
    """-> {case: "F, 11 y"} from SUBJECT-INFO (chb24 is not listed)."""
    info = {}
    for line in open(os.path.join(src, "SUBJECT-INFO")):
        parts = line.split()
        if len(parts) == 3 and parts[0].startswith("chb"):
            info[parts[0]] = f"{parts[1]}, {parts[2]} y"
    return info


def segment(raw, t0, t1):
    """Raw EDF -> model-ready EEG (16, n) in uV at 200 Hz, for file seconds [t0, t1)."""
    fs_in = int(raw.info["sfreq"])
    # MNE renames duplicate channels, e.g. T8-P8 -> T8-P8-0, T8-P8-1.
    names = [next(n for n in raw.ch_names if n == c.upper() or n.startswith(c.upper() + "-")) for c in CHANNELS]
    a = max(t0 - PAD_S, 0) * fs_in
    b = min((t1 + PAD_S) * fs_in, raw.n_times)
    x = raw.get_data(picks=names, start=a, stop=b) * 1e6  # V -> uV
    r = Fraction(sparcnet.FS, fs_in)
    x = sparcnet.filt(resample_poly(x, r.numerator, r.denominator, axis=1))
    off = (t0 * fs_in - a) * sparcnet.FS // fs_in
    return x[:, off : off + (t1 - t0) * sparcnet.FS]


def main():
    import mne

    src = sys.argv[1]
    picks = {case: pick(src, case) for case in CASES}
    if sys.argv[2] == "--files":
        print(" ".join(f"{case}/{name}" for case, (name, _) in picks.items()))
        return
    model_pt, out = sys.argv[2:4]
    model = sparcnet.load_model(model_pt)
    os.makedirs(out, exist_ok=True)
    info = subject_info(src)
    beds, inside_all, outside_all = [], [], []
    sz_i = sparcnet.CLASSES.index("SZ")
    print("case   seizure(s)  P(SZ) in: mean max | out: mean max")
    for (case, (name, (sz_start, sz_end))), onset in zip(picks.items(), ONSETS):
        raw = mne.io.read_raw_edf(os.path.join(src, name), preload=False, verbose="ERROR")
        # If the file ends too soon after the seizure, start earlier.
        start = int(min(sz_start - onset, raw.n_times // raw.info["sfreq"] - CLIP_S))
        x = segment(raw, start - CONTEXT_S, start + CLIP_S)
        probs = sparcnet.predict(model, x)
        clip = x[:, CONTEXT_S * sparcnet.FS :]
        np.clip(np.round(clip), -32768, 32767).astype("<i2").T.tofile(os.path.join(out, f"{case}.i16"))

        sz = [sz_start - start, sz_end - start]  # seconds into the clip
        t_end = np.arange(len(probs)) * STEP_S  # each window covers [t_end - 10, t_end)
        inside = (t_end > sz[0]) & (t_end - CONTEXT_S < sz[1])
        p = probs[:, sz_i]
        inside_all.append(p[inside])
        outside_all.append(p[~inside])
        print(f"{case}  {sz[0]:3d}-{sz[1]:3d}      {p[inside].mean():.2f} {p[inside].max():.2f} |"
              f"      {p[~inside].mean():.2f} {p[~inside].max():.2f}")
        beds.append({
            "file": f"{case}.i16",
            "patient": case,
            "info": info.get(case, ""),
            "recording": name,
            "start_s": start,
            "seizure": sz,
            "probs": np.round(probs, 3).tolist(),
        })

    inside_all, outside_all = np.concatenate(inside_all), np.concatenate(outside_all)
    auc = mannwhitneyu(inside_all, outside_all).statistic / (len(inside_all) * len(outside_all))
    print(f"all beds: P(SZ) separates seizure from non-seizure windows with AUROC {auc:.2f}")

    manifest = {
        "fs": sparcnet.FS,
        "clip_s": CLIP_S,
        "channels": CHANNELS,
        "classes": sparcnet.CLASSES,
        "prob_step_s": STEP_S,  # probs[k] covers clip time [k * step - window, k * step)
        "prob_window_s": CONTEXT_S,
        "source": "CHB-MIT Scalp EEG Database (PhysioNet), ODC-By 1.0; model: SPaRCNet (Jing et al., Neurology 2023)",
        "tiles": beds,
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
