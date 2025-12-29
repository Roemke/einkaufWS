
//ein wenig experimentieren, mit der test.html funktioniert es schonmal
const WebSocket = require("ws");

// WebSocket-Server auf Port 8080 starten
const wss = new WebSocket.Server({ port: 8080 });
const clients = new Set();

console.log("WebSocket server läuft auf ws://localhost:8080");

// Event: neuer Client verbindet sich
wss.on("connection", (ws, req) => {//ws: WebSocket-Objekt für den verbundenen Client
    clients.add(ws);
    ws.on("message", (message) => {
        let msg = null;
        let response = null;
      
        try {
          msg = JSON.parse(message.toString());
      
          switch (msg.type) {
            case "ping":
              response = {
                type: "pong",
                payload: {
                  time: new Date().toISOString()
                }
              };
              break;
      
            default:
              response = {
                type: "error",
                message: "Unknown message type"
              };
          }
        } catch {
          response = {
            type: "error",
            message: "Invalid JSON"
          };
        }
      
        if (ws.readyState === ws.OPEN && response) {
          ws.send(JSON.stringify(response));
        }
      });//eof message event    
      ws.on("close", () => {
        clients.delete(ws);
      });//eof close event   
});//eof connection event
