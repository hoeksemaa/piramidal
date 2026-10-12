"""Check SPaRCNet against the examples that ship with it (bdsp-core/IIIC-SPaRCNet).

Usage: run_sparcnet.py MODEL_PT SAMPLE_CEEG_MAT LABELED_SAMPLES_DIR
  MODEL_PT             SPaRCNet/model_1130.pt
  SAMPLE_CEEG_MAT      SPaRCNet/Data/Raw/sample_cEEG.mat (36 min, unlabeled)
  LABELED_SAMPLES_DIR  code_for_figures/Data/Figure4to6/samples/ ({class}_sample{n}.mat)

1. Labeled examples: does the model's top class match the expert label?
   (The labeled 10 s is seconds 20-30 of each 50 s segment.)
2. The sample recording: which classes the model picks, minute by minute.
"""
import glob
import os
import sys

import h5py
import numpy as np
import scipy.io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sparcnet  # noqa: E402
from sparcnet import CLASSES, FS  # noqa: E402


def model_input(x19):
    """(19+, n) referential EEG at 200 Hz -> filtered 16-ch double banana."""
    return sparcnet.filt(sparcnet.referential_to_bipolar(x19[:19].astype(float)))


def main():
    model_pt, ceeg_mat, samples_dir = sys.argv[1:4]
    model = sparcnet.load_model(model_pt)
    print(f"model loaded: {sum(p.numel() for p in model.parameters()):,} parameters")

    print("\n=== labeled samples (expert label -> model top class, P(label))")
    files = sorted(
        f for f in glob.glob(os.path.join(samples_dir, "*_sample[0-9].mat"))
        if os.path.basename(f).split("_sample")[0] in CLASSES
    )
    hits = 0
    for f in files:
        label = os.path.basename(f).split("_sample")[0]
        x = model_input(scipy.io.loadmat(f)["seg"])
        p = sparcnet.predict(model, x[:, 20 * FS : 30 * FS])[0]  # exactly one 10 s window
        pred = CLASSES[int(p.argmax())]
        hits += pred == label
        print(f"  {os.path.basename(f):22s} label={label:5s} pred={pred:5s} P(label)={p[CLASSES.index(label)]:.2f}")
    print(f"  top class matches the expert label: {hits}/{len(files)}")

    with h5py.File(ceeg_mat, "r") as fh:
        data = fh["data"][()].T  # MATLAB orientation: (20, n_samples)
    probs = sparcnet.predict(model, model_input(data))
    print(f"\n=== sample_cEEG: {data.shape[1] / FS / 60:.1f} min, {len(probs)} windows (10 s, every 2 s)")
    top = probs.argmax(1)
    for i, c in enumerate(CLASSES):
        print(f"  {c:5s} top in {np.mean(top == i) * 100:5.1f}% of windows, mean P = {probs[:, i].mean():.2f}")
    print("  per-minute mean probabilities (" + " ".join(CLASSES) + "):")
    t_min = (np.arange(len(probs)) * 2 + 5) / 60  # window center, minutes
    for m in range(int(t_min.max()) + 1):
        sel = (t_min >= m) & (t_min < m + 1)
        if sel.any():
            mean = probs[sel].mean(0)
            print(f"    min {m:2d}: {' '.join(f'{v:.2f}' for v in mean)}  top={CLASSES[int(mean.argmax())]}")


if __name__ == "__main__":
    main()
