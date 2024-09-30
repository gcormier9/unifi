const Device = ({ device }) => {
  //const [state, setState] = useState('Unknown');

  const deviceStateCSSMap = {
    'offline': 'danger',
    'online': 'success',
    'adopting': 'warning' 
  };

  return (
    <>
      <span>{ device.name }</span>
      <span className={`fs-6 badge text-bg-${deviceStateCSSMap[device.state] || 'primary'}`}>{ device.state }</span>
    </>
  );
};

export default Device;