// transpile:mocha

import BaseDriver from '../..';
import baseDriverE2ETests from './driver-e2e-tests';
baseDriverE2ETests(BaseDriver, {
  platformName: 'iOS',
  deviceName: 'Delorean',
  caps: {
    pixelRatio: 2.0,
    statBarHeight: 20,
    viewportRect: {
      left: 0,
      top: 20,
      width: 320,
      height: 480
    }
  }
});
