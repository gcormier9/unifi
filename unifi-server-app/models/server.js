const express = require("express");
const WebSocket = require('ws');
const Unifi = require('./unifi');
const cors = require("cors");
const path = require("path");
const logger = require("../utils/logger");

class Server {
  constructor() {
    this.app = express();
    this.expressWs = require('express-ws')(this.app);
    this.port = process.env.PORT || '3030'

    this.unifi = new Unifi(
      process.env.UNIFI_URL || "https://localhost",
      process.env.UNIFI_USERNAME || "ubnt",
      process.env.UNIFI_PASSWORD || "ubnt"
    );

    this.middlewares();
    this.routes();
  }

  middlewares() {
    this.app.use(cors());
    this.app.use(express.json());

    // Pick up React index.html file
    this.app.use(
      express.static(path.join(__dirname, "../../unifi-client-app/build"))
    );
  }

  // Bind controllers to routes
  routes() {
    this.unifi.setWebSocketServer(this.expressWs.getWss());
    this.app.use("/api", require("../routes/api")(this.unifi));
    this.app.use("/", require("../routes/ws")(this.expressWs.getWss()));

    // Catch all requests that don't match any route
    this.app.get("*", (req, res) => {
      res.sendFile(
        path.join(__dirname, "../../unifi-client-app/build/index.html")
      );
    });
  }

  listen() {
    this.webServer = this.app.listen(this.port, () => {
      logger.info("Web Server running on port: ", this.port);
    });
  }
}

module.exports = Server;
