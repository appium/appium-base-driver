// transpile:mocha

import { server, routeConfiguringFunction } from '../..';
import { FakeDriver } from '../fake-driver';
import request from 'request-promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { storeFile, cleanupOutdatedEntries } from '../../lib/express/download';
import { fs, tempDir } from 'appium-support';
import B from 'bluebird';

const PORT = 8181;

chai.use(chaiAsPromised);

describe('Download', async function () {

  describe('via express router', function () {
    let srv;

    before(async function () {
      const driver = new FakeDriver();
      driver.sessionId = 'foo';
      srv = await server(routeConfiguringFunction(driver), PORT);
    });

    after(async function () {
      srv.close();
    });

    it('should be able to store and then download the stored file by SID', async function () {
      const info = await tempDir.open();
      const tmpFilePath = info.path;
      const fileContent = Buffer.from('appium', 'utf-8');
      try {
        await fs.writeFile(tmpFilePath, fileContent);
        const sid = await storeFile(tmpFilePath);
        sid.should.not.be.empty;
        const res = await request({
          url: `http://localhost:${PORT}/download?sid=${sid}`,
          method: 'GET',
        });
        res.should.eql('appium');
      } finally {
        await fs.rimraf(tmpFilePath);
      }
    });

    it('should be able to cleanup the stored file after it expires', async function () {
      const info = await tempDir.open();
      const tmpFilePath = info.path;
      const fileContent = Buffer.from('appium', 'utf-8');
      try {
        await fs.writeFile(tmpFilePath, fileContent);
        const sid = await storeFile(tmpFilePath);
        await B.delay(2000);
        await cleanupOutdatedEntries(1000);
        await request({
          url: `http://localhost:${PORT}/download?sid=${sid}`,
          method: 'GET',
        }).should.eventually.be.rejectedWith('404');
      } finally {
        await fs.rimraf(tmpFilePath);
      }
    });
  });
});
