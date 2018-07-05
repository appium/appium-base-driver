import _ from 'lodash';
import { MJpegStream } from '../..';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import B from 'bluebird';
import { initMJpegServer } from './fixtures/mjpeg-server';

const should = chai.should();
chai.use(chaiAsPromised);

const MJPEG_SERVER_PORT = 8589;
const MJPEG_SERVER_URL = `http://localhost:${MJPEG_SERVER_PORT}`;

describe('MJpeg Stream (e2e)', function () {

  let mJpegServer;

  before(function () {
    mJpegServer = initMJpegServer(MJPEG_SERVER_PORT);
  });

  after(function () {
    mJpegServer.close();
  });

  it('should update mjpeg stream based on new data from mjpeg server', async function () {
    let stream = new MJpegStream(MJPEG_SERVER_URL, _.noop);
    should.not.exist(stream.lastChunk);
    await stream.start();
    should.exist(stream.lastChunk);
    stream.updateCount.should.eql(1);

    await B.delay(1000); // let the stream update a bit
    stream.updateCount.should.be.above(1);

    // verify jpeg type and byte length of fixture image
    const startBytes = Buffer.from([0xff, 0xd8]);
    const endBytes = Buffer.from([0xff, 0xd9]);
    const startPos = stream.lastChunk.indexOf(startBytes);
    const endPos = stream.lastChunk.indexOf(endBytes);
    startPos.should.eql(0);   // proves we have a jpeg
    endPos.should.eql(29276); // proves we have a jpeg of the right size

    // verify we can get the base64 version too
    const b64 = stream.lastChunkBase64;
    b64.should.be.a('string');
    b64.indexOf('/9j').should.eql(0);
    b64.length.should.be.above(1000);

    // now stop the stream and wait some more then assert no new data has come in
    stream.stop();
    await B.delay(1000);
    should.not.exist(stream.lastChunk);
    stream.updateCount.should.eql(0);
  });

  it('should error out if the server does not send any images before a timeout', async function () {
    let stream = new MJpegStream(MJPEG_SERVER_URL, _.noop);
    await stream.start(0).should.eventually.be.rejectedWith(/never sent/);
  });
});
