import os
from pathlib import Path
from typing import Optional

from ..models import ScanEntry, SignalResult


def calculate_project_signal(entry: ScanEntry) -> SignalResult:
    if entry.is_dir:
        return SignalResult(score=0, reason="Directories are not scored by project activity")
    
    # Walk up the directory tree to find project indicators
    current = entry.path.parent
    
    while current != current.parent:  # Stop at root
        # Check for git repository
        if (current / '.git').exists():
            return SignalResult(score=10, reason="File is in an active Git repository")
        
        # Check for recent file modifications in the directory
        try:
            recent_files = 0
            total_files = 0
            import time
            current_time = time.time()
            week_ago = current_time - (7 * 24 * 3600)
            
            for item in os.scandir(current):
                if item.is_file():
                    total_files += 1
                    if item.stat().st_mtime > week_ago:
                        recent_files += 1
            
            if total_files > 0 and (recent_files / total_files) > 0.3:
                return SignalResult(score=20, reason="Directory has recent activity")
        except OSError:
            pass
        
        current = current.parent
    
    return SignalResult(score=80, reason="File is not in an active project directory")
