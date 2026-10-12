"""Download CHB-MIT (PhysioNet, ODC-By 1.0) files into DEST_DIR. Skips files it has.

Usage:
  fetch_chbmit.py DEST_DIR                          # SUBJECT-INFO + the 24 chbNN-summary.txt files
  fetch_chbmit.py DEST_DIR chb01/chb01_03.edf ...   # the same, plus these EDF files
"""
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

# PhysioNet's AWS open-data mirror: the same files, about 70x faster than physionet.org.
BASE = "https://physionet-open.s3.amazonaws.com/chbmit/1.0.0/"


def fetch(dest, rel):
    out = os.path.join(dest, os.path.basename(rel))
    if os.path.exists(out):
        return f"have {rel}"
    urllib.request.urlretrieve(BASE + urllib.parse.quote(rel), out + ".part")
    os.replace(out + ".part", out)
    return f"got  {rel} ({os.path.getsize(out) / 1e6:.0f} MB)"


def main():
    dest, files = sys.argv[1], sys.argv[2:]
    os.makedirs(dest, exist_ok=True)
    rels = ["SUBJECT-INFO"] + [f"chb{i:02d}/chb{i:02d}-summary.txt" for i in range(1, 25)] + files
    with ThreadPoolExecutor(6) as pool:
        for msg in pool.map(lambda r: fetch(dest, r), rels):
            print(msg, flush=True)


if __name__ == "__main__":
    main()
