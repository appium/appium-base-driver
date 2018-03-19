import _ from 'lodash';
import url from 'url';


const WEBSOCKET_SERVERS = {};
let IS_UPGRADE_LISTENER_ASSIGNED = false;
const PATHNAME_PREFIX = '/wd/ws';


/**
 * Adds websocket handler to express server instance.
 *
 * @param {Object} server - An instance of express HTTP server.
 * @param {string} handlerPathname - Web socket endpoint path starting with
 * single slash charcter. `/wd/ws` prefix is automatically added to the
 * actual endpoint.
 * @param {Object} handlerServer - WebSocket server instance. See
 * https://github.com/websockets/ws/pull/885 for more details
 * on how to configure the handler properly.
 * @param {?string} pathnamePrefix ['/wd/ws'] - Pathname prefix.
 */
function addWebsocketHandler (server, handlerPathname, handlerServer, pathnamePrefix = PATHNAME_PREFIX) {
  WEBSOCKET_SERVERS[handlerPathname] = handlerServer;

  if (IS_UPGRADE_LISTENER_ASSIGNED) {
    return;
  }
  // https://github.com/websockets/ws/pull/885
  server.on('upgrade', (request, socket, head) => {
    const currentPathname = url.parse(request.url).pathname;
    for (const [pathname, wsServer] of _.toPairs(WEBSOCKET_SERVERS)) {
      if (currentPathname === (_.isEmpty(pathnamePrefix) ? pathname : `${pathnamePrefix}${pathname}`)) {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit('connection', ws);
        });
        return;
      }
    }
    socket.destroy();
  });
  IS_UPGRADE_LISTENER_ASSIGNED = true;
}

/**
 * Removes existing websocket handler from express server instance.
 * The call is ignored if the given `handlerPathname` handler
 * is not present in the handlers list.
 *
 * @param {string} handlerPathname - Websocket endpoint path.
 * `/wd/hub/ws` prefix is automatically added to the actual endpoint.
 */
function removeWebsocketHandler (handlerPathname) {
  if (!WEBSOCKET_SERVERS[handlerPathname]) {
    return;
  }

  try {
    WEBSOCKET_SERVERS[handlerPathname].close();
  } catch (ign) {
    // ignore
  } finally {
    delete WEBSOCKET_SERVERS[handlerPathname];
  }
}

export { addWebsocketHandler, removeWebsocketHandler };
