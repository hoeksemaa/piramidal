"""SPaRCNet (bdsp-core/IIIC-SPaRCNet, model_1130.pt): load, preprocess, predict.

Preprocessing copies SPaRCNet/runSPaRCNet.py: 16-ch double banana at 200 Hz,
60 Hz notch, 0.5-40 Hz bandpass, 10 s windows every 2 s, clip at +/-500 uV.
"""
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from mne.filter import filter_data, notch_filter

FS = 200
WIN = 10 * FS
STEP = 2 * FS
CLASSES = ["Other", "SZ", "LPD", "GPD", "LRDA", "GRDA"]
# Model input order: left lateral, right lateral, left parasagittal, right parasagittal.
BIPOLAR = [
    "FP1-F7", "F7-T3", "T3-T5", "T5-O1",
    "FP2-F8", "F8-T4", "T4-T6", "T6-O2",
    "FP1-F3", "F3-C3", "C3-P3", "P3-O1",
    "FP2-F4", "F4-C4", "C4-P4", "P4-O2",
]
# The same montage from referential channels Fp1 F3 C3 P3 F7 T3 T5 O1 Fz Cz Pz Fp2 F4 C4 P4 F8 T4 T6 O2.
BIPOLAR_A = [0, 4, 5, 6, 11, 15, 16, 17, 0, 1, 2, 3, 11, 12, 13, 14]
BIPOLAR_B = [4, 5, 6, 7, 15, 16, 17, 18, 1, 2, 3, 7, 12, 13, 14, 18]


# Class definitions copied from runSPaRCNet.py so the pickled model can load.
class _DenseLayer(nn.Sequential):
    def __init__(self, num_input_features, growth_rate, bn_size, drop_rate, conv_bias, batch_norm):
        super().__init__()
        if batch_norm:
            self.add_module("norm1", nn.BatchNorm1d(num_input_features))
        self.add_module("elu1", nn.ELU())
        self.add_module("conv1", nn.Conv1d(num_input_features, bn_size * growth_rate, kernel_size=1, stride=1, bias=conv_bias))
        if batch_norm:
            self.add_module("norm2", nn.BatchNorm1d(bn_size * growth_rate))
        self.add_module("elu2", nn.ELU())
        self.add_module("conv2", nn.Conv1d(bn_size * growth_rate, growth_rate, kernel_size=3, stride=1, padding=1, bias=conv_bias))
        self.drop_rate = drop_rate

    def forward(self, x):
        new_features = super().forward(x)
        if self.drop_rate > 0:
            new_features = F.dropout(new_features, p=self.drop_rate, training=self.training)
        return torch.cat([x, new_features], 1)


class _DenseBlock(nn.Sequential):
    def __init__(self, num_layers, num_input_features, bn_size, growth_rate, drop_rate, conv_bias, batch_norm):
        super().__init__()
        for i in range(num_layers):
            layer = _DenseLayer(num_input_features + i * growth_rate, growth_rate, bn_size, drop_rate, conv_bias, batch_norm)
            self.add_module("denselayer%d" % (i + 1), layer)


class _Transition(nn.Sequential):
    def __init__(self, num_input_features, num_output_features, conv_bias, batch_norm):
        super().__init__()
        if batch_norm:
            self.add_module("norm", nn.BatchNorm1d(num_input_features))
        self.add_module("elu", nn.ELU())
        self.add_module("conv", nn.Conv1d(num_input_features, num_output_features, kernel_size=1, stride=1, bias=conv_bias))
        self.add_module("pool", nn.AvgPool1d(kernel_size=2, stride=2))


class DenseNetEnconder(nn.Module):
    def forward(self, x):
        features = self.densenet(x)
        return features.view(features.size(0), -1)


class DenseNetClassifier(nn.Module):
    def forward(self, x):
        features = self.features(x)
        out = self.classifier(features)
        return out, features


def device():
    return "mps" if torch.backends.mps.is_available() else "cpu"


def load_model(path, dev=None):
    # The checkpoint pickles these classes as __main__.<name>.
    import __main__

    for cls in (_DenseLayer, _DenseBlock, _Transition, DenseNetEnconder, DenseNetClassifier):
        setattr(__main__, cls.__name__, cls)
    model = torch.load(path, map_location="cpu", weights_only=False)
    return model.to(dev or device()).eval()


def filt(x):
    """x: (n_ch, n_samples) bipolar EEG in uV at 200 Hz -> notch + bandpass."""
    x = notch_filter(x, FS, 60, n_jobs=1, verbose="ERROR")
    return filter_data(x, FS, 0.5, 40, n_jobs=1, verbose="ERROR")


def referential_to_bipolar(x19):
    return x19[BIPOLAR_A] - x19[BIPOLAR_B]


def n_windows(n_samples):
    return n_samples // STEP - 4 if n_samples >= WIN else 0


def window_start_s(k):
    """Window k covers [2k, 2k + 10) seconds."""
    return k * STEP / FS


def predict(model, x, batch=256):
    """x: filtered (16, n_samples) -> (n_windows, 6) class probabilities."""
    n = n_windows(x.shape[1])
    dev = next(model.parameters()).device
    view = np.lib.stride_tricks.sliding_window_view(x, WIN, axis=1)[:, ::STEP][:, :n]
    out = []
    with torch.no_grad():
        for i in range(0, n, batch):
            w = np.clip(view[:, i : i + batch].transpose(1, 0, 2), -500, 500).astype(np.float32)
            logits, _ = model(torch.from_numpy(w).to(dev))
            out.append(F.softmax(logits, 1).cpu().numpy())
    return np.concatenate(out) if out else np.zeros((0, len(CLASSES)), np.float32)
