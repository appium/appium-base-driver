import _ from 'lodash';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import BaseDriver, { ImageElement } from '../..';
import { makeImageElementCache, getImgElFromArgs } from '../../lib/basedriver/image-element';
import { IMAGE_ELEMENT_PREFIX } from '../../lib/protocol/protocol';
import sinon from 'sinon';


chai.should();
chai.use(chaiAsPromised);


const defRect = {x: 100, y: 110, width: 50, height: 25};
const defTemplate = 'iVBORasdf';

describe('ImageElement', function () {
  const driver = new BaseDriver();

  describe('.size', function () {
    it('should return the width and height of the image el', function () {
      const el = new ImageElement(defTemplate, defRect);
      el.size.should.eql({width: defRect.width, height: defRect.height});
    });
  });

  describe('.location', function () {
    it('should return the location of the image el', function () {
      const el = new ImageElement(defTemplate, defRect);
      el.location.should.eql({x: defRect.x, y: defRect.y});
    });
  });

  describe('.center', function () {
    it('should return the center location of the image el', function () {
      const el = new ImageElement(defTemplate, defRect);
      el.center.should.eql({
        x: defRect.x + defRect.width / 2,
        y: defRect.y + defRect.height / 2
      });
    });
  });

  describe('.asElement', function () {
    it('should get the webdriver object representation of the element', function () {
      const el = new ImageElement(defTemplate, defRect);
      el.asElement("ELEMENT").ELEMENT.should.match(/^appium-image-el/);
    });
  });

  describe('.equals', function () {
    it('should say two image elements with same rect are equal', function () {
      const el1 = new ImageElement('foo', defRect);
      const el2 = new ImageElement('bar', defRect);
      el1.equals(el2).should.be.true;
      el2.equals(el1).should.be.true;
    });
    it('should say two image elements with different rect are not equal', function () {
      const el1 = new ImageElement(defTemplate, {...defRect, x: 0});
      const el2 = new ImageElement(defTemplate, defRect);
      el1.equals(el2).should.be.false;
      el2.equals(el1).should.be.false;
    });
  });

  // TODO write .click tests

  describe('#execute', function () {
    const imgEl = new ImageElement(defTemplate, defRect);
    const clickStub = sinon.stub(imgEl, 'click');

    before(function () {
      driver._imgElCache.set(imgEl.id, imgEl);
      clickStub.returns(true);
    });

    after(function () {
      driver._imgElCache.reset();
      clickStub.restore();
    });

    it('should reject executions on elements not in the cache', async function () {
      await ImageElement.execute(driver, 'click', 'appium-image-element-foo')
        .should.eventually.be.rejectedWith(/element could not be located/);
    });
    it('should reject executions for unsupported commands', async function () {
      await ImageElement.execute(driver, 'foobar', imgEl.id)
        .should.eventually.be.rejectedWith(/not yet been implemented/);
    });
    it('should get displayed status of element', async function () {
      await ImageElement.execute(driver, 'elementDisplayed', imgEl.id)
        .should.eventually.be.true;
    });
    it('should get size of element', async function () {
      await ImageElement.execute(driver, 'getSize', imgEl.id)
        .should.eventually.eql({width: defRect.width, height: defRect.height});
    });
    it('should get location of element', async function () {
      await ImageElement.execute(driver, 'getLocation', imgEl.id)
        .should.eventually.eql({x: defRect.x, y: defRect.y});
    });
    it('should get location in view of element', async function () {
      await ImageElement.execute(driver, 'getLocation', imgEl.id)
        .should.eventually.eql({x: defRect.x, y: defRect.y});
    });
    it('should get rect of element', async function () {
      await ImageElement.execute(driver, 'getElementRect', imgEl.id)
        .should.eventually.eql(defRect);
    });
    it('should click element', async function () {
      await ImageElement.execute(driver, 'click', imgEl.id)
        .should.eventually.be.true;
    });
  });
});

describe('image element LRU cache', function () {
  it('should accept and cache image elements', function () {
    const el1 = new ImageElement(defTemplate, defRect);
    const el2 = new ImageElement(defTemplate, defRect);
    const cache = makeImageElementCache();
    cache.set(el1.id, el1);
    el1.equals(cache.get(el1.id)).should.be.true;
    _.isUndefined(cache.get(el2.id)).should.be.true;
    cache.has(el1.id).should.be.true;
    cache.has(el2.id).should.be.false;
  });
  it('once cache reaches max size, should eject image elements', function () {
    const el1 = new ImageElement(defTemplate, defRect);
    const el2 = new ImageElement(defTemplate, defRect);
    const cache = makeImageElementCache(defTemplate.length + 1);
    cache.set(el1.id, el1);
    cache.has(el1.id).should.be.true;
    cache.set(el2.id, el2);
    cache.has(el2.id).should.be.true;
    cache.has(el1.id).should.be.false;
  });
});

describe('getImgElFromArgs', function () {
  it('should return the image element id from json obj in args', function () {
    const imgEl = `${IMAGE_ELEMENT_PREFIX}foo`;
    const args = [1, 'foo', imgEl];
    getImgElFromArgs(args).should.eql(imgEl);
  });
  it('should not return anything if image element id not in args', function () {
    const args = [1, 'foo'];
    _.isUndefined(getImgElFromArgs(args)).should.be.true;
  });
  it('should not find image element id in anything but prefix', function () {
    const notImgEl = `foo${IMAGE_ELEMENT_PREFIX}`;
    const args = [1, 'foo', notImgEl];
    _.isUndefined(getImgElFromArgs(args)).should.be.true;
  });
});
