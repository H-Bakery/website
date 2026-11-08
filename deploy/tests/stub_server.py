"""Kleiner HTTP-Stub für deploy/tests/run-tests.sh.

    python3 stub_server.py PORT LOGFILE [CERTFILE KEYFILE]

GET  -> 200 "ok" (simuliert /health der API bzw. die Startseite der Verwaltung)
POST -> 200 {"ok": true}; der Pfad (ohne Bot-Token) und der Body werden an
        LOGFILE angehängt (simuliert die Telegram-Bot-API).
Mit CERTFILE/KEYFILE spricht der Stub HTTPS (simuliert Caddy für die
TLS-Prüfung von health.sh). Lauscht nur auf 127.0.0.1.
"""

import re
import ssl
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import unquote_plus

PORT = int(sys.argv[1])
LOGFILE = sys.argv[2]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(length).decode("utf-8", "replace")
        path = re.sub(r"/bot[^/]+/", "/bot<token>/", self.path)
        with open(LOGFILE, "a", encoding="utf-8") as fh:
            fh.write(f"POST {path} {unquote_plus(data)}\n---\n")
        body = b'{"ok": true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


server = HTTPServer(("127.0.0.1", PORT), Handler)
if len(sys.argv) > 4:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(sys.argv[3], sys.argv[4])
    server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
