import unifi from '../services/unifi';

const FirewallRule = ({ fwRule, isEnabled, onFirewallRuleChanged }) => {
  const onChangeHandler = () => {
    const newValue = !isEnabled;
    
    unifi.setFirewallRule(fwRule.id, newValue)
    .then(() => {
      onFirewallRuleChanged(fwRule.id, newValue);
    }).catch(error => {
      console.error('Unable to set firewall rule!');
      console.error(error);
      onFirewallRuleChanged(fwRule.id, !newValue);
    });
  };

  return (
    <div className="form-check form-check-reverse form-switch d-flex justify-content-between align-items-center">
      <label className="form-check-label" for="flexSwitchCheckChecked">{ fwRule.name }</label>
      <input className="form-check-input" type="checkbox" role="switch" id="flexSwitchCheckChecked" checked={isEnabled} onChange={onChangeHandler} />
    </div>
  );
};

export default FirewallRule;