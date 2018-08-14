import _ from 'lodash';
import { logger, util } from 'appium-support';
import { validators } from './validators';
import { errors, isErrorType, errorFromMJSONWPStatusCode, errorFromW3CJsonCode,
         getResponseForW3CError, getResponseForJsonwpError } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';
import { renameKey } from '../basedriver/helpers';
import B from 'bluebird';
import BaseDriver from '../basedriver/driver';


const mjsonwpLog = logger.getLogger('MJSONWP');
const w3cLog = logger.getLogger('W3C');

const JSONWP_SUCCESS_STATUS_CODE = 0;
// TODO: Make this value configurable as a server side capability
const LOG_OBJ_LENGTH = 1024; // MAX LENGTH Logged to file / console

const MJSONWP_ELEMENT_KEY = 'ELEMENT';
const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';
const IMAGE_ELEMENT_PREFIX = 'appium-image-element-';

const IMG_EL_BODY_RE = new RegExp(
  `"(${W3C_ELEMENT_KEY}|${MJSONWP_ELEMENT_KEY})":\s*` +
  `"${IMAGE_ELEMENT_PREFIX}[^"]+"`
);
const IMG_EL_URL_RE = new RegExp(
  `/(element|screenshot)` +
  `/${IMAGE_ELEMENT_PREFIX}[^/]+`
);

class Protocol {}

function getLogByProtocol (driver) {
  return driver.isW3CProtocol() ? w3cLog : mjsonwpLog;
}

function isSessionCommand (command) {
  return !_.includes(NO_SESSION_ID_COMMANDS, command);
}

function wrapParams (paramSets, jsonObj) {
  /* There are commands like performTouch which take a single parameter (primitive type or array).
   * Some drivers choose to pass this parameter as a value (eg. [action1, action2...]) while others to
   * wrap it within an object(eg' {gesture:  [action1, action2...]}), which makes it hard to validate.
   * The wrap option in the spec enforce wrapping before validation, so that all params are wrapped at
   * the time they are validated and later passed to the commands.
   */
  let res = jsonObj;
  if (_.isArray(jsonObj) || !_.isObject(jsonObj)) {
    res = {};
    res[paramSets.wrap] = jsonObj;
  }
  return res;
}

function unwrapParams (paramSets, jsonObj) {
  /* There are commands like setNetworkConnection which send parameters wrapped inside a key such as
   * "parameters". This function unwraps them (eg. {"parameters": {"type": 1}} becomes {"type": 1}).
   */
  let res = jsonObj;
  if (_.isObject(jsonObj)) {
    // some clients, like ruby, don't wrap
    if (jsonObj[paramSets.unwrap]) {
      res = jsonObj[paramSets.unwrap];
    }
  }
  return res;
}

function checkParams (paramSets, jsonObj, protocol) {
  let requiredParams = [];
  let optionalParams = [];
  let receivedParams = _.keys(jsonObj);

  if (paramSets) {
    if (paramSets.required) {
      // we might have an array of parameters,
      // or an array of arrays of parameters, so standardize
      if (!_.isArray(_.first(paramSets.required))) {
        requiredParams = [paramSets.required];
      } else {
        requiredParams = paramSets.required;
      }
    }
    // optional parameters are just an array
    if (paramSets.optional) {
      optionalParams = paramSets.optional;
    }

    // If a function was provided as the 'validate' key, it will here be called with
    // jsonObj as the param. If it returns something falsy, verification will be
    // considered to have passed. If it returns something else, that will be the
    // argument to an error which is thrown to the user
    if (paramSets.validate) {
      let message = paramSets.validate(jsonObj, protocol);
      if (message) {
        throw new errors.BadParametersError(message, jsonObj);
      }
    }
  }

  // if we have no required parameters, all is well
  if (requiredParams.length === 0) {
    return;
  }

  // some clients pass in the session id in the params
  if (optionalParams.indexOf('sessionId') === -1) {
    optionalParams.push('sessionId');
  }

  // some clients pass in an element id in the params
  if (optionalParams.indexOf('id') === -1) {
    optionalParams.push('id');
  }

  // go through the required parameters and check against our arguments
  for (let params of requiredParams) {
    if (_.difference(receivedParams, params, optionalParams).length === 0 &&
        _.difference(params, receivedParams).length === 0) {
      // we have a set of parameters that is correct
      // so short-circuit
      return;
    }
  }
  throw new errors.BadParametersError(paramSets, receivedParams);
}

/*
 * This method takes 3 pieces of data: request parameters ('requestParams'),
 * a request JSON body ('jsonObj'), and 'payloadParams', which is the section
 * from the route definition for a particular endpoint which has instructions
 * on handling parameters. This method returns an array of arguments which will
 * be applied to a command.
 */
function makeArgs (requestParams, jsonObj, payloadParams, protocol) {
  // We want to pass the "url" parameters to the commands in reverse order
  // since the command will sometimes want to ignore, say, the sessionId.
  // This has the effect of putting sessionId last, which means in JS we can
  // omit it from the function signature if we're not going to use it.
  let urlParams = _.keys(requestParams).reverse();

  // In the simple case, the required parameters are a basic array in
  // payloadParams.required, so start there. It's possible that there are
  // multiple optional sets of required params, though, so handle that case
  // too.
  let requiredParams = payloadParams.required;
  if (_.isArray(_.first(payloadParams.required))) {
    // If there are optional sets of required params, then we will have an
    // array of arrays in payloadParams.required, so loop through each set and
    // pick the one that matches which JSON params were actually sent. We've
    // already been through validation so we're guaranteed to find a match.
    let keys = _.keys(jsonObj);
    for (let params of payloadParams.required) {
      if (_.without(params, ...keys).length === 0) {
        requiredParams = params;
        break;
      }
    }
  }

  // Now we construct our list of arguments which will be passed to the command
  let args;
  if (_.isFunction(payloadParams.makeArgs)) {
    // In the route spec, a particular route might define a 'makeArgs' function
    // if it wants full control over how to turn JSON parameters into command
    // arguments. So we pass it the JSON parameters and it returns an array
    // which will be applied to the handling command. For example if it returns
    // [1, 2, 3], we will call `command(1, 2, 3, ...)` (url params are separate
    // from JSON params and get concatenated below).
    args = payloadParams.makeArgs(jsonObj, protocol);
  } else {
    // Otherwise, collect all the required and optional params and flatten them
    // into an argument array
    args = _.flatten(requiredParams).map((p) => jsonObj[p]);
    if (payloadParams.optional) {
      args = args.concat(_.flatten(payloadParams.optional).map((p) => jsonObj[p]));
    }
  }
  // Finally, get our url params (session id, element id, etc...) on the end of
  // the list
  args = args.concat(urlParams.map((u) => requestParams[u]));
  return args;
}

function routeConfiguringFunction (driver) {
  if (!driver.sessionExists) {
    throw new Error('Drivers used with MJSONWP must implement `sessionExists`');
  }

  if (!(driver.executeCommand || driver.execute)) {
    throw new Error('Drivers used with MJSONWP must implement `executeCommand` or `execute`');
  }

  // return a function which will add all the routes to the driver
  return function (app) {
    for (let [path, methods] of _.toPairs(METHOD_MAP)) {
      for (let [method, spec] of _.toPairs(methods)) {
        // set up the express route handler
        buildHandler(app, method, path, spec, driver, isSessionCommand(spec.command));
      }
    }
  };
}

function buildHandler (app, method, path, spec, driver, isSessCmd) {
  let asyncHandler = async (req, res) => {
    let jsonObj = req.body;
    let httpResBody = {};
    let httpStatus = 200;
    let newSessionId;
    let isW3C;
    let isMJSONWP;

    // get the appropriate logger depending on the protocol that is being used
    const log = getLogByProtocol(driver);

    try {
      // if this is a session command but we don't have a session,
      // error out early (especially before proxying)
      if (isSessCmd && !driver.sessionExists(req.params.sessionId)) {
        throw new errors.NoSuchDriverError();
      }

      // if the driver is currently proxying commands to another JSONWP
      // server, bypass all our checks and assume the upstream server knows
      // what it's doing. But keep this in the try/catch block so if proxying
      // itself fails, we give a message to the client. Of course we only
      // want to do these when we have a session command; the Appium driver
      // must be responsible for start/stop session, etc...
      if (isSessCmd && driverShouldDoJwpProxy(driver, req, spec.command)) {
        await doJwpProxy(driver, req, res);
        return;
      }

      // if a command is not in our method map, it's because we
      // have no plans to ever implement it
      if (!spec.command) {
        throw new errors.NotImplementedError();
      }

      // wrap params if necessary
      if (spec.payloadParams && spec.payloadParams.wrap) {
        jsonObj = wrapParams(spec.payloadParams, jsonObj);
      }

      // unwrap params if necessary
      if (spec.payloadParams && spec.payloadParams.unwrap) {
        jsonObj = unwrapParams(spec.payloadParams, jsonObj);
      }

      // ensure that the json payload conforms to the spec
      checkParams(spec.payloadParams, jsonObj, driver.protocol);
      // ensure the session the user is trying to use is valid

      // turn the command and json payload into an argument list for
      // the driver methods
      let args = makeArgs(req.params, jsonObj, spec.payloadParams || {}, driver.protocol);
      let driverRes;
      // validate command args according to MJSONWP
      if (validators[spec.command]) {
        validators[spec.command](...args);
      }

      // run the driver command wrapped inside the argument validators
      log.debug(`Calling ${driver.constructor.name}.${spec.command}() with args: ` +
                _.truncate(JSON.stringify(args), {length: LOG_OBJ_LENGTH}));

      if (driver.executeCommand) {
        driverRes = await driver.executeCommand(spec.command, ...args);
      } else {
        driverRes = await driver.execute(spec.command, ...args);
      }

      // Get the protocol after executeCommand (when command is `createSession`, protocol is assigned within
      // createSession function)
      isW3C = driver.isW3CProtocol();
      isMJSONWP = driver.isMjsonwpProtocol();

      // If `executeCommand` was overridden and the method returns an object
      // with a protocol and value/error property, re-assign the protocol
      const parsedDriverRes = parseProtocol(driverRes);
      if (parsedDriverRes) {
        isW3C = parsedDriverRes.isW3C;
        isMJSONWP = parsedDriverRes.isMJSONWP;
        if (parsedDriverRes.error) {
          throw parsedDriverRes.error;
        }
        driverRes = parsedDriverRes.value;
      }

      // Use the logger that's specific to this response
      const protocolLogger = isW3C ? w3cLog : mjsonwpLog;

      // unpack createSession response
      if (spec.command === 'createSession') {
        newSessionId = driverRes[0];
        if (isMJSONWP) {
          driverRes = driverRes[1];
        } else if (isW3C) {
          driverRes = {
            capabilities: driverRes[1],
          };
        }
      }

      // If the MJSONWP element key format (ELEMENT) was provided translate it to W3C element key format (element-6066-11e4-a52e-4f735466cecf)
      // and vice-versa
      if (driverRes) {
        if (isW3C) {
          driverRes = renameKey(driverRes, MJSONWP_ELEMENT_KEY, W3C_ELEMENT_KEY);
        } else {
          driverRes = renameKey(driverRes, W3C_ELEMENT_KEY, MJSONWP_ELEMENT_KEY);
        }
      }


      // convert undefined to null, but leave all other values the same
      if (_.isUndefined(driverRes)) {
        driverRes = null;
      }

      // delete should not return anything even if successful
      if (spec.command === 'deleteSession') {
        protocolLogger.debug(`Received response: ${_.truncate(JSON.stringify(driverRes), {length: LOG_OBJ_LENGTH})}`);
        protocolLogger.debug('But deleting session, so not returning');
        driverRes = null;
      }

      // if the status is not 0,  throw the appropriate error for status code.
      if (util.hasValue(driverRes)) {
        if (util.hasValue(driverRes.status) && !isNaN(driverRes.status) && parseInt(driverRes.status, 10) !== 0) {
          throw errorFromMJSONWPStatusCode(driverRes.status, driverRes.value);
        } else if (_.isPlainObject(driverRes.value) && driverRes.value.error) {
          throw errorFromW3CJsonCode(driverRes.value.error, driverRes.value.message, driverRes.value.stacktrace);
        }
      }

      // Response status should be the status set by the driver response.
      if (!isW3C) {
        httpResBody.status = (_.isNil(driverRes) || _.isUndefined(driverRes.status)) ? JSONWP_SUCCESS_STATUS_CODE : driverRes.status;
      }
      httpResBody.value = driverRes;
      protocolLogger.debug(`Responding to client with driver.${spec.command}() ` +
               `result: ${_.truncate(JSON.stringify(driverRes), {length: LOG_OBJ_LENGTH})}`);
    } catch (err) {
      // if anything goes wrong, figure out what our response should be
      // based on the type of error that we encountered
      let actualErr = err;

      if (_.isUndefined(isMJSONWP)) {
        isMJSONWP = driver.isMjsonwpProtocol();
      }

      if (_.isUndefined(isW3C)) {
        isW3C = driver.isW3CProtocol();
      }

      // Use the logger that's specific to this response
      const protocolLogger = isW3C ? w3cLog : mjsonwpLog;

      let errMsg = err.stacktrace || err.stack;
      if (!errMsg.includes(err.message)) {
        // if the message has more information, add it. but often the message
        // is the first part of the stack trace
        errMsg = `${err.message} ${errMsg}`;
      }
      protocolLogger.error(`Encountered internal error running command: ${errMsg}`);
      if (isErrorType(err, errors.ProxyRequestError)) {
        actualErr = err.getActualError();
      }

      if (isW3C) {
        [httpStatus, httpResBody] = getResponseForW3CError(actualErr);
      } else if (isMJSONWP) {
        [httpStatus, httpResBody] = getResponseForJsonwpError(actualErr);
      } else {
        // If it's unknown what the protocol is (like if it's `getStatus` prior to `createSession`), merge the responses
        // together to be protocol-agnostic
        let jsonwpRes = getResponseForJsonwpError(actualErr);
        let w3cRes = getResponseForW3CError(actualErr);

        httpResBody = {
          ...jsonwpRes[1],
          ...w3cRes[1],
        };

        // Use the JSONWP status code (which is usually 500)
        httpStatus = jsonwpRes[0];
      }
    }

    // decode the response, which is either a string or json
    if (_.isString(httpResBody)) {
      res.status(httpStatus).send(httpResBody);
    } else {
      if (newSessionId) {
        if (isW3C) {
          httpResBody.value.sessionId = newSessionId;
        } else {
          httpResBody.sessionId = newSessionId;
        }
      } else {
        httpResBody.sessionId = req.params.sessionId || null;
      }

      // Don't include sessionId in W3C responses
      if (isW3C) {
        delete httpResBody.sessionId;
      }
      res.status(httpStatus).json(httpResBody);
    }
  };
  // add the method to the app
  app[method.toLowerCase()](path, (req, res) => {
    B.resolve(asyncHandler(req, res)).done();
  });
}

function driverShouldDoJwpProxy (driver, req, command) {
  // drivers need to explicitly say when the proxy is active
  if (!driver.proxyActive(req.params.sessionId)) {
    return false;
  }

  // we should never proxy deleteSession because we need to give the containing
  // driver an opportunity to clean itself up
  if (command === 'deleteSession') {
    return false;
  }

  // validate avoidance schema, and say we shouldn't proxy if anything in the
  // avoid list matches our req
  if (driver.proxyRouteIsAvoided(req.params.sessionId, req.method, req.originalUrl)) {
    return false;
  }

  // if it looks like we have an image element in the url (as a route
  // parameter), never proxy. Just look for our image element prefix in allowed
  // positions (either after an 'element' or 'screenshot' path segment), and
  // ensure the prefix is followed by something
  if (IMG_EL_URL_RE.test(req.originalUrl)) {
    return false;
  }


  // also if it looks like we have an image element in the request body (as
  // a JSON parameter), never proxy. Basically check against a regexp of the
  // json string of the body, where we know what the form of an image element
  // must be
  const stringBody = JSON.stringify(req.body);
  if (stringBody && IMG_EL_BODY_RE.test(stringBody)) {
    return false;
  }

  return true;
}

async function doJwpProxy (driver, req, res) {
  getLogByProtocol(driver).info('Driver proxy active, passing request on via HTTP proxy');

  // check that the inner driver has a proxy function
  if (!driver.canProxy(req.params.sessionId)) {
    throw new Error('Trying to proxy to a JSONWP server but driver is unable to proxy');
  }
  try {
    const proxiedRes = await driver.executeCommand('proxyReqRes', req, res, req.params.sessionId);
    if (proxiedRes && proxiedRes.error) throw proxiedRes.error; // eslint-disable-line curly
  } catch (err) {
    if (isErrorType(err, errors.ProxyRequestError)) {
      throw err;
    } else {
      throw new Error(`Could not proxy. Proxy error: ${err.message}`);
    }
  }
}

/**
 * Check a driver command respond and see if the protocol and value was passed in
 * @param {Object} driverRes Response returned by `executeCommand` in an inner driver
 * @returns {?Object} Object of the form {isW3C, isMJSONWP, value|error} or null if it isn't parsable
 */
function parseProtocol (driverRes) {
  if (!_.isPlainObject(driverRes) || !_.isString(driverRes.protocol)) {
    return null;
  }

  let isW3C = driverRes.protocol === BaseDriver.DRIVER_PROTOCOL.W3C;
  let isMJSONWP = driverRes.protocol === BaseDriver.DRIVER_PROTOCOL.MJSONWP;

  if (_.has(driverRes, 'value')) {
    return {isW3C, isMJSONWP, value: driverRes.value};
  }

  if (_.isError(driverRes.error)) {
    return {isW3C, isMJSONWP, error: driverRes.error};
  }

  return null;
}


export { Protocol, routeConfiguringFunction, isSessionCommand,
         MJSONWP_ELEMENT_KEY, W3C_ELEMENT_KEY, IMAGE_ELEMENT_PREFIX, parseProtocol,
         driverShouldDoJwpProxy };
