# Einkauf Websockets

Eine Einkaufsliste jetzt mal komplett mittels websockets umgesetzt, noch nicht sonderlich getestet

## Architektur / Installation

- Apache liefert HTML und JavaScript aus
- Node.js betreibt ausschließlich den WebSocket-Server
- Apache fungiert als Reverse Proxy für WebSockets
- das Verzeichnis data muss existieren und für den WebSocket owner schreibbar sein



Node muss installiert sein. 
- npm install

User für den webservice / Dienst
- useradd --system --home /var/www/html/einkaufWS --shell /usr/sbin/nologin  einkaufws
- sudo chown -R einkaufws /var/www/html/einkaufWS/
- sudo chmod -R 755 /var/www/html/einkaufWS
- /etc/systemd/system/einkaufws.service anlegen
- sudo  systemctl daemon-reload  &&  sudo systemctl enable einkaufws &&  sudo systemctl start einkaufws

Apache muss als Reverse Proxy für WebSockets konfiguriert sein.
Erforderliche Module (a2enmod und restart am ende):
- proxy
- proxy_http
- proxy_wstunnel
- rewrite
- in /etc/apache2/sites-available/000-default-le-ssl.conf beispiel-config eintragen

Dann sollte es funktionieren, hat jedenfalls auf ubuntu22.04 geklappt
