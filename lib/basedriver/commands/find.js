import log from '../logger';
import Jimp from 'jimp';
import Promise from 'bluebird';
import { errors } from '../../..';
import { Buffer } from 'buffer';
import { DEFAULT_MATCH_THRESHOLD, MATCH_TEMPLATE_MODE } from './images';
import { W3C_ELEMENT_KEY, MJSONWP_ELEMENT_KEY } from '../../protocol/protocol';
import { ImageElement } from '../image-element';


const commands = {}, helpers = {}, extensions = {};

const IMAGE_STRATEGY = "-image";

// Override the following function for your own driver, and the rest is taken
// care of!

//helpers.findElOrEls = async function (strategy, selector, mult, context) {}
// strategy: locator strategy
// selector: the actual selector for finding an element
// mult: multiple elements or just one?
// context: finding an element from the root context? or starting from another element
//
// Returns an object which adheres to the way the JSON Wire Protocol represents elements:
// { ELEMENT: # }    eg: { ELEMENT: 3 }  or { ELEMENT: 1.023 }

helpers.findElOrElsWithProcessing = async function (strategy, selector, mult, context) {
  this.validateLocatorStrategy(strategy);
  try {
    return await this.findElOrEls(strategy, selector, mult, context);
  } catch (err) {
    if (this.opts.printPageSourceOnFindFailure) {
      const src = await this.getPageSource();
      log.debug(`Error finding element${mult ? 's' : ''}: ${err.message}`);
      log.debug(`Page source requested through 'printPageSourceOnFindFailure':`);
      log.debug(src);
    }
    // still want the error to occur
    throw err;
  }
};

commands.findElement = async function (strategy, selector) {
  if (strategy === IMAGE_STRATEGY) {
    // in the singular findElement only, we can find by image, which is
    // a special case. In any other find command (including
    // findElement(s)FromElement), this doesn't make sense, so use of the
    // -image locator strategy won't pass the strategy validation filter as is
    // desired
    return await this.findByImage(selector);
  }

  return await this.findElOrElsWithProcessing(strategy, selector, false);
};

commands.findElements = async function (strategy, selector) {
  return await this.findElOrElsWithProcessing(strategy, selector, true);
};

commands.findElementFromElement = async function (strategy, selector, elementId) {
  return await this.findElOrElsWithProcessing(strategy, selector, false, elementId);
};

commands.findElementsFromElement = async function (strategy, selector, elementId) {
  return await this.findElOrElsWithProcessing(strategy, selector, true, elementId);
};

helpers.findByImage = async function (b64Template, {checkingStaleness = false} = {}) {
  let threshold = DEFAULT_MATCH_THRESHOLD;
  if (this.settings) {
    threshold = this.settings.getSettings().imageMatchThreshold;
  }
  log.info(`Finding image element with match threshold ${threshold}`);
  const {width: screenWidth, height: screenHeight} = await this.getWindowSize();

  // someone might have sent in a template that's larger than the screen
  // dimensions. If so let's check and cut it down to size since the algorithm
  // will not work unless we do
  b64Template = await this.ensureTemplateSize(b64Template, screenWidth, screenHeight);

  let rect = null;
  try {
    await this.implicitWaitForCondition(async () => {
      let b64Screenshot = await this.getScreenshotForImageFind(screenWidth, screenHeight);
      rect = (await this.compareImages(MATCH_TEMPLATE_MODE, b64Screenshot,
        b64Template, {threshold})).rect;
      return true;
    });
  } catch (err) {
    if (!err.match(/Condition unmet/)) {
      throw err;
    }
  }

  if (!rect) {
    throw new errors.NoSuchElementError(); // eslint-disable-line no-unsafe-finally
  }

  log.info(`Image template matched: ${JSON.stringify(rect)}`);
  const imgEl = new ImageElement(b64Template, rect);

  // if we're just checking staleness, return straightaway so we don't add
  // a new element to the cache
  if (checkingStaleness) {
    return imgEl;
  }

  this._imgElCache.add(imgEl);
  const protoKey = this.isW3CProtocol() ? W3C_ELEMENT_KEY : MJSONWP_ELEMENT_KEY;
  return imgEl.asElement(protoKey);
};

helpers.ensureTemplateSize = async function (b64Template, screenWidth, screenHeight) {
  let {width: tplWidth, height: tplHeight, imgObj} = await getJimpData(b64Template);

  // if the template fits inside the screen dimensions, we're good
  if (tplWidth <= screenWidth && tplHeight <= screenHeight) {
    return b64Template;
  }

  // otherwise, scale it to fit inside the screen dimensions
  imgObj = imgObj.scaleToFit(screenWidth, screenHeight);
  return (await imgObj.getBufferPromise(Jimp.MIME_PNG)).toString('base64');
};

helpers.getScreenshotForImageFind = async function (screenWidth, screenHeight) {
  let b64Screenshot = await this.getScreenshot();
  let {width: shotWidth, height: shotHeight, imgObj} = await getJimpData(b64Screenshot);

  if (screenWidth === shotWidth && screenHeight === shotHeight) {
    // the height and width of the screenshot and the device screen match, which
    // means we should be safe when doing template matches
    return b64Screenshot;
  }

  // otherwise, if they don't match, it could spell problems for the accuracy
  // of coordinates returned by the image match algorithm, since we match based
  // on the screenshot coordinates not the device coordinates themselves. There
  // are two potential types of mismatch: aspect ratio mismatch and scale
  // mismatch. we need to detect and fix both

  const screenAR = screenWidth / screenHeight;
  const shotAR = shotWidth / shotHeight;

  if (screenAR !== shotAR) {
    log.warn(`When trying to find an element, determined that the screen ` +
             `aspect ratio and screenshot aspect ratio are different. Screen ` +
             `is ${screenWidth}x${screenHeight} whereas screenshot is ` +
             `${shotWidth}x${shotHeight}. Resizing screenshot to match ` +
             `screen aspect ratio so that image element coordinates have a ` +
             `greater chance of being correct.`);
    shotWidth = shotWidth / (shotAR / screenAR);
    imgObj = imgObj.resize(shotWidth, shotHeight);
  }

  // now we know the aspect ratios match, but there might still be a scale
  // mismatch, so just resize based on the screen dimensions
  if (screenWidth !== shotWidth) {
    imgObj = imgObj.resize(screenWidth, Jimp.AUTO);
  }

  return (await imgObj.getBufferPromise(Jimp.MIME_PNG)).toString('base64');
};

function getJimpData (b64Data) {
  return new Promise((resolve, reject) => {
    new Jimp(Buffer.from(b64Data, 'base64'), (err, imgObj) => {
      if (err) {
        return reject(err);
      }
      imgObj.getBufferPromise = Promise.promisify(imgObj.getBuffer.bind(imgObj),
        {context: imgObj});
      resolve({
        width: imgObj.bitmap.width,
        height: imgObj.bitmap.height,
        imgObj
      });
    });
  });
}

Object.assign(extensions, commands, helpers);
export { commands, helpers};
export default extensions;
