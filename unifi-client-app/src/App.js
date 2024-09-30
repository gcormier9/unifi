import { useState, useEffect } from 'react';
import useWebSocket, { ReadyState } from "react-use-websocket"
import './App.css';
import Device from './components/Device';
import FirewallRule from './components/FirewallRule';
import Client from './components/Client';
import unifi from './services/unifi';

const App = () => {
  const backend = `${window.location.hostname}:3030`;
  
  const { sendJsonMessage, lastJsonMessage, readyState } = 
    useWebSocket(`ws://${backend}`, {
      share: false,
      shouldReconnect: () => true,
    }
  );

  
  // Run when the connection state (readyState) changes
  useEffect(() => {
    //if (readyState === ReadyState.OPEN) {
    //  sendJsonMessage({type: "PING"});
    //}
  }, [readyState]);

  // Run when a new WebSocket message is received (lastJsonMessage)
  useEffect(() => {
    console.log('Websocket message received', lastJsonMessage);

    if (lastJsonMessage?.type === 'DEVICE_STATE_CHANGED') {
      const newDevices = devices.slice();
      const device = newDevices.find(device => device.name === lastJsonMessage.name);
      device.state = lastJsonMessage.status;
      setDevices(newDevices);
    } else if (lastJsonMessage?.type === 'FIREWALL_RULE_CHANGED') {
      const newFwRules = fwRules.slice();
      const fwRule = newFwRules.find(fwRule => fwRule.id === lastJsonMessage.id);
      fwRule.enabled = lastJsonMessage.enabled;
      setFwRules(newFwRules);
    } else if (lastJsonMessage?.type === 'CLIENT_STATE_CHANGED') {
      const newClients = clients.slice();
      const client = newClients.find(client => client.mac === lastJsonMessage.mac);
      client.blocked = lastJsonMessage.state === 'blocked';
      setClients(newClients);
    }

  }, [lastJsonMessage]);



  const getDevicesState = () => {
    unifi.getDevicesState().then((devices) => {
      setDevices(devices);
    })
    .catch((err) => {
      console.log(`Error caught in getDevicesState() ${err}`);
    });
  };

  const getFirewallRules = () => {
    unifi.getFirewallRules().then((fwRules) => {
      setFwRules(fwRules);
    })
    .catch((err) => {
      console.log(`Error caught in getFirewallRules() ${err}`);
    });
  };

  const getClientsState = () => {
    unifi.getClientsState().then((clients) => {
      setClients(clients);
    })
    .catch((err) => {
      console.log(`Error caught in getClientsState() ${err}`);
    });
  };

  const [devices, setDevices] = useState([]);
  const [fwRules, setFwRules] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedFwRuleIds, setSelectedFwRuleIds] = useState([]);
  const [selectedClientIds, setSelectedClientIds] = useState([]);

  useEffect(() => {
    getDevicesState();
    getFirewallRules();
    getClientsState();
  }, []);

  useEffect(() => {
    setSelectedFwRuleIds(fwRules.filter(fwRule => fwRule.enabled).map(fwRule => fwRule.id));
  }, [fwRules]);

  const onFirewallRuleChanged = (id, isEnabled) => {
    if (isEnabled){
      setSelectedFwRuleIds([...selectedFwRuleIds, id]);
     } else {
      setSelectedFwRuleIds(selectedFwRuleIds.filter(currentId => currentId !== id));
     }
  };

  useEffect(() => {
    setSelectedClientIds(clients.filter(client => client.blocked).map(client => client.mac));
  }, [clients]);

  const onClientChanged = (macAddress, isBlocked) => {
    if (isBlocked){
      setSelectedClientIds([...selectedClientIds, macAddress]);
     } else {
      setSelectedClientIds(selectedClientIds.filter(currentMacAddress => currentMacAddress !== macAddress));
     }
  };

  return (
    <div className="container">
      <hr className='hr'/>
      <h2>Devices</h2>
      <ul className='list-group list-group-flush'>
        {devices.map((device) => (
          <li className="list-group-item d-flex justify-content-between align-items-center">
            <Device device={device} />
          </li>
        ))}
      </ul>

      <hr className='hr'/>
      <h2>Firewall Rules</h2>
      <ul className='list-group list-group-flush'>
        {fwRules.map((fwRule, index) => (
          <li className="list-group-item">
            <FirewallRule fwRule={fwRule} isEnabled={selectedFwRuleIds.includes(fwRule.id)} onFirewallRuleChanged={onFirewallRuleChanged} />
          </li>
        ))}
      </ul>

      <hr className='hr'/>
      <h2>Client Devices</h2>
      <table class="table table-dark table-hover">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">OUI</th>
            <th scope="col">MAC</th>
            <th scope="col">Status</th>
            <th scope="col">Last seen</th>
            <th scope="col">Blocked</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <Client client={client} isBlocked={selectedClientIds.includes(client.id)} onClientChanged={onClientChanged} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
