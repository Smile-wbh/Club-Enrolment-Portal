#!/usr/bin/env python3
"""No-cache static server for local VS Code debugging."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


class NoCacheRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the portal locally without browser caching.")
    parser.add_argument("--host", default="127.0.0.1", help="Host address to bind.")
    parser.add_argument("--port", type=int, default=5510, help="Port to bind.")
    parser.add_argument("--directory", default=".", help="Directory to serve.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.directory).resolve()
    handler = partial(NoCacheRequestHandler, directory=str(root))

    try:
        with ReusableThreadingHTTPServer((args.host, args.port), handler) as httpd:
            print(
                f"Serving Club Enrollment Portal from {root} on http://{args.host}:{args.port}",
                flush=True,
            )
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nLocal portal server stopped.", flush=True)
        return 0
    except OSError as error:
        print(
            f"Could not start local portal server on {args.host}:{args.port}. "
            f"The port may already be in use. Details: {error}",
            flush=True,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
