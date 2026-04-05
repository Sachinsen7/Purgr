# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path


project_root = Path.cwd()
rules_dir = project_root / "devsweep" / "rules"
rule_files = [(str(path), "devsweep/rules") for path in rules_dir.glob("*.yaml")]

block_cipher = None

a = Analysis(
    [str(project_root / "devsweep" / "api" / "__main__.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=rule_files,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    exclude_binaries=False,
    name="devsweep-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)
