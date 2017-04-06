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
function parseCapabilities (caps = {}, constraints = {}, shouldValidateCaps = true) {

  let {alwaysMatch: requiredCapabilities, firstMatch: allFirstMatchCapabilities = []} = caps; // jshint ignore:line

  if (!_.isObject(requiredCapabilities)) {
    requiredCapabilities = {}; 
  }

  requiredCapabilities = validateCapabilities(requiredCapabilities, constraints);

  // Reject 'firstMatch' argument if it's not an array
  if (!_.isArray(allFirstMatchCapabilities)) {
    throw new Error('The capabilities.firstMatch argument was not valid for the following reason(s): "capabilities.firstMatch" must be a JSON array or undefined');
  }

  // Validate the firstMatch capabilities
  let validatedFirstMatchCapabilities = allFirstMatchCapabilities.map((firstMatchCapabilities, index) => {
    try {
      return shouldValidateCaps ? validateCapabilities(firstMatchCapabilities, constraints) : firstMatchCapabilities;
    } catch (e) {
      throw new Error(`The capabilities.firstMatch argument was not valid for the following reason: "capabilities.firstMatch[${index}] ${e.message}`);
    }
  });

  // Match requiredCapabilities with one of the validated firstMatch capabilities
  let matchedCapabilities = null;
  for (let firstMatchCapabilities of validatedFirstMatchCapabilities) {
    try {
      let mergedCapabilities = mergeCapabilities(requiredCapabilities, firstMatchCapabilities);
      matchedCapabilities = matchCapabilities(mergedCapabilities);
      if (matchedCapabilities) {
        break;
      }
    } catch (ign) { }
  }

  if (!matchedCapabilities) {
    matchedCapabilities = requiredCapabilities;
  }

  return {requiredCapabilities, allFirstMatchCapabilities, validatedFirstMatchCapabilities, matchedCapabilities};
}

function processCapabilities (capabilities, constraints = {}, shouldValidateCaps = true) {
  if (!_.isObject(capabilities)) {
    throw new Error('The capabilities argument was not valid for the following reason(s): "capabilities" must be a JSON object.');
  }
  return parseCapabilities(capabilities, constraints, shouldValidateCaps).matchedCapabilities;
}


export default { parseCapabilities, processCapabilities, validateCapabilities, mergeCapabilities, matchCapabilities };
