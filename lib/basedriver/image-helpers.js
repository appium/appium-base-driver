import { Buffer } from 'buffer';
import { PNG } from 'pngjs';
import B from 'bluebird';

async function cropBase64Image (base64EncodedImage, rect) {
  const image = await createImageFromBase64(base64EncodedImage);
  const croppedImage = cropImage(image, rect);
  return await createBase64FromImage(croppedImage);
}

async function createImageFromBase64 (base64EncodedImage) {
  const buffer = Buffer.from(base64EncodedImage, 'base64');
  return await createImageFromBuffer(buffer);
}

async function createImageFromBuffer (imageBuffer) {
  return new B((resolve, reject) => {
    const image = new PNG({filterType: 4});
    image.parse(imageBuffer, (err, image) => { // eslint-disable-line promise/prefer-await-to-callbacks
      if (err) { return reject(err); }
      resolve(image);
    });
  });
}

async function createBase64FromImage (image) {
  return new B((resolve, reject) => {
    const chunks = [];
    image.pack().on('data', (chunk) => chunks.push(chunk)).on('end', () => {
      resolve(Buffer.concat(chunks).toString('base64'));
    }).on('error', (err) => { // eslint-disable-line promise/prefer-await-to-callbacks
      reject(err);
    });
  });
}

function cropImage (image, rect) {
  const imageRect = {width: image.width, height: image.height};
  const intersectionRect = getRectIntersection(rect, imageRect);
  if (!isValidRect(intersectionRect)) {
    throw new Error('rect is outside the image bounds!');
  }

  const yEnd = Math.min(rect.top + rect.height, image.height);
  const xEnd = Math.min(rect.left + rect.width, image.width);

  let croppedArray = [];
  for (let y = rect.top; y < yEnd; y++) {
    for (let x = rect.left; x < xEnd; x++) {
      const idx = (image.width * y + x) << 2;
      for (let i = 0; i < 4; i++) {
        croppedArray.push(image.data[idx + i]);
      }
    }
  }

  image.data = new Buffer(croppedArray);
  image.width = xEnd - rect.left;
  image.height = yEnd - rect.top;
  return image;
}

function getRectIntersection (rect, imageSize) {
  const left = rect.left >= imageSize.width ? imageSize.width : rect.left;
  const top = rect.top >= imageSize.height ? imageSize.height : rect.top;
  const width = imageSize.width >= (left + rect.width) ? rect.width : 0;
  const height = imageSize.height >= (top + rect.height) ? rect.height : 0;
  return { left, top, width, height };
}

function isValidRect (rect) {
  return rect.width > 0 && rect.height > 0;
}

export default { cropBase64Image, createImageFromBase64, createImageFromBuffer, createBase64FromImage, cropImage };
