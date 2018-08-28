// transpile:mocha
/* global describe:true, it:true */

import _ from 'lodash';
import ProtoConverter from '../../lib/jsonwp-proxy/proto-converter';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import BaseDriver from '../../lib/basedriver/driver';

const {MJSONWP, W3C} = BaseDriver.DRIVER_PROTOCOL;

chai.use(chaiAsPromised);

describe('ProtoConverter', function () {
  describe('getTimeoutRequestObjects', function () {
    let protoConverter;
    before(function () {
      protoConverter = new ProtoConverter(_.noop);
    });
    it('should take W3C inputs and produce MJSONWP compatible objects', async function () {
      protoConverter.downstreamProtocol = MJSONWP;
      let timeoutObjects = await protoConverter.getTimeoutRequestObjects({script: 100});
      timeoutObjects.length.should.equal(1);
      timeoutObjects[0].should.eql({type: 'script', ms: 100});
    });
    it('should take multiple W3C timeouts and produce multiple MJSONWP compatible objects', async function () {
      protoConverter.downstreamProtocol = MJSONWP;
      let [scriptTimeout, pageLoadTimeout, implicitTimeout] = await protoConverter.getTimeoutRequestObjects({script: 100, pageLoad: 200, implicit: 300});
      scriptTimeout.should.eql({
        type: 'script',
        ms: 100,
      });
      pageLoadTimeout.should.eql({
        type: 'page load',
        ms: 200,
      });
      implicitTimeout.should.eql({
        type: 'implicit',
        ms: 300,
      });
    });
    it('should take MJSONWP input and produce W3C compatible object', async function () {
      protoConverter.downstreamProtocol = W3C;
      let timeoutObjects = await protoConverter.getTimeoutRequestObjects({implicit: 300});
      timeoutObjects.length.should.equal(1);
      timeoutObjects[0].should.eql({implicit: 300});
    });
  });
});
