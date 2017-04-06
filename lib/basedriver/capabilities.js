import _ from 'lodash';
import { validator } from './desired-caps';
import { util } from 'appium-support';

function mergeCaps (primary = {}, secondary = {}) {
  let result = Object.assign(primary);

  for (let [name, value] of _.toPairs(secondary)) {
    if (!_.isUndefined(primary[name])) {
      throw new Error(`property ${name} should not exist on both primary and secondary`);
    }
    result[name] = value;
  }

  return result;
}

function validateCaps (caps, constraints = {}, skipPresenceConstraint = false) {
  let message = '';
  if (!_.isObject(caps)) {
    throw new Error(`must be a JSON object`);
  }

  constraints = _.cloneDeep(constraints); // Defensive copy

  // Remove the 'presence' constraint if we're not checking for it
  if (skipPresenceConstraint) {
    constraints = Object.assign(constraints);
    for (let key of Object.keys(constraints)) {
      delete constraints[key].presence;
    }
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
function parseCaps (caps, constraints = {}, shouldValidateCaps = true) {
  if (!_.isObject(caps)) {
    throw new Error('The capabilities argument was not valid for the following reason(s): "capabilities" must be a JSON object.');
  }

  let {alwaysMatch: requiredCaps, firstMatch: allFirstMatchCaps = []} = caps; // jshint ignore:line

  if (!_.isObject(requiredCaps)) {
    requiredCaps = {}; 
  }

  requiredCaps = validateCaps(requiredCaps, constraints);

  // Reject 'firstMatch' argument if it's not an array
  if (!_.isArray(allFirstMatchCaps)) {
    throw new Error('The capabilities.firstMatch argument was not valid for the following reason(s): "capabilities.firstMatch" must be a JSON array or undefined');
  }

  // Validate the firstMatch capabilities
  let validatedFirstMatchCaps = allFirstMatchCaps.map((firstMatchCaps, index) => {
    try {
      return shouldValidateCaps ? validateCaps(firstMatchCaps, constraints) : firstMatchCaps;
    } catch (e) {
      throw new Error(`The capabilities.firstMatch argument was not valid for the following reason: "capabilities.firstMatch[${index}] ${e.message}`);
    }
  });

  // Try to match requiredCaps with one of the validated firstMatch capabilities
  let matchedCaps = null;
  for (let firstMatchCaps of validatedFirstMatchCaps) {
    try {
      let matchedCaps = mergeCaps(requiredCaps, firstMatchCaps);
      if (matchedCaps) {
        break;
      }
    } catch (ign) { }
  }

  // If there was no match, just use the de-facto requiredCaps on their own
  matchedCaps = matchedCaps || requiredCaps;
  if (!matchedCaps) {
    matchedCaps = requiredCaps;
  }

  return {requiredCaps, allFirstMatchCaps, validatedFirstMatchCaps, matchedCaps};
}

function processCaps (caps, constraints = {}, shouldValidateCaps = true) {
  return parseCaps(caps, constraints, shouldValidateCaps).matchedCaps;
}


export default { parseCaps, processCaps, validateCaps, mergeCaps };
