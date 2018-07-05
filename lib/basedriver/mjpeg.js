import _ from 'lodash';
import request from 'request';
import log from './logger';
import B from 'bluebird';
import MJpegConsumer from 'mjpeg-consumer';
import { Writable } from 'stream';

// amount of time to wait for the first image in the stream
const MJPEG_SERVER_TIMEOUT_MS = 10000;

/** Class which stores the last bit of data streamed into it */
export default class MJpegStream extends Writable {

  /**
   * Create an MJpegStream
   * @param {string} mJpegUrl - URL of MJPEG-over-HTTP stream
   * @param {function} [errorHandler=noop] - additional function that will be
   * called in the case of any errors.
   * @param {object} [options={}] - Options to pass to the Writable constructor
   */
  constructor (mJpegUrl, errorHandler = _.noop, options = {}) {
    super(options);
    this.errorHandler = errorHandler;
    this.url = mJpegUrl;
    this.clear();
  }

  /**
   * Get the base64-encoded version of the JPEG
   * @returns {string}
   */
  get lastChunkBase64 () {
    return _.isBuffer(this.lastChunk) ?
      this.lastChunk.toString('base64') :
      null;
  }

  /**
   * Reset internal state
   */
  clear () {
    this.registerStartSuccess = null;
    this.registerStartFailure = null;
    this.request = null;
    this.consumer = null;
    this.lastChunk = null;
    this.updateCount = 0;
  }

  /**
   * Start reading the MJpeg stream and storing the last image
   */
  async start (serverTimeout = MJPEG_SERVER_TIMEOUT_MS) {
    this.consumer = new MJpegConsumer();

    // use the deferred pattern so we can wait for the start of the stream
    // based on what comes in from an external pipe
    let startPromise = new B((res, rej) => {
      this.registerStartSuccess = res;
      this.registerStartFailure = rej;
    })
    // start a timeout so that if the server does not return data, we don't
    // block forever.
      .timeout(serverTimeout,
        `Waited ${serverTimeout}ms but the MJPEG server never sent any images`);

    const onErr = (err) => {
      log.error(`Error getting MJpeg screenshot chunk: ${err}`);
      this.errorHandler(err);
      if (this.registerStartFailure) {
        this.registerStartFailure(err);
      }
    };

    this.request = request(this.url);

    this.request
      .on('error', onErr)   // ensure we do something with errors
      .pipe(this.consumer)  // allow chunking and transforming of jpeg data
      .pipe(this);          // send the actual jpegs to ourself

    await startPromise;
  }

  /**
   * Stop reading the MJpeg stream. Ensure we disconnect all the pipes and stop
   * the HTTP request itself. Then reset the state.
   */
  stop () {
    if (!this.consumer) {
      return;
    }

    this.consumer.unpipe();
    this.request.end();
    this.clear();
  }

  /**
   * Override the Writable write() method in order to save the last image and
   * log the number of images we have received
   * @override
   * @param {Buffer} data - binary data streamed from the MJpeg consumer
   */
  write (data) {
    this.lastChunk = data;
    this.updateCount++;

    if (this.registerStartSuccess) {
      this.registerStartSuccess();
      this.registerStartSuccess = null;
    }
  }
}
