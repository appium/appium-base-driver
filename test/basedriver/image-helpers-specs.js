/* eslint-disable */
import { cropBase64Image } from '../../lib/basedriver/image-helpers';
import {PNG} from 'pngjs';
import path from 'path';
import chai from 'chai';
import { fs } from 'appium-support';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

async function getImage (file) {
  const imagePath = path.resolve(__dirname, '..', '..', '..', 'test', 'basedriver', 'images', file);
  return await fs.readFile(imagePath, 'utf8');
}

describe('image-helpers', () => {
  describe('#cropBase64Image', () => {
    let originalImage64 = null;

    before(async () => {
      originalImage64 = await getImage('full-image.b64');
      const originalImage = PNG.sync.read(Buffer.from(originalImage64, 'base64'));

      // verify original image size, to be sure that original image is correct
      originalImage.width.should.be.equal(640, 'unexpected width');
      originalImage.height.should.be.equal(1136, 'unexpected height');
    });

    it('should verify that an image is cropped correctly', async () => {
      const croppedImage64 = cropBase64Image(originalImage64, {top: 107, left: 35, width: 323, height: 485});

      const croppedImage = PNG.sync.read(Buffer.from(croppedImage64, 'base64'));

      // verify cropped image size, it should be less than original image according to crop region
      croppedImage.width.should.be.equal(323, 'unexpected width');
      croppedImage.height.should.be.equal(485, 'unexpected height');

      // verify that image cropped, compare base64 representation
      const croppedImageShouldBe = await getImage('cropped-image.b64');
      croppedImage64.should.be.equal(croppedImageShouldBe);
    });
  });
});
