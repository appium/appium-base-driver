import log from './logger';
import validator from 'validate.js';

let desiredCapabilityConstraints = {
  platformName: {
    presence: true,
    isString: true,
    inclusion: [
      'iOS',
      'Android',
      'FirefoxOS',
      'Fake'
    ]
  },
  deviceName: {
    presence: true,
    isString: true
  },
  platformVersion: {},
  newCommandTimeout: {
    isNumber: true
  },
  automationName: {
    inclusion: [
      'Appium',
      'Selendroid'
    ]
  },
  autoLaunch: {
    isBoolean: true
  },
  udid: {
    isString: true
  },
  orientation: {
    inclusion: [
      'LANDSCAPE',
      'PORTRAIT'
    ]
  },
  autoWebview: {
    isBoolean: true
  },
  noReset: {
    isBoolean: true
  },
  fullReset: {
    isBoolean: true
  },
  app: {
    isString: true
  },
  browserName: {
    isString: true
  },
  locationServicesAuthorized: {
    isBoolean: true
  },
  launchTimeout : {
  }
};

validator.validators.isString = function (value) {
  if (typeof value === 'string') {
    return null;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  return `must be of type string`;
};
validator.validators.isNumber = function (value) {
  if (typeof value === 'number') {
    return null;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  return `must be of type number`;
};
validator.validators.isBoolean = function (value) {
  if (typeof value === 'boolean') {
    return null;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  return `must be of type boolean`;
};
validator.validators.isObject = function (value) {
  if (typeof value === 'object') {
    return null;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  return `must be of type object`;
};
validator.validators.deprecated = function (value, options, key) {
  if (options) {
    log.warn(`${key} is a deprecated capability`);
  }
  return null;
};

export { desiredCapabilityConstraints, validator };
