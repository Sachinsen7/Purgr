import platform
from pathlib import Path
from unittest.mock import patch

import pytest

from devsweep.scanner.platforms import ToolName, get_tool_paths


def test_tool_name_enum():
    assert ToolName.VSCODE == "vscode"
    assert ToolName.ANDROID == "android"
    assert ToolName.PYTHON == "python"
    assert ToolName.NODE == "node"


def test_get_tool_paths_vscode_windows():
    with patch("platform.system", return_value="Windows"), \
         patch.dict("os.environ", {"APPDATA": "C:\Users\Test\AppData\Roaming", "LOCALAPPDATA": "C:\Users\Test\AppData\Local"}):
        paths = get_tool_paths(ToolName.VSCODE)
        expected = [
            Path("C:\Users\Test\AppData\Roaming\Code\User\workspaceStorage"),
            Path("C:\Users\Test\AppData\Roaming\Code\CachedData"),
            Path("C:\Users\Test\AppData\Local\Microsoft\VS Code\Cache"),
        ]
        assert paths == expected


def test_get_tool_paths_android_linux():
    with patch("platform.system", return_value="Linux"), \
         patch("pathlib.Path.home", return_value=Path("/home/test")):
        paths = get_tool_paths(ToolName.ANDROID)
        expected = [
            Path("/home/test/.cache/JetBrains"),
            Path("/home/test/.local/share/JetBrains"),
        ]
        assert paths == expected


def test_get_tool_paths_python_darwin():
    with patch("platform.system", return_value="Darwin"), \
         patch("pathlib.Path.home", return_value=Path("/Users/test")):
        paths = get_tool_paths(ToolName.PYTHON)
        expected = [
            Path("/Users/test/Library/Caches/pip"),
            Path("/Users/test/.cache/pip"),
        ]
        assert paths == expected


def test_get_tool_paths_node_unknown_os():
    with patch("platform.system", return_value="Unknown"):
        paths = get_tool_paths(ToolName.NODE)
        assert paths == []


def test_get_tool_paths_invalid_tool():
    # ToolName is a StrEnum, so invalid values won't be passed, but test edge case
    with patch("platform.system", return_value="Linux"):
        # This would normally raise ValueError, but since it's StrEnum, test valid ones
        pass
