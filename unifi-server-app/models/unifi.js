const WebSocket = require('ws');
const axios = require('axios');
const https = require('https')
const setCookie = require('set-cookie-parser');
const logger = require("../utils/logger");

class Unifi {
  constructor(baseURL, username, password) {

    if (!baseURL) throw 'Missing parameter, Unifi baseURL';
    if (!username) throw 'Missing parameter, Unifi username';
    if (!password) throw 'Missing parameter, Unifi password';

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    this.username = username;
    this.password = password;
    
    this.axiosClient = axios.create({
      httpsAgent: agent,
      baseURL: baseURL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.configureRequestInterceptors();
    this.configureResponseInterceptors();
    this.login().catch(error => {});
  }

  configureRequestInterceptors() {
    let id = 1;
    this.axiosClient.interceptors.request.use(config => {
      if (!config.id) config.id = id++;
      logger.http(`[${config.id}] Sending request to UniFi: ${config.method.toUpperCase()} ${config.url}`);
      logger.http(`[${config.id}]  X-Csrf-Token: ${config.headers['X-Csrf-Token']}`);
      return config;
    });
  }

  configureResponseInterceptors() {
    // Create a list to hold the request queue
    const refreshAndRetryQueue = [];

    // Flag to prevent multiple token refresh requests
    let isRefreshing = false;
    
    this.axiosClient.interceptors.response.use(
      response => response,
      async (error) => {
        const originalRequest = error?.config;

        // Do not retry login requests
        if (originalRequest?.url === '/api/auth/login') {
          return Promise.reject(error);
        }

        // Do not retry requests that have already been retried
        if (originalRequest._retry === true) {
          logger.warn(`[${originalRequest.id}] Request has already been retried, rejecting it!`);
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (error.response?.status === 401) {
          if (isRefreshing) {
            // Add the original request to the queue
            logger.warn(`[${originalRequest.id}] Received HTTP 401 Unauthorized ${originalRequest?.url}. Another request is already in "retrying mode". Adding this request to the retry queue...`);
            return new Promise((resolve, reject) => {
              refreshAndRetryQueue.push({ config: originalRequest, resolve, reject });
            });
          }

          else {
            isRefreshing = true;
            logger.warn(`[${originalRequest.id}] Received HTTP 401 Unauthorized ${originalRequest?.url}, retrying request...`);

            try {
              if ((originalRequest.headers['Cookie'] === this.axiosClient.defaults.headers.common['Cookie']) &&
                  (originalRequest.headers['X-Csrf-Token'] === this.axiosClient.defaults.headers.common['X-Csrf-Token'])) {

                logger.info(`[${originalRequest.id}] Trying to log back in...`);
                await this.login();
              }

              else {
                logger.info(`[${originalRequest.id}] Cookies have been updated, no need to log back in.`);
              }

              // Retry all requests in the queue with the new token
              refreshAndRetryQueue.forEach(({ config, resolve, reject }) => {
                config.headers['Cookie'] = this.axiosClient.defaults.headers.common['Cookie'];
                config.headers['X-Csrf-Token'] = this.axiosClient.defaults.headers.common['X-Csrf-Token'];

                logger.info(`[${config.id}] Retrying request from retry queue`);
                this.axiosClient.request(config)
                  .then((response) => resolve(response))
                  .catch((err) => reject(err));
              });

              // Clear the queue
              refreshAndRetryQueue.length = 0;

              // Retry the original request
              originalRequest.headers['Cookie'] = this.axiosClient.defaults.headers.common['Cookie'];
              originalRequest.headers['X-Csrf-Token'] = this.axiosClient.defaults.headers.common['X-Csrf-Token'];

              logger.info(`[${originalRequest.id}] Retrying original request`);
              return this.axiosClient(originalRequest);
            }
            
            catch (e) {
              // Return initial error, not the one from the login;
              logger.error('Error caught in response interceptor');
              return Promise.reject(error);
            }

            finally {
              isRefreshing = false;
            }
          }
        }

        // Return a Promise rejection if the status code is not 401
        return Promise.reject(error);
    });
  }

  setWebSocketServer(webSocketServer) {
    this.webSocketServer = webSocketServer;
  }

  login() {
    const credentials = {
      "username": this.username,
      "password": this.password
    };

    logger.info('Login to UniFi...');
    delete this.axiosClient.defaults.headers.common['Cookie'];
    delete this.axiosClient.defaults.headers.common['X-Csrf-Token'];

    return this.axiosClient.post('/api/auth/login', credentials)
      .then(async (response) => {
        if (response.status !== 200) throw 'login() Error calling /api/auth/login'

        logger.info(`[${response.config.id}] Logued in to UniFi, parsing cookies...`);
        const cookies = setCookie.parse(response, {map: true});
        const [jwtHeader, jwtPayload, jwtSignature] = cookies['TOKEN'].value.split('.');
        const jwtPayloadJson = JSON.parse(Buffer.from(jwtPayload, 'base64'));
        
        logger.debug(`[${response.config.id}] Cookie: ${response.headers['set-cookie']}`);
        logger.debug(`[${response.config.id}] X-Csrf-Token: ${jwtPayloadJson.csrfToken}`);
        this.axiosClient.defaults.headers.common['Cookie'] = response.headers['set-cookie'].toString();
        this.axiosClient.defaults.headers.common['X-Csrf-Token'] = jwtPayloadJson.csrfToken

        this.unifiClientWebSocket = new WebSocket('wss://192.168.2.3/api/ws/system', {
          rejectUnauthorized: false,
          headers: {
            Cookie: response.headers['set-cookie']
          }
        });

        this.unifiClientWebSocket.on('error', this.onUnifiWebSocketError);
        this.unifiClientWebSocket.on('open', this.onUnifiWebSocketOpen);
        this.unifiClientWebSocket.on('message', (data, isBinary) => this.onUnifiWebSocketMessage(data, isBinary));
    })
    .catch(async (error) => {
      logger.error(`Unable to login to UniFi! HTTP ${error?.response?.status} ${error?.response?.statusText}`);
      logger.error(error);
      throw error;
    });
  }

  // Error on the websocket connection with UniFi
  onUnifiWebSocketError(error) {
    logger.error(`onUnifiWebSocketError() ${JSON.stringify(error)}`);
  }

  // Websocket connection established with UniFi
  onUnifiWebSocketOpen() {
    logger.debug('onUnifiWebSocketOpen()');
  }

  // Received websocket message from UniFi
  onUnifiWebSocketMessage(data, isBinary) {
    const message = isBinary ? data : data.toString();
    const json = JSON.parse(message);
  
    // Ignore messages if not DEVICE_STATE_CHANGED
    const EVENT_DEVICE_STATE_CHANGED = 'DEVICE_STATE_CHANGED';
    if (json?.type !== EVENT_DEVICE_STATE_CHANGED) return;

    json?.devices?.network?.forEach(device => {
      const wsMessage = {type: EVENT_DEVICE_STATE_CHANGED, name: device.name, status: device.status};
      logger.http(`Received ${EVENT_DEVICE_STATE_CHANGED} websocket message from UniFi: ${JSON.stringify(wsMessage)}`);
      if (this.webSocketServer) {
        // Publish websocket message to all cliens (browsers)
        this.webSocketServer.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(wsMessage));
        });
      }
    });
  }

  getFirewallRules() {
    logger.debug('Retrieving all firewall rules...');
    return this.axiosClient.get('/proxy/network/api/s/default/rest/firewallrule')
      .then(response => {
        if (response.data.meta.rc !== 'ok') throw 'getFirewallRules() Error calling /proxy/network/api/s/default/rest/firewallrule';

        logger.debug(`[${response.config.id}] Firewall rules sucessfully retrieved!`);
        return response.data.data.map(fwRule => {
          return {
           id: fwRule._id,
           name: fwRule.name,
           enabled: fwRule.enabled
          };
        });
      },
      
      error => {
        logger.error(`Unable to retrieve all firewall rules! HTTP ${error?.response?.status} ${error?.response?.statusText}`);
        throw error;
      });
  }

  getFirewallRule(fwRuleName) {
    return this.getFirewallRules().then(fwRules => {
      logger.debug(`Firewall rules sucessfully retrieved, retrieving rule "${fwRuleName}"`);
      const fwRule = fwRules.find(rule => rule.name === fwRuleName);
      if (!fwRule) throw 'getFirewallRule() Error calling /proxy/network/api/s/default/rest/firewallrule'
      return fwRule;
    });
  }

  setFirewallRule(fwRuleId, isEnabled) {
    const fwObject = {
      id: [fwRuleId],
      data: { enabled: isEnabled}
    }
    
    logger.debug(`Updating firewall rule "${fwRuleId}"...`);
    return this.axiosClient.put('/proxy/network/api/s/default/group/firewallrule', fwObject)
      .then(response => {
        if (response.data.meta.rc !== 'ok') throw 'setFirewallRule() Error calling /proxy/network/api/s/default/group/firewallrule'
      },
      
      error => {
        logger.error(`Unable to update firewall rule! HTTP ${error?.response?.status} ${error?.response?.statusText}`);
        throw error;
      });;
  }

  getDevicesState() {
    logger.debug('Retrieving all devices state...');

    const DEVICE_STATE_MAP = {
      0: 'offline',
      1: 'online',
      5: 'adopting'
    }

    return this.axiosClient.get('/proxy/network/api/s/default/stat/device?include_client_tables=false')
      .then(response => {
        if (response.data.meta.rc !== 'ok') throw 'getDevicesState() Error calling /proxy/network/api/s/default/stat/device-basic'

        logger.debug(`[${response.config.id}] Devices state sucessfully retrieved!`);
        return response.data.data.map(device => {
          return {
            name: device.name,
            state: DEVICE_STATE_MAP[device.state] || device.state
          };
        });
      },

      error => {
        logger.error(`Unable to retrieve all devices state! HTTP ${error?.response?.status} ${error?.response?.statusText}`);
        throw error;
      });
  }

  getUsgState() {
    return this.getDevicesState().then(devices => {
      logger.debug(`Devices state sucessfully retrieved, retrieving USG device`);
      const usg = devices.find(device => device.name === 'USG');
      if (!usg) throw 'getUsgState() Unable to retrieve USG state'
      return usg.state;
    });
  }

  isInternetBlocked() {
    return this.getFirewallRule('Block Internet').then(firewallRule => firewallRule.enabled);
  }

  enableInternet() {
    return this.getFirewallRule('Block Internet').then(firewallRule => {
      this.setFirewallRule(firewallRule.id, false);
    });
  }

  disableInternet() {
    return this.getFirewallRule('Block Internet').then(firewallRule => {
      this.setFirewallRule(firewallRule.id, true);
    });
  }

  getNativeClass(obj) {
    if (typeof obj === "undefined") return "undefined";
    if (obj === null) return "null";
    return Object.prototype.toString.call(obj).match(/^\[object\s(.*)\]$/)[1];
  }
  
  getAnyClass(obj) {
    if (typeof obj === "undefined") return "undefined";
    if (obj === null) return "null";
    return obj.constructor.name;
  }
}

module.exports = Unifi;