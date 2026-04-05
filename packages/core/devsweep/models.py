from pathlib import Path
from pydantic import BaseModel


class ScanEntry(BaseModel):
    path: Path
    size: int
    mtime: float
    is_dir: bool
    is_file: bool
    is_symlink: bool
