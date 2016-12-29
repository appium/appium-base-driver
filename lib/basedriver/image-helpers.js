import {PNG} from 'pngjs';

function cropBase64Image (base64EncodedImage, rect) {
  let pngImage = PNG.sync.read(Buffer.from(base64EncodedImage, 'base64'));

  if (rect.top < 0 || rect.top >= pngImage.height || rect.left < 0 || rect.left >= pngImage.width) {
    throw new Error('rect is outside the image bounds!');
  }

  const yStart = rect.top,
        yEnd = Math.min(rect.top + rect.height, pngImage.height),
        xStart = rect.left,
        xEnd = Math.min(rect.left + rect.width, pngImage.width);

  let y, x, idx, i, croppedArray = [];
  for (y = yStart; y < yEnd; y++) {
    for (x = xStart; x < xEnd; x++) {
      idx = (pngImage.width * y + x) << 2;
      for (i = 0; i < 4; i++) {
        croppedArray.push(pngImage.data[idx + i]);
      }
    }
  }

  pngImage.data = new Buffer(croppedArray);
  pngImage.width = xEnd - xStart;
  pngImage.height = yEnd - yStart;

  return PNG.sync.write(pngImage).toString('base64');
}

export default {cropBase64Image};