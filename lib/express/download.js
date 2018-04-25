import _ from 'lodash';
import _fs from 'fs';
import { fs, mkdirp } from 'appium-support';
import crypto from 'crypto';
import log from './logger';
import path from 'path';
import schedule from 'node-schedule';
import send from 'send';
import url from 'url';

const DOWNLOAD_DIR = _.isNull(path.resolve(__dirname).match(/build[\/\\]lib[\/\\]express$/))
  ? path.resolve(__dirname, '..', '..', 'download')
  : path.resolve(__dirname, '..', '..', '..', 'download');
// each entry times out after 24 hours
const STORAGE_TIMEOUT = 1000 * 60 * 60 * 24;
const ENTITY_SEPARATOR = '_';

const rule = new schedule.RecurrenceRule();
rule.minute = Math.floor(Math.random() * 60);
schedule.scheduleJob(rule, cleanupOutdatedEntries);

/**
 * This method is executed every hour and deletes all the outdated entries
 * in the downloads folder
 *
 * @param {?number} timeout [STORAGE_TIMEOUT] - The maximum number of milliseconds
 * between the file created timestamp and the current timestamp. If this difference
 * is greater than `timeout` then the entry will be deleted from `DOWNLOAD_DIR`
 */
async function cleanupOutdatedEntries (timeout = STORAGE_TIMEOUT) {
  if (!await fs.exists(DOWNLOAD_DIR)) {
    return;
  }

  const matchedDirs = await fs.glob(path.resolve(DOWNLOAD_DIR, toEntityName('*', '*')));
  if (_.isEmpty(matchedDirs)) {
    return;
  }

  const now = new Date().getTime();
  for (const matchedDir of matchedDirs) {
    const {timestamp} = parseEntityName(path.basename(matchedDir));
    if (_.isEmpty(timestamp) || now - timestamp >= timeout) {
      await fs.rimraf(matchedDir);
    }
  }
}

/**
 * Generates entity name from the given sid/time stamp values
 *
 * @param {string} sid - The entry hash value
 * @param {string|number} timestamp - The entry creation time stamp
 * @returns {string} The generated entry name
 */
function toEntityName (sid, timestamp) {
  return `${sid}${ENTITY_SEPARATOR}${timestamp}`;
}

/**
 * @typedef {Object} EntityInfo
 * @property {?string} sid - The hash value of the entry
 * @property {?number} timestamp - The entry creation timestamp
 */

/**
 * Parses the given netry name
 *
 * @param {string} name - The entry name string
 * @return {EntityInfo} An empty object is returned if no values can be parsed
 */
function parseEntityName (name) {
  if (!name.includes(ENTITY_SEPARATOR)) {
    return {};
  }
  const [sid, timestampStr] = name.split(ENTITY_SEPARATOR);
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return {sid};
  }
  return {sid, timestamp};
}

/**
 * Stores a file from the local file system into the temporary
 * downloads folder. The file is connected to a unique hash (Secure IDentifier),
 * which is returned as the function result and can be used later
 * to download the file from the server. The file is accessible for
 * download within next 24 hours.
 *
 * @param {string} fullPath - Full path to the file
 * @returns {string} The generated hash string
 */
async function storeFile (fullPath) {
  if (!await fs.exists(fullPath)) {
    throw new Error(`The file at '${fullPath}' does not exist or is not accessible`);
  }
  if (!await fs.exists(DOWNLOAD_DIR)) {
    await mkdirp(DOWNLOAD_DIR);
  }

  const fileName = path.basename(fullPath);
  const sid = crypto.createHash('sha256').digest('hex');
  const timestamp = new Date().getTime();
  const dirName = toEntityName(sid, timestamp);
  await mkdirp(path.resolve(DOWNLOAD_DIR, dirName));
  const storedFilePath = path.resolve(DOWNLOAD_DIR, dirName, fileName);
  _fs.createReadStream(fullPath).pipe(_fs.createWriteStream(storedFilePath));

  return sid;
}

/**
 * Matches the path to stored file with the given SID
 *
 * @param {string} sid The hash value
 * @returns {?string} The relative path to the found file inside
 * `DOWNLOAD_DIR` or `null` if no match has been found.
 */
async function sidToRelativeFilePath (sid) {
  if (_.isEmpty(sid)) {
    return null;
  }
  const matchedDirs = await fs.glob(path.resolve(DOWNLOAD_DIR, toEntityName(sid, '*')));
  if (_.isEmpty(matchedDirs)) {
    log.info(`There are no entities found for SID '${sid}'`);
    return null;
  }
  const matchedFiles = await fs.readdir(_.head(matchedDirs));
  if (_.isEmpty(matchedFiles)) {
    log.info(`There are no matching files found for SID entity '${sid}'`);
    return null;
  }
  return `${path.basename(_.head(matchedDirs))}/${_.head(matchedFiles)}`;
}

/**
 * File download handler for the express server
 *
 * @param {http.ClientRequest} req The client request
 * @param {http.ServerResponse} res The server response
 */
async function downloadFile (req, res) {
  const {sid} = url.parse(req.url, true).query;
  log.info(`Parsed SID '${sid}' from ${req.url}`);
  const relativePath = await sidToRelativeFilePath(sid);
  if (!relativePath) {
    return res.status(404).send('Not found');
  }
  send(req, relativePath, { root: DOWNLOAD_DIR })
    .pipe(res);
}

export { downloadFile, storeFile, cleanupOutdatedEntries };
