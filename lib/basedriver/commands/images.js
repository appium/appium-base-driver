import _ from 'lodash';
import { errors } from '../../protocol/errors';
import { imageUtil } from 'appium-support';

const commands = {}, helpers = {}, extensions = {};

const MATCH_FEATURES_MODE = 'matchFeatures';
const GET_SIMILARITY_MODE = 'getSimilarity';
const MATCH_TEMPLATE_MODE = 'matchTemplate';

commands.compareImages = async function (mode, firstImage, secondImage, options = {}) {
  const img1 = Buffer.from(firstImage, 'base64');
  const img2 = Buffer.from(secondImage, 'base64');
  switch (_.toLower(mode)) {
    case MATCH_FEATURES_MODE.toLowerCase():
      return await imageUtil.getImagesMatches(img1, img2, options);
    case GET_SIMILARITY_MODE.toLowerCase():
      return await imageUtil.getImagesSimilarity(img1, img2, options);
    case MATCH_TEMPLATE_MODE.toLowerCase():
      return await imageUtil.getImageOccurrence(img1, img2, options);
    default:
      throw new errors.InvalidArgumentError(`'${mode}' images comparison mode is unknown. ` +
                                            `Only ${JSON.stringify([MATCH_FEATURES_MODE, GET_SIMILARITY_MODE, MATCH_TEMPLATE_MODE])} modes are supported.`);
  }
};

Object.assign(extensions, commands, helpers);
export { commands, helpers};
export default extensions;
