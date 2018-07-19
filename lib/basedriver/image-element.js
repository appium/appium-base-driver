import _ from 'lodash';
import { errors } from '../..';
import { IMAGE_ELEMENT_PREFIX } from '../protocol/protocol';
import log from './logger';
import UUID from 'uuid-js';

const MAX_CACHE_SIZE = 1024 * 1024 * 40; // 40mb

/**
 * @typedef {Object} Rect
 * @property {int} x - x-coordinate of top-left corner
 * @property {int} y - y-coordinate of top-left corner
 * @property {int} width - width of rect
 * @property {int} height - height of rect
 */

/**
 * @typedef {Object} Dimension
 * @property {int} width - width of rect
 * @property {int} height - height of rect
 */

/**
 * @typedef {Object} Position
 * @property {int} x - x coordinate
 * @property {int} y - y coordinate
 */

/**
 * Representation of an "image element", which is simply a set of coordinates
 * and methods that can be used on that set of coordinates via the driver
 */
class ImageElement {

  /**
   * @param {string} b64Template - the base64-encoded image which was used to
   * find this ImageElement
   * @param {Rect} rect - bounds of matched image element
   *
   * @returns {ImageElement}
   */
  constructor (b64Template, rect) {
    this.template = b64Template;
    this.rect = rect;
    this.id = `${IMAGE_ELEMENT_PREFIX}${UUID.create().hex}`;
  }

  /**
   * @returns {Dimension} - dimension of element
   */
  get size () {
    return {width: this.rect.width, height: this.rect.height};
  }

  /**
   * @returns {Position} - coordinates of top-left corner of element
   */
  get location () {
    return {x: this.rect.x, y: this.rect.y};
  }

  /**
   * @returns {Position} - coordinates of center of element
   */
  get center () {
    return {
      x: this.rect.x + this.rect.width / 2,
      y: this.rect.y + this.rect.height / 2,
    };
  }

  /**
   * @param {string} protocolKey - the protocol-specific JSON key for
   * a WebElement
   *
   * @returns {WebElement} - this image element as a WebElement
   */
  asElement (protocolKey) {
    return {[protocolKey]: this.id};
  }

  /**
   * @param {ImageElement} other - an ImageElement to compare with this one
   *
   * @returns {boolean} - whether the other element and this one have the same
   * properties
   */
  equals (other) {
    return this.rect.x === other.rect.x &&
           this.rect.y === other.rect.y &&
           this.rect.width === other.rect.width &&
           this.rect.height === other.rect.height;
  }

  /**
   * Use a driver to tap the screen at the center of this ImageElement's
   * position
   *
   * @param {BaseDriver} driver - driver for calling actions with
   */
  async click (driver) {
    // before we click we need to make sure the element is actually still there
    // where we expect it to be
    let newImgEl;
    const {
      autoUpdateImageElementPosition: updatePos,
      checkForImageElementStaleness,
      imageElementTapStrategy,
    } = driver.settings.getSettings();

    if (checkForImageElementStaleness || updatePos) {
      log.info('Checking image element for staleness before clicking');
      try {
        newImgEl = await driver.findByImage(this.template, {
          shouldCheckStaleness: true
        });
      } catch (err) {
        throw new errors.StaleElementReferenceError();
      }

      if (!this.equals(newImgEl)) {
        log.warn(`When trying to click on an image element, the image changed ` +
                 `position from where it was originally found. It is now at ` +
                 `${JSON.stringify(newImgEl.rect)} and was originally at ` +
                 `${JSON.stringify(this.rect)}.`);
        if (updatePos) {
          log.warn('Click will proceed at new coordinates');
          this.rect = _.clone(newImgEl.rect);
        } else {
          log.warn("Click will take place at original coordinates. If you " +
                   "would like Appium to automatically click the new " +
                   "coordinates, set the 'autoUpdateImageElementPosition' " +
                   "setting to true");
        }
      }
    }

    const {x, y} = this.center;
    log.info(`Will tap on image element at coordinate [${x}, ${y}]`);

    if (imageElementTapStrategy === 'w3c') {
      // set up a W3C action to click on the image by position
      log.info('Will tap using W3C actions');
      const action = {
        type: 'pointer',
        id: 'mouse',
        parameters: {pointerType: 'touch'},
        actions: [
          {type: 'pointerMove', x, y},
          {type: 'pointerDown'},
          {type: 'pause', duration: 500},
          {type: 'pointerUp'},
        ]
      };
      return await driver.performActions([action]);
    }

    // if the w3c strategy was explicitly not requested, do the only other
    // option (mjsonwp touch actions)
    log.info('Will tap using MJSONWP TouchActions');
    const action = {
      action: 'tap',
      options: {x, y}
    };
    return await driver.performTouch([action]);
  }

  /**
   * Handle various Appium commands that involve an image element
   *
   * @param {BaseDriver} driver - the driver to use for commands
   * @param {string} cmd - the name of the driver command
   * @param {string} imgElId - the id of the ImageElement to work with
   *
   * @returns {Object} - the result of running a command
   */
  static async execute (driver, cmd, imgElId) {
    if (!driver._imgElCache.has(imgElId)) {
      throw new errors.NoSuchElementError();
    }

    const imgEl = driver._imgElCache.get(imgElId);

    switch (cmd) {
      case 'click':
        return await imgEl.click(driver);
      case 'elementDisplayed':
        return true;
      case 'getSize':
        return imgEl.size;
      case 'getLocation':
      case 'getLocationInView':
        return imgEl.location;
      case 'getElementRect':
        return imgEl.rect;
      default: throw new errors.NotYetImplementedError();
    }
  }
}

class ImageElementCache {

  constructor () {
    this.cache = {};
    this.cacheSize = 0;
    this.hotness = [];
  }

  add (imageEl) {
    this.cache[imageEl.id] = imageEl;
    this.cacheSize += imageEl.template.length;

    // if we add an element, put its id at the front of hotness
    this.hotness = [imageEl.id, ...this.hotness];

    // if this causes our cache to go beyond max size, eject the least hot
    // element
    while (this.cacheSize > MAX_CACHE_SIZE) {
      log.warn(`Image Element cache size too large; ejecting an old element ` +
               `from the cache!`);
      this.ejectLeastAccessedElement();
    }
  }

  remove (id) {
    if (!this.cache[id]) {
      throw new Error(`Image Element ${id} not found in cache`);
    }

    this.cacheSize -= this.cache[id].template.length;
    delete this.cache[id];
    this.hotness = this.hotness.filter(imgId => imgId !== id);
  }

  get (id) {
    if (!this.cache[id]) {
      throw new Error(`Image Element ${id} not found in cache`);
    }

    // if we access an element, put its id at the front of hotness
    this.hotness = [id, this.hotness.filter(elId => elId !== id)];

    return this.cache[id];
  }

  has (id) {
    return !!this.cache[id];
  }

  ejectLeastAccessedElement () {
    if (this.hotness.length < 1) {
      throw new Error("No elements to eject");
    }
    let id = this.hotness[this.hotness.length - 1];
    this.remove(id);
  }
}

function getImgElFromArgs (args) {
  for (let arg of args) {
    if (_.isString(arg) && arg.startsWith(IMAGE_ELEMENT_PREFIX)) {
      return arg;
    }
  }
}

export { ImageElement, ImageElementCache, getImgElFromArgs };
