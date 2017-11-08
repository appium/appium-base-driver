/* eslint-disable */
import { base64ToImage, imageToBase64, cropImage } from '../../lib/basedriver/image-helpers';
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
    let originalImage = null;

    before(async () => {
      const originalImage64 = await getImage('full-image.b64');
      originalImage = await base64ToImage(originalImage64);

      // verify original image size, to be sure that original image is correct
      originalImage.width.should.be.equal(640, 'unexpected width');
      originalImage.height.should.be.equal(1136, 'unexpected height');
    });

    it('should verify that an image is cropped correctly', async () => {
      const croppedImage = await cropImage(originalImage, {left: 35, top: 107, width: 323, height: 485});

      // verify cropped image size, it should be less than original image according to crop region
      croppedImage.width.should.be.equal(323, 'unexpected width');
      croppedImage.height.should.be.equal(485, 'unexpected height');

      // verify that image cropped, compare base64 representation
      const croppedImageShouldBe = await getImage('cropped-image.b64');
      const croppedImage64 = await imageToBase64(croppedImage);
      croppedImage64.should.be.equal(croppedImageShouldBe);
    });
  });
});
