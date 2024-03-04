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

  router.get('/state', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.isInternetBlocked()
      .then(data => res.json({fwInternet: data }))
      .catch(error => handleError(res, error));
  });
  
  router.get('/state/usg', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    unifi.getUsgState()
      .then(data => res.json({usgState: data }))
      .catch(error => handleError(res, error));
  });
  
  router.post('/state', async (req, res, next) => {
    logger.http(`Request received: ${req.method} ${req.url}`);
    const fwInternet = req?.body?.fwInternet;
    
    if (fwInternet) {
      unifi.disableInternet()
        .then(() => res.json({fwInternet: fwInternet}))
        .catch(error => handleError(res, error));
    }
    else {
      unifi.enableInternet()
        .then(() => res.json({fwInternet: fwInternet}))
        .catch(error => handleError(res, error));
    }
  });

  return router;
};