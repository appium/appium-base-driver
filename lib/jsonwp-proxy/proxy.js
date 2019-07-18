import _ from 'lodash';
import { logger, util } from 'appium-support';
import request from 'request-promise';
import { getSummaryByCode } from '../jsonwp-status/status';
import { errors, isErrorType, errorFromMJSONWPStatusCode, errorFromW3CJsonCode } from '../protocol/errors';
import BaseDriver from '../basedriver/driver';
import { routeToCommandName } from '../protocol/routes';
import ProtocolConverter from './protocol-converter';


const log = logger.getLogger('WD Proxy');
// TODO: Make this value configurable as a server side capability
const LOG_OBJ_LENGTH = 1024; // MAX LENGTH Logged to file / console
const DEFAULT_REQUEST_TIMEOUT = 240000;

const {MJSONWP, W3C} = BaseDriver.DRIVER_PROTOCOL;

class JWProxy {
  constructor (opts = {}) {
    Object.assign(this, {
      scheme: 'http',
      server: 'localhost',
      port: 4444,
      base: '/wd/hub',
      sessionId: null,
      timeout: DEFAULT_REQUEST_TIMEOUT,
      keepAlive: false,
    }, opts);
    this.scheme = this.scheme.toLowerCase();
    this._activeRequests = [];
    this._downstreamProtocol = null;
    this.protocolConverter = new ProtocolConverter(this.proxy.bind(this));
  }

  // abstract the call behind a member function
  // so that we can mock it in tests
  async request (...args) {
    const currentRequest = request(...args);
    this._activeRequests.push(currentRequest);
    return await currentRequest.finally(() => _.pull(this._activeRequests, currentRequest));
  }

  getActiveRequestsCount () {
    return this._activeRequests.length;
  }

  cancelActiveRequests () {
    try {
      for (let r of this._activeRequests) {
        r.cancel();
      }
    } finally {
      this._activeRequests = [];
    }
  }

  endpointRequiresSessionId (endpoint) {
    return !_.includes(['/session', '/sessions', '/status'], endpoint);
  }

  set downstreamProtocol (value) {
    this._downstreamProtocol = value;
    this.protocolConverter.downstreamProtocol = value;
  }

  get downstreamProtocol () {
    return this._downstreamProtocol;
  }

  getUrlForProxy (url) {
    if (url === '') {
      url = '/';
    }
    const proxyBase = `${this.scheme}://${this.server}:${this.port}${this.base}`;
    const endpointRe = '(/(session|status))';
    let remainingUrl = '';
    if (/^http/.test(url)) {
      const first = (new RegExp(`(https?://.+)${endpointRe}`)).exec(url);
      if (!first) {
        throw new Error('Got a complete url but could not extract JWP endpoint');
      }
      remainingUrl = url.replace(first[1], '');
    } else if ((new RegExp('^/')).test(url)) {
      remainingUrl = url;
    } else {
      throw new Error(`Did not know what to do with url '${url}'`);
    }

    const stripPrefixRe = new RegExp('^.*?(/(session|status).*)$');
    if (stripPrefixRe.test(remainingUrl)) {
      remainingUrl = stripPrefixRe.exec(remainingUrl)[1];
    }

    if (!(new RegExp(endpointRe)).test(remainingUrl)) {
      remainingUrl = `/session/${this.sessionId}${remainingUrl}`;
    }

    const requiresSessionId = this.endpointRequiresSessionId(remainingUrl);

    if (requiresSessionId && this.sessionId === null) {
      throw new Error('Trying to proxy a session command without session id');
    }

    const sessionBaseRe = new RegExp('^/session/([^/]+)');
    if (sessionBaseRe.test(remainingUrl)) {
      // we have something like /session/:id/foobar, so we need to replace
      // the session id
      const match = sessionBaseRe.exec(remainingUrl);
      remainingUrl = remainingUrl.replace(match[1], this.sessionId);
    } else if (requiresSessionId) {
      throw new Error(`Could not find :session section for url: ${remainingUrl}`);
    }
    remainingUrl = remainingUrl.replace(/\/$/, ''); // can't have trailing slashes

    return proxyBase + remainingUrl;
  }

  async proxy (url, method, body = null) {
    method = method.toUpperCase();
    const newUrl = this.getUrlForProxy(url);
    const reqOpts = {
      agent: false,
      url: newUrl,
      method,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'user-agent': 'appium',
        accept: 'application/json, */*',
      },
      resolveWithFullResponse: true,
      timeout: this.timeout,
      forever: this.keepAlive,
    };
    if (util.hasValue(body)) {
      if (typeof body !== 'object') {
        try {
          reqOpts.json = JSON.parse(body);
        } catch (e) {
          throw new Error('Cannot interpret the request body as valid JSON: ' +
            _.truncate(_.isString(body) ? body : JSON.stringify(body),
            {length: LOG_OBJ_LENGTH}));
        }
      } else {
        reqOpts.json = body;
      }
    }

    // GET methods shouldn't have any body. Most servers are OK with this, but WebDriverAgent throws 400 errors
    if (method === 'GET') {
      reqOpts.json = null;
    }

    log.debug(`Proxying [${method} ${url || '/'}] to [${method} ${newUrl}] ` +
      (body ? `with body: ${_.truncate(_.isString(body) ? body : JSON.stringify(body),
      {length: LOG_OBJ_LENGTH})}` : 'with no body'));

    const throwProxyError = (error) => {
      const message = `The request to ${url} has failed`;
      const err = new Error(message);
      err.message = message;
      err.error = error;
      err.statusCode = 500;
      throw err;
    };
    try {
      const res = await this.request(reqOpts);
      // `res.body` might be really big
      // Be careful while handling it to avoid memory leaks
      const resObj = util.safeJsonParse(res.body);
      if (!_.isPlainObject(resObj)) {
        // The response should be a valid JSON object
        // If it cannot be coerced to an object then the response is wrong
        throwProxyError(res.body);
      }
      log.debug(`Got response with status ${res.statusCode}: ` +
        _.truncate(_.isString(res.body) ? res.body : JSON.stringify(res.body), {
          length: LOG_OBJ_LENGTH,
        })
      );
      const isSessionCreationRequest = /\/session$/.test(url) && method === 'POST';
      if (isSessionCreationRequest && res.statusCode === 200) {
        this.sessionId = resObj.sessionId;
      }
      if (!this.downstreamProtocol) {
        this.downstreamProtocol = this.getProtocolFromResBody(resObj);
        log.debug(`Determined the downstream protocol as '${this.downstreamProtocol}'`);
      } else if (isSessionCreationRequest) {
        // It might be that we proxy API calls to the downstream driver
        // without creating a session first
        // and it responds using the default proto,
        // but then after createSession request is sent the internal proto is changed
        // to the other one based on the actually provided caps
        const previousValue = this.downstreamProtocol;
        this.downstreamProtocol = this.getProtocolFromResBody(resObj);
        if (previousValue && previousValue !== this.downstreamProtocol) {
          log.debug(`Updated the downstream protocol to '${this.downstreamProtocol}' ` +
            `as per session creation request`);
        } else {
          log.debug(`Determined the downstream protocol as '${this.downstreamProtocol}' ` +
            `per session creation request`);
        }
      }
      if (res.statusCode < 400 && this.downstreamProtocol === MJSONWP &&
        _.has(resObj, 'status') && parseInt(resObj.status, 10) !== 0) {
        // Some servers, like chromedriver may return response code 200 for non-zero JSONWP statuses
        throwProxyError(resObj);
      }
      return [res, resObj];
    } catch (e) {
      if (util.hasValue(e.error)) {
        log.warn(`Got an unexpected response: ` +
          _.truncate(_.isString(e.error) ? e.error : JSON.stringify(e.error), {length: LOG_OBJ_LENGTH}));
      } else {
        log.debug(e.stack);
      }
      throw new errors.ProxyRequestError(`Could not proxy command to remote server. ` +
        `Original error: ${e.message}`, e.error, e.statusCode);
    }
  }

  getProtocolFromResBody (resObj) {
    if (util.hasValue(resObj.status)) {
      return MJSONWP;
    }
    if (util.hasValue(resObj.value)) {
      return W3C;
    }
  }

  requestToCommandName (url, method) {
    const extractCommandName = (pattern) => {
      const pathMatch = pattern.exec(url);
      return pathMatch ? routeToCommandName(pathMatch[1], method) : null;
    };
    let commandName = routeToCommandName(url, method);
    if (!commandName && _.includes(url, '/wd/hub/session/')) {
      commandName = extractCommandName(/\/wd\/hub\/session\/[^/]+(.+)/);
    }
    if (!commandName && _.includes(url, '/wd/hub/')) {
      commandName = extractCommandName(/\/wd\/hub(\/.+)/);
    }
    return commandName;
  }

  async proxyCommand (url, method, body = null) {
    const commandName = this.requestToCommandName(url, method);
    if (!commandName) {
      return await this.proxy(url, method, body);
    }
    log.debug(`Matched '${url}' to command name '${commandName}'`);

    return await this.protocolConverter.convertAndProxy(commandName, url, method, body);
  }

  async command (url, method, body = null) {
    let response;
    let resObj;
    try {
      [response, resObj] = await this.proxyCommand(url, method, body);
    } catch (err) {
      if (isErrorType(err, errors.ProxyRequestError)) {
        throw err.getActualError();
      }
      throw new errors.UnknownError(err.message);
    }
    const protocol = this.getProtocolFromResBody(resObj);
    if (protocol === MJSONWP) {
      // Got response in MJSONWP format
      if (response.statusCode === 200 && resObj.status === 0) {
        return resObj.value;
      }
      const status = parseInt(resObj.status, 10);
      if (!isNaN(status) && status !== 0) {
        let message = resObj.value;
        if (_.has(message, 'message')) {
          message = message.message;
        }
        throw errorFromMJSONWPStatusCode(status, _.isEmpty(message) ? getSummaryByCode(status) : message);
      }
    } else if (protocol === W3C) {
      // Got response in W3C format
      if (response.statusCode < 300) {
        return resObj.value;
      }
      if (_.isPlainObject(resObj.value) && resObj.value.error) {
        throw errorFromW3CJsonCode(resObj.value.error, resObj.value.message, resObj.value.stacktrace);
      }
    } else if (response.statusCode === 200) {
      // Unknown protocol. Keeping it because of the backward compatibility
      return resObj;
    }
    throw new errors.UnknownError(`Did not know what to do with response code '${response.statusCode}' ` +
                                  `and response body '${_.truncate(JSON.stringify(resObj), {length: 300})}'`);
  }

  getSessionIdFromUrl (url) {
    const match = url.match(/\/session\/([^/]+)/);
    return match ? match[1] : null;
  }

  async proxyReqRes (req, res) {
    let [response, body] = await this.proxyCommand(req.originalUrl, req.method, req.body);

    res.headers = response.headers;
    res.set('content-type', response.headers['content-type']);
    // if the proxied response contains a sessionId that the downstream
    // driver has generated, we don't want to return that to the client.
    // Instead, return the id from the request or from current session
    body = util.safeJsonParse(body);
    if (body && body.sessionId) {
      const reqSessionId = this.getSessionIdFromUrl(req.originalUrl);
      if (reqSessionId) {
        log.info(`Replacing sessionId ${body.sessionId} with ${reqSessionId}`);
        body.sessionId = reqSessionId;
      } else if (this.sessionId) {
        log.info(`Replacing sessionId ${body.sessionId} with ${this.sessionId}`);
        body.sessionId = this.sessionId;
      }
    }
    res.status(response.statusCode).send(JSON.stringify(body));
  }
}

export { JWProxy };
export default JWProxy;
