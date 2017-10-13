let commands = {};

commands.updateSettings = async function (newSettings) {
  if (!this.settings) {
    this.log.errorAndThrow('Cannot update settings; settings object not found');
  }
  return this.settings.update(newSettings);
};

commands.getSettings = async function () {
  if (!this.settings) {
    this.log.errorAndThrow('Cannot get settings; settings object not found');
  }
  return this.settings.getSettings();
};

export default commands;
