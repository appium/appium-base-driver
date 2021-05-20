import sessionCmds from './session';
import settingsCmds from './settings';
import timeoutCmds from './timeout';
import logCmds from './log';
import executeCmds from './execute';
import eventCmds from './event';


let commands = {};

Object.assign(
  commands,
  sessionCmds,
  settingsCmds,
  timeoutCmds,
  logCmds,
  executeCmds,
  eventCmds,
  // add other command types here
);

export default commands;
