import { Buffer } from 'buffer';
import { PNG } from 'pngjs';
import B from 'bluebird';

async function cropBase64Image (base64EncodedImage, rect) {
  const image = await createImageFromBase64(base64EncodedImage);
  const croppedImage = cropImage(image, rect);
  return await createBase64FromImage(croppedImage);
}

async function createImageFromBase64 (base64EncodedImage) {
  const buffer = new Buffer(base64EncodedImage, 'base64');
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
  const interRect = getRectIntersection(rect, imageRect);
  if (isEmptyRect(interRect)) {
    throw new Error('rect is outside the image bounds!');
  }

  const yEnd = Math.min(interRect.top + interRect.height, imageRect.height);
  const xEnd = Math.min(interRect.left + interRect.width, imageRect.width);

  let croppedArray = [];
  for (let y = interRect.top; y < yEnd; y++) {
    for (let x = interRect.left; x < xEnd; x++) {
      const idx = (imageRect.width * y + x) << 2;
      for (let i = 0; i < 4; i++) {
        croppedArray.push(image.data[idx + i]);
      }
    }
  }

  image.data = new Buffer(croppedArray);
  image.width = xEnd - interRect.left;
  image.height = yEnd - interRect.top;
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

export default { cropBase64Image, createImageFromBase64, createImageFromBuffer, createBase64FromImage, cropImage };
