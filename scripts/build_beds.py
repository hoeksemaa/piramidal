"""Build the bed wall's data from raw CHB-MIT EDF files, through SPaRCNet.

Usage:
  build_beds.py CHBMIT_DIR --files [--seizure]             # print the chosen EDF per patient (args for fetch_chbmit.py)
  build_beds.py CHBMIT_DIR MODEL_PT OUT_DIR [--seizure]    # write OUT_DIR/<case>.i16 and OUT_DIR/manifest.json

One path from raw EEG to both outputs, so the wall shows what the model sees:
  raw EDF -> 18 bipolar channels: SPaRCNet's 16, in its order, then Fz-Cz and Cz-Pz
          -> resample to 200 Hz -> 60 Hz notch + 0.5-40 Hz bandpass
          -> (a) the 3-minute display clip, all 18 channels, int16 uV
             (b) SPaRCNet on its 16 channels: 6 class probabilities every 2 s
Prediction k covers clip time [2k - 10, 2k) s, so each clip is read with 10 s of history.

Each patient's clip is a random 3 minutes of their recordings, as on a real ward: most clips
have no seizure. The patient's recording time is sampled evenly (a file is chosen with weight
by its length, then a start in it), with a fixed seed, so each build gives the same clips.

With --seizure, each clip instead holds one expert-labeled seizure: the first recording that
has the 18 channels and a seizure that starts at least CLIP_S into the file. Each patient's
seizure starts at a different moment of the clip (ONSETS). These 23 clips are the test set
for the seizure rule and the 0.9 cut.
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
MODEL_CHANNELS = [
    "Fp1-F7", "F7-T7", "T7-P7", "P7-O1", "Fp2-F8", "F8-T8", "T8-P8", "P8-O2",
    "Fp1-F3", "F3-C3", "C3-P3", "P3-O1", "Fp2-F4", "F4-C4", "C4-P4", "P4-O2",
]
# The midline chain: not a model input, but part of the standard display.
CHANNELS = MODEL_CHANNELS + ["Fz-Cz", "Cz-Pz"]
CLIP_S = 180
CONTEXT_S = sparcnet.WIN // sparcnet.FS  # history for the first prediction
STEP_S = sparcnet.STEP // sparcnet.FS
PAD_S = 30  # extra data on both sides, so filter edge effects fall outside what we keep
# --seizure: seizure onset in each clip (s), spread over 15-165 s, in a fixed shuffled order.
ONSETS = np.random.default_rng(0).permutation(np.linspace(15, 165, len(CASES)).round().astype(int))
SEED = 2026  # the random clips
HOUR_S = 3600  # length of a chb24 file that its summary does not list (its files are about 1 h)


def parse_summary(path):
    """-> list of [file, channels, [[start_s, end_s], ...], clock_s, dur_s] in summary order.

    clock_s is the file's start time in seconds after midnight, and dur_s its length; both are
    None if not listed. Times can pass 24:00 (e.g. 26:02:15).
    """
    files, chans = [], []
    clock = lambda m: int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3])
    for line in open(path):
        line = line.strip()
        if line.startswith(("Channels in EDF", "Channels changed")):
            chans = []
        elif m := re.match(r"Channel \d+: (\S+)", line):
            chans.append(m.group(1))
        elif line.startswith("File Name:"):
            files.append([line.split()[-1], list(chans), [], None, None])
        elif m := re.match(r"File Start Time:\s*(\d+):(\d+):(\d+)", line):
            files[-1][3] = clock(m)
        elif m := re.match(r"File End Time:\s*(\d+):(\d+):(\d+)", line):
            files[-1][4] = (clock(m) - files[-1][3]) % 86400
        elif m := re.match(r"Seizure(?: \d+)? Start Time:\s*(\d+)", line):
            files[-1][2].append([int(m.group(1)), None])
        elif m := re.match(r"Seizure(?: \d+)? End Time:\s*(\d+)", line):
            files[-1][2][-1][1] = int(m.group(1))
    return files


def recordings(src, case):
    """-> every EDF of the patient with the 18 channels, as parse_summary rows.

    chb24's summary lists only its files with seizures. Its other files (from RECORDS) get the
    summary's first channel list, no seizures, and a length of HOUR_S.
    """
    files = parse_summary(os.path.join(src, f"{case}-summary.txt"))
    listed = {f[0] for f in files}
    for rel in open(os.path.join(src, "RECORDS")).read().split():
        name = os.path.basename(rel)
        if rel.startswith(case + "/") and name not in listed:
            files.append([name, files[0][1], [], None, HOUR_S])
    return [f for f in files if all(c.upper() in f[1] for c in CHANNELS)]


def pick_seizure(src, case, i):
    """-> (file, clock_s, start) or a start rule: the first file with a seizure at least CLIP_S in."""
    for name, _, seizures, clock_s, _ in recordings(src, case):
        for sz in seizures:
            if sz[0] >= CLIP_S:
                # If the file ends too soon after the seizure, start earlier.
                return name, clock_s, lambda dur, sz=sz: int(min(sz[0] - ONSETS[i], dur - CLIP_S))
    raise ValueError(f"{case}: no usable seizure file")


def pick_random(src, case, i):
    """-> (file, clock_s, start rule): a random 3 minutes of the patient's recordings."""
    rng = np.random.default_rng([SEED, i])
    files = recordings(src, case)
    w = np.array([f[4] or HOUR_S for f in files], float)
    name, _, _, clock_s, _ = files[rng.choice(len(files), p=w / w.sum())]
    u = rng.random()
    # Keep room for the model's history and the filter padding inside the file.
    lo = CONTEXT_S + PAD_S
    return name, clock_s, lambda dur: int(lo + u * (dur - CLIP_S - PAD_S - lo))


def clip_seizures(src, case, name, start):
    """-> the expert-labeled seizures in the clip, in clip seconds, cut to the clip."""
    row = next(f for f in recordings(src, case) if f[0] == name)
    return [[max(a - start, 0), min(b - start, CLIP_S)] for a, b in row[2] if b > start and a < start + CLIP_S]


def subject_info(src):
    """-> {case: "F, 11 y"} from SUBJECT-INFO (chb24 is not listed)."""
    info = {}
    for line in open(os.path.join(src, "SUBJECT-INFO")):
        parts = line.split()
        if len(parts) == 3 and parts[0].startswith("chb"):
            info[parts[0]] = f"{parts[1]}, {parts[2]} y"
    return info


def segment(raw, t0, t1):
    """Raw EDF -> filtered EEG (18, n) in uV at 200 Hz, for file seconds [t0, t1)."""
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

    args = [a for a in sys.argv[1:] if a != "--seizure"]
    pick = pick_seizure if "--seizure" in sys.argv else pick_random
    src = args[0]
    picks = {case: pick(src, case, i) for i, case in enumerate(CASES)}
    if args[1] == "--files":
        print(" ".join(f"{case}/{name}" for case, (name, _, _) in picks.items()))
        return
    model_pt, out = args[1:3]
    model = sparcnet.load_model(model_pt)
    os.makedirs(out, exist_ok=True)
    info = subject_info(src)
    beds, inside_all, outside_all = [], [], []
    sz_i = sparcnet.CLASSES.index("SZ")
    print("case   file           start   seizures in clip   P(SZ) max   answers >= 0.9")
    for case, (name, clock_s, start_of) in picks.items():
        raw = mne.io.read_raw_edf(os.path.join(src, name), preload=False, verbose="ERROR")
        start = start_of(raw.n_times // int(raw.info["sfreq"]))
        x = segment(raw, start - CONTEXT_S, start + CLIP_S)
        probs = sparcnet.predict(model, x[: len(MODEL_CHANNELS)])
        clip = x[:, CONTEXT_S * sparcnet.FS :]
        np.clip(np.round(clip), -32768, 32767).astype("<i2").T.tofile(os.path.join(out, f"{case}.i16"))

        seizures = clip_seizures(src, case, name, start)
        t_end = np.arange(len(probs)) * STEP_S  # each window covers [t_end - 10, t_end)
        inside = np.zeros(len(probs), bool)
        for a, b in seizures:
            inside |= (t_end > a) & (t_end - CONTEXT_S < b)
        p = probs[:, sz_i]
        inside_all.append(p[inside])
        outside_all.append(p[~inside])
        print(f"{case}  {name:14s} {start:5d}   {str(seizures):18s} {p.max():.2f}        {(p >= 0.9).sum()}")
        beds.append({
            "file": f"{case}.i16",
            "patient": case,
            "info": info.get(case, ""),
            "recording": name,
            "start_s": start,  # clip start, seconds into the recording
            "clock_start_s": None if clock_s is None else clock_s + start,  # clip start, seconds after midnight
            "seizures": seizures,  # expert-labeled seizures, clip seconds
            "probs": np.round(probs, 3).tolist(),
        })

    inside_all, outside_all = np.concatenate(inside_all), np.concatenate(outside_all)
    print(f"{sum(bool(b['seizures']) for b in beds)} of {len(beds)} clips hold a labeled seizure")
    if len(inside_all) and len(outside_all):
        auc = mannwhitneyu(inside_all, outside_all).statistic / (len(inside_all) * len(outside_all))
        print(f"all beds: P(SZ) separates seizure from non-seizure windows with AUROC {auc:.2f}")

    manifest = {
        "fs": sparcnet.FS,
        "clip_s": CLIP_S,
        "channels": CHANNELS,
        "model_channels": MODEL_CHANNELS,
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
