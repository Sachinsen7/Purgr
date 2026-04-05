from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT / "dist"
BUILD_DIR = ROOT / "build"
SPEC_PATH = ROOT / "devsweep-sidecar.spec"


def main() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)

    subprocess.run(
        [sys.executable, "-m", "PyInstaller", "--clean", str(SPEC_PATH)],
        cwd=ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
