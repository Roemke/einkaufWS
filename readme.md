# Einkauf Websockets

Eine Einkaufsliste jetzt mal komplett mittels websockets umgesetzt, noch nicht sonderlich getestet

## Architektur

- Apache liefert HTML und JavaScript aus
- Node.js betreibt ausschließlich den WebSocket-Server
- Apache fungiert als Reverse Proxy für WebSockets
- das Verzeichnis data muss existieren und für den WebSocket owner schreibbar sein

Apache muss als Reverse Proxy für WebSockets konfiguriert sein.
Erforderliche Module:
- proxy
- proxy_http
- proxy_wstunnel
- rewrite
