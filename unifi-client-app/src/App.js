import { useState, useEffect } from 'react';
import useWebSocket, { ReadyState } from "react-use-websocket"
import './App.css';

const App = () => {
  const backend = `${window.location.hostname}:3030`;

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    `ws://${backend}`,
    {
      share: false,
      shouldReconnect: () => true,
    },
  );

  // Run when the connection state (readyState) changes
  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      sendJsonMessage({
        type: "PING"
      });
    }
  }, [readyState]);

  // Run when a new WebSocket message is received (lastJsonMessage)
  useEffect(() => {
    console.log('Websocket message received', lastJsonMessage);
    if (lastJsonMessage?.type === 'DEVICE_STATE_CHANGED' && lastJsonMessage?.name === 'USG') {
      setUsgState(lastJsonMessage.status);
    }
  }, [lastJsonMessage]);

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

  const getInternetStatus = () => {
    fetchGet('/api/state').then((body) => {
      setFwInternet(body.fwInternet);
    })
    .catch((err) => {
      console.log(`Error caught in getInternetStatus() ${err}`);
    });
  };
  
  const setInternetStatus = (enabled) => {
    fetchPost('/api/state', { fwInternet: enabled }).then((body) => {
      setFwInternet(body.fwInternet);
    })
    .catch((err) => {
      console.log(`Error caught in setInternetStatus() ${err}`);
    });
  };

  const getUsgState = () => {
    fetchGet('/api/state/usg').then((body) => {
      setUsgState(body.usgState);
    })
    .catch((err) => {
      console.log(`Error caught in getUsgState() ${err}`);
    });
  };

  const getDevicesState = () => {
    fetchGet('/api/devices').then((devices) => {
      setDevices(devices);
    })
    .catch((err) => {
      console.log(`Error caught in getDevicesState() ${err}`);
    });
  };

  const [fwInternet, setFwInternet] = useState();
  const [usgState, setUsgState] = useState('Unknown');
  const [devices, setDevices] = useState([]);

  let internetStatus1 = 'Unknown';
  let internetStatus2 = 'Unknown';
  let cssClass1 = 'info';
  let cssClass2 = 'info';
  let cssClassUSG = 'info';

  if (fwInternet === true) {
    internetStatus1 = 'Disable';
    internetStatus2 = 'Enable';
    cssClass1 = 'danger';
    cssClass2 = 'success';
  } else if (fwInternet === false) {
    internetStatus1 = 'Enable';
    internetStatus2 = 'Disable';
    cssClass1 = 'success';
    cssClass2 = 'danger';
  }

  if (usgState === 'online') cssClassUSG = 'success';
  else if (usgState === 'adopting') cssClassUSG = 'warning';

  useEffect(() => {
    getInternetStatus();
    getUsgState();
    getDevicesState();
 }, []);

 const deviceStateCSSMap = {
  'offline': 'danger',
  'online': 'success',
  'adopting': 'warning' 
 };

  return (
    <div className="container text-center">
      <h1 className="display-1 fw-bold mb-2">UniFi</h1>
      <h2>USG status: <span className={`text-capitalize text-${cssClassUSG}`}>{usgState}</span></h2>
      <h2>Internet is currently: <span className={`text-capitalize text-${cssClass1}`}>{internetStatus1}</span></h2>
      <button className={`mt-3 w-100 btn btn-lg btn-${cssClass2}`} onClick={() => setInternetStatus(!fwInternet)}>
        {internetStatus2} Internet
      </button>
      
      <hr className='hr'/>
      <h2>Devices</h2>
      <ul className='list-group list-group-flush'>
      {devices.map((device) => (
        <li className="list-group-item d-flex justify-content-between align-items-center">
          <span>{device.name}</span>
          <span className={`fs-6 badge text-bg-${deviceStateCSSMap[device.state] || 'primary'}`}>{device.state}</span>
        </li>
      ))}
      </ul>
    </div>
  );
};

export default App;
