from __future__ import annotations

import asyncio
import sys

from ..config.settings import get_settings


def _configure_windows_event_loop() -> None:
    if sys.platform != "win32":
        return
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def main() -> None:
    # Configure this before importing uvicorn so Windows does not fall back to
    # Proactor pipe transports that log noisy client-disconnect tracebacks.
    _configure_windows_event_loop()
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "devsweep.api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
        loop="asyncio",
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
