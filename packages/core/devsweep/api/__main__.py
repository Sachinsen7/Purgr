from __future__ import annotations

import uvicorn

from ..config.settings import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "devsweep.api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
