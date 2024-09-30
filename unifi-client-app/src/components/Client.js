import unifi from '../services/unifi';

const ClientDevice = ({ client, isBlocked, onClientChanged }) => {
  const checkHandler = () => {
    const newValue = !isBlocked;

    unifi.setClientState(client.mac, newValue ? 'block' : 'unblock')
    .then(() => {
      onClientChanged(client.mac, newValue);
    }).catch(error => {
      console.error('Unable to block client!');
      console.error(error);
      onClientChanged(client.mac, !newValue);
    });
  };

  return (
  <tr>
    <th scope="row">{client.display_name}</th>
    <td>{client.oui}</td>
    <td>{client.mac}</td>
    <td>{client.status}</td>
    <td>{new Date((Date.now()/1000 - client.last_seen) * 1000).toISOString().substring(11, 19)}</td>
    <td>
      <span className="form-check form-switch form-check-reverse">
        <input className="form-check-input" type="checkbox" role="switch" checked={isBlocked} onChange={checkHandler} />
      </span>
    </td>
  </tr>
  );
};

export default ClientDevice;