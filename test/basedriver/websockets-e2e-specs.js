import { server, routeConfiguringFunction,
         addWebsocketHandler, removeWebsocketHandler } from '../..';
import { FakeDriver } from '../protocol/fake-driver';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import WebSocket from 'ws';
import B from 'bluebird';

chai.use(chaiAsPromised);

describe('Websockets (e2e)', function () {
  let baseServer;
  let driver;
  const SESSION_ID = 'foo';
  const WS_DATA = 'Hello';
  const PORT = 8181;

  before(async function () {
    driver = new FakeDriver();
    driver.sessionId = SESSION_ID;
    baseServer = await server(routeConfiguringFunction(driver), PORT);
  });
  after(async function () {
    await baseServer.close();
  });

  describe('web sockets support', function () {
    it('should be able to add websocket handler and remove it', async function () {
      const wss = new WebSocket.Server({
        noServer: true,
      });
      wss.on('connection', (ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(WS_DATA);
        }
      });
      const previousListenerCount = baseServer.listenerCount('upgrade');
      const endpoint = '/hello';
      const timeout  = 5000;
      addWebsocketHandler(baseServer, endpoint, wss);
      baseServer.listenerCount('upgrade').should.be.above(previousListenerCount);
      await new B((resolve, reject) => {
        const client = new WebSocket(`ws://localhost:${PORT}/ws${endpoint}`);
        client.on('message', (data) => {
          data.should.eql(WS_DATA);
          resolve();
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('No websocket messages have been received after the timeout')),
                   timeout);
      });

      removeWebsocketHandler(endpoint);
      await new B((resolve, reject) => {
        const client = new WebSocket(`ws://localhost:${PORT}/ws${endpoint}`);
        client.on('message', (data) =>
          reject(new Error(`No websocket messages are expected after the handler ` +
                           `has been removed. '${data}' is received instead. `))
        );
        client.on('error', resolve);
        setTimeout(resolve, timeout);
      });
      baseServer.listenerCount('upgrade').should.be.above(previousListenerCount);
    });
  });
});

