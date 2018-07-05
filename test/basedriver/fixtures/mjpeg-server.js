import _ from 'lodash';
import http from 'http';
import mJpegServer from 'mjpeg-server';
import path from 'path';
import { fs } from 'appium-support';
import B from 'bluebird';

const IMAGE_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'test',
                                'basedriver', 'fixtures', 'appium-diagram.jpg');

export function initMJpegServer (port, intMs = 300, times = 20) {
  const server = http.createServer(async function (req, res) {
    const mJpegReqHandler = mJpegServer.createReqHandler(req, res);
    const jpg = await fs.readFile(IMAGE_PATH, 'binary');

    // just send the same jpeg over and over
    for (let i = 0; i < times; i++) {
      await B.delay(intMs);
      mJpegReqHandler._write(jpg, null, _.noop);
    }
    mJpegReqHandler.close();
  }).listen(port);

  return server;
}
