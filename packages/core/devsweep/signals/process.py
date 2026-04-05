import psutil
from typing import Set

from ..models import ScanEntry, SignalResult


def calculate_process_signal(entry: ScanEntry) -> SignalResult:
    if entry.is_dir:
        return SignalResult(score=0, reason="Directories are not checked for active processes")
    
    try:
        # Get all open files
        open_files = set()
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                proc_open_files = proc.open_files()
                for open_file in proc_open_files:
                    open_files.add(open_file.path)
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                continue
        
        if str(entry.path) in open_files:
            return SignalResult(score=0, reason="File is currently open by a process")
        else:
            return SignalResult(score=50, reason="File is not currently open by any process")
    
    except Exception as e:
        return SignalResult(score=25, reason=f"Could not check process status: {str(e)}")
