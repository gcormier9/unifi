const { Router } = require("express");
const logger = require("../utils/logger")
const router = Router();

const handleError = (res, error) => {
  logger.error(JSON.stringify(error));
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
    }
  });
};

module.exports = (unifi) => {

  router.get('/devices', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.getDevicesState()
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.get('/clients', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.getClients()
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.get('/firewalls', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.getFirewallRules()
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.post('/client/:macAddress/block', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.setClientState(req.params['macAddress'], 'block')
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.post('/client/:macAddress/unblock', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.setClientState(req.params['macAddress'], 'unblock')
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.post('/firewall/:id/enable', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.setFirewallRule(req.params['id'], true)
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  router.post('/firewall/:id/disable', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.setFirewallRule(req.params['id'], false)
      .then(data => res.json(data))
      .catch(error => handleError(res, error));
  });

  return router;
};