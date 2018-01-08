import _ from 'lodash';
import { util } from 'appium-support';


function isNumber (o) {
  return _.isNumber(o) || !_.isNaN(parseInt(o, 10)) || !_.isNaN(parseFloat(o));
}

function msValidator (ms) {
  if (!_.isNumber(ms) || ms < 0) {
    throw new Error('Wait ms must be a number equal to 0 or greater');
  }
}

const validators = {
  setUrl: (url) => {
    // either an `xyz://`, `about:`, or `data:` scheme is allowed
    if (!url || !url.match(/^([a-zA-Z0-9_+.-]+:\/\/)|(about:)|(data:)/)) {
      throw new Error('Url or Uri must start with <scheme>://');
    }
  },
  implicitWait: (ms) => {
    msValidator(ms);
  },
  asyncScriptTimeout: (ms) => {
    msValidator(ms);
  },
  timeoutsW3C: (type, ms, scriptDuration, pageLoadDuration, implicitDuration) => {
    // W3C request to send one or more of the following parameters, script/pageLoad/implicit.
    let hasW3C = false;
    if (util.hasValue(scriptDuration)) {
      hasW3C = true;
      msValidator(scriptDuration);
    }
    if (util.hasValue(pageLoadDuration)) {
      hasW3C = true;
      msValidator(pageLoadDuration);
    }
    if (util.hasValue(implicitDuration)) {
      hasW3C = true;
      msValidator(implicitDuration);
    }
    if (hasW3C) {
      return;
    }

    // For MJSONWP.
    // If there are no W3C related attribute, we validate values for MJSONWP.
    msValidator(ms);
    if (!_.includes(['script', 'implicit', 'page load', 'command'], type)) {
      throw new Error(`'${type}' is not a valid timeout type`);
    }
  },
  timeouts: (type, ms) => {
    msValidator(ms);
    if (!_.includes(['script', 'implicit', 'page load', 'command'], type)) {
      throw new Error(`'${type}' is not a valid timeout type`);
    }
  },
  clickCurrent: (button) => {
    if (!(isNumber(button) || _.isUndefined(button)) || (button < 0 || button > 2)) {
      throw new Error('Click button must be 0, 1, or 2');
    }
  },
  setNetworkConnection: (type) => {
    if (!isNumber(type) || [0, 1, 2, 4, 6].indexOf(type) === -1) {
      throw new Error('Network type must be one of 0, 1, 2, 4, 6');
    }
  }
};

export { validators };
