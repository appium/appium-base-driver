import sessionCmds from './session';
import settingsCmds from './settings';
import timeoutCmds from './timeout';
import findCmds from './find';
import actionsCmds from './actions';

let commands = {};
Object.assign(
  commands,
  sessionCmds,
  settingsCmds,
  timeoutCmds,
  findCmds,
  actionsCmds,

  // add other command types here
);

export default commands;
