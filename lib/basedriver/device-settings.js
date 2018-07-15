import _ from 'lodash';
import log from './logger';
import { DEFAULT_MATCH_THRESHOLD } from './commands/images';

const GLOBAL_DEFAULT_SETTINGS = {
  imageMatchThreshold: DEFAULT_MATCH_THRESHOLD,
};

class DeviceSettings {

  constructor (defaultSettings = {}, onSettingsUpdate = null) {
    this._settings = Object.assign({}, GLOBAL_DEFAULT_SETTINGS, defaultSettings);
    this.onSettingsUpdate = onSettingsUpdate;
  }

  // calls updateSettings from implementing driver every time a setting is changed.
  async update (newSettings) {
    if (!_.isObject(newSettings)) {
      throw new Error('Settings update should be called with valid JSON');
    }
    for (let prop of _.keys(newSettings)) {
      if (_.isUndefined(this._settings[prop])) {
        log.warn(`Didn't know about setting '${prop}'. Are you sure you ` +
                 `spelled it correctly? Proceeding anyway. Valid settings: ${_.keys(this._settings)}`);
      }
      if (this._settings[prop] !== newSettings[prop]) {
        // update setting only when there is updateSettings defined.
        if (this.onSettingsUpdate) {
          await this.onSettingsUpdate(prop, newSettings[prop], this._settings[prop]);
          this._settings[prop] = newSettings[prop];
        } else {
          log.errorAndThrow('Unable to update settings; onSettingsUpdate method not found');
        }
      }
    }
  }

  getSettings () {
    return this._settings;
  }
}

export default DeviceSettings;
