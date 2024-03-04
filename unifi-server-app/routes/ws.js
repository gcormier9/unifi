const { Router } = require("express");
const router = Router();

module.exports = (webSocketServer) => {
  router.ws('/', (ws, req) => {
    ws.on('message', (data, isBinary) => {
      const message = isBinary ? data : data.toString();
      console.log(`Received websocket message from browser: ${message}`);

      const jsonMessage = JSON.parse(message);
      if (jsonMessage.type == 'PING') ws.send(JSON.stringify({type: 'PONG'}));
    });
  });

  return router;
}