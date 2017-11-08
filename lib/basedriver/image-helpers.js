import { Buffer } from 'buffer';
import { PNG } from 'pngjs';
import B from 'bluebird';

/**
 * Crop the image by given rectangle (use base64 string as input and output)
 *
 * @param {string} base64Image The string with base64 encoded image
 * @param {{left: number, top: number, width: number, height: number}} rect The selected region of image
 * @return {string} base64 encoded string of cropped image
 */
async function cropBase64Image (base64Image, rect) {
  const image = await base64ToImage(base64Image);
  const croppedImage = cropImage(image, rect);
  return await imageToBase64(croppedImage);
}

/**
 * Create a pngjs image from given base64 image
 *
 * @param {string} base64Image The string with base64 encoded image
 * @return {PNG} The image object
 */
async function base64ToImage (base64Image) {
  const imageBuffer = new Buffer(base64Image, 'base64');
  return new B((resolve, reject) => {
    const image = new PNG({filterType: 4});
    image.parse(imageBuffer, (err, image) => { // eslint-disable-line promise/prefer-await-to-callbacks
      if (err) { return reject(err); }
      resolve(image);
    });
  });
}

/**
 * Create a base64 string for given image object
 *
 * @param {PNG} image The image object
 * @return {string} The string with base64 encoded image
 */
async function imageToBase64 (image) {
  return new B((resolve, reject) => {
    const chunks = [];
    image.pack().on('data', (chunk) => chunks.push(chunk)).on('end', () => {
      resolve(Buffer.concat(chunks).toString('base64'));
    }).on('error', (err) => { // eslint-disable-line promise/prefer-await-to-callbacks
      reject(err);
    });
  });
}

/**
 * Crop the image by given rectangle
 *
 * @param {PNG} image The image to crop
 * @param {{left: number, top: number, width: number, height: number}} rect The selected region of image
 * @return {PNG} Cropped image
 */
function cropImage (image, rect) {
  const imageRect = {width: image.width, height: image.height};
  const interRect = getRectIntersection(rect, imageRect);
  if (isEmptyRect(interRect)) {
    throw new Error('rect is outside the image bounds!');
  }

  const firstVerticalPixel = interRect.top;
  const lastVerticalPixel = interRect.top + interRect.height;

  const firstHorizontalPixel = interRect.left;
  const lastHorizontalPixel = interRect.left + interRect.width;

  const croppedArray = [];
  for (let y = firstVerticalPixel; y < lastVerticalPixel; y++) { // loop over vertical pixels
    for (let x = firstHorizontalPixel; x < lastHorizontalPixel; x++) { // loop over horizontal pixels
      const idx = (imageRect.width * y + x) << 2; // first byte location of current pixel's block
      for (let i = 0; i < 4; i++) { // each pixel's block consists of 4 bytes
        croppedArray.push(image.data[idx + i]); // copy byte to destination image
      }
    }
  }

  image.data = new Buffer(croppedArray);
  image.width = interRect.width;
  image.height = interRect.height;
  return image;
}

function getRectIntersection (rect, imageSize) {
  const left = rect.left >= imageSize.width ? imageSize.width : rect.left;
  const top = rect.top >= imageSize.height ? imageSize.height : rect.top;
  const width = imageSize.width >= (left + rect.width) ? rect.width : 0;
  const height = imageSize.height >= (top + rect.height) ? rect.height : 0;
  return { left, top, width, height };
}

function isEmptyRect (rect) {
  return rect.width <= 0 || rect.height <= 0;
}

export default { base64ToImage, imageToBase64, cropImage, cropBase64Image };
