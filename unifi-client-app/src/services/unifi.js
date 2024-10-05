const backend = `${window.location.hostname}:3030`;

const fetchGet = (url) => {
  return fetch(`http://${backend}${url}`, {
    method: 'get',
    mode: 'cors',
    headers: { "Content-Type": "application/json" }
  }).then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response?.status} ${response?.statusText}`));
};

const fetchPost = (url, data) => {
  return fetch(`http://${backend}${url}`, {
    method: 'post',
    mode: 'cors',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response?.status} ${response?.statusText}`));
};

export const getDevicesState = () => {
  return fetchGet('/api/devices');
};

export const getFirewallRules = () => {
  return fetchGet('/api/firewalls');
};

export const getClientsState = () => {
  return fetchGet('/api/clients');
};

export const setClientState = (macAddress, action) => {
  return fetchPost(`/api/client/${macAddress}/${action}`);
};

export const setFirewallRule = (id, isEnabled) => {
  return fetchPost(`/api/firewall/${id}/${isEnabled ? 'enable' : 'disable'}`);
};

export default { getDevicesState, getFirewallRules, getClientsState, setClientState, setFirewallRule }