import _ from 'lodash';
import { validator } from './desired-caps';
import { util } from 'appium-support';

function mergeCapabilities (primary = {}, secondary = {}) {
  let result = Object.assign(primary);

  for (let [name, value] of _.toPairs(secondary)) {
    if (!_.isUndefined(primary[name])) {
      throw new Error(`property ${name} should not exist on both primary and secondary`);
    }
    result[name] = value;
  }

  return result;
}

// TODO: Investigate this. Do we need this? (https://www.w3.org/TR/webdriver/#dfn-matching-capabilities)
function matchCapabilities (caps) {
  return caps;
}

function validateCapabilities (caps, constraints) {
  let message = '';
  if (!_.isObject(caps)) {
    throw new Error(`must be a JSON object`);
  }

  let validationErrors = validator.validate(_.pickBy(caps, util.hasValue),
                                              constraints,
                                              {fullMessages: false});

  if (validationErrors) {
    for (let [attribute, reasons] of _.toPairs(validationErrors)) {
      for (let reason of reasons) {
        message += ` ${attribute} ${reason},`;
      }
    }
    message = `${message.slice(0, -1)}.`;
    throw new Error(message);
  }

  // Return caps
  return caps;
}

// Parse capabilities (based on https://www.w3.org/TR/webdriver/#processing-capabilities)
function parseCapabilities (capabilities, alwaysMatch, firstMatch = [], constraints = {}) {
  let capabilitiesRequest, requiredCapabilities, allFirstMatchCapabilities, validatedFirstMatchCapabilities, matchedCapabilities = null;
  
  capabilitiesRequest = capabilities;
  if (!_.isObject(capabilitiesRequest)) {
    throw new Error('The capabilities argument was not valid for the following reason(s): "capabilities" must be a JSON object.');
  }

  requiredCapabilities = alwaysMatch;
  if (!_.isObject(requiredCapabilities)) {
    requiredCapabilities = {}; 
  }

  allFirstMatchCapabilities = firstMatch;
  if (!_.isArray(allFirstMatchCapabilities)) {
    throw new Error('The firstMatch argument was not valid for the following reason(s): "firstMatch" must be a JSON array or undefined');
  }

  validatedFirstMatchCapabilities = allFirstMatchCapabilities.map((firstMatchCapabilities, index) => {
    try {
      return validateCapabilities(firstMatchCapabilities, constraints);
    } catch (e) {
      throw new Error(`The firstMatch argument was not valid for the following reason: firstMatch[${index}] ${e.message}`);
    }
  });

  for (let firstMatchCapabilities of validatedFirstMatchCapabilities) {
    try {
      let mergedCapabilities = mergeCapabilities(requiredCapabilities, firstMatchCapabilities);
      matchedCapabilities = matchCapabilities(mergedCapabilities);
      if (matchedCapabilities) {
        break;
      }
    } catch (ign) { }
  }

  return {capabilitiesRequest, requiredCapabilities, allFirstMatchCapabilities, validatedFirstMatchCapabilities, matchedCapabilities};
}

function processCapabilities (capabilities, alwaysMatch, firstMatch = [], constraints = {}) {
  return parseCapabilities(capabilities, alwaysMatch, firstMatch, constraints).matchedCapabilities;
}


export default { parseCapabilities, processCapabilities, validateCapabilities, mergeCapabilities, matchCapabilities };
