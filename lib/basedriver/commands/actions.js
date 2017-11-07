import _ from 'lodash';
import log from '../logger';
import { errors } from '../../mjsonwp/errors';


let commands = {}, helpers = {}, extensions = {};

/**
 * If w3c performActions was called, attempt to translate it to JSONWP actions, if possible.
 */
commands.performActions = async function (actions) {
  let multiActions;
  log.debug(`Attempting to translate W3C actions to JSONWP actions`);
  multiActions = helpers.translateActions(actions);

  // If multiAction isn't  implemented, throw not implemented error
  if (!this.performMultiAction) {
    throw new errors.NotYetImplementedError(`Could not translate W3C actions ${JSON.stringify(actions)} to JSONWP actions. 'performMultiAction' command not yet implemented`);
  }

  log.debug(`Translated ${JSON.stringify(actions)} to ${JSON.stringify(multiActions)}`);
  log.debug(`Calling 'performMultiAction' with translated actions`);
  return await this.performMultiAction(multiActions);
};

const ACTION_TYPES = {
  'pointer': 'pointer',
  'key': 'key',
  'none': 'none',
};

const POINTER_TYPES = {
  'mouse': 'mouse',
  'pen': 'pen',
  'touch': 'touch',
};

const POINTER_ACTION_TYPES = {
  PAUSE: 'pause',
  UP: 'pointerup',
  DOWN: 'pointerdown',
  MOVE: 'pointermove',
  CANCEL: 'pointercancel',
};

const JSONWP_POINTER_TYPES = {
  MOVE_TO: 'moveTo',
  WAIT: 'wait',
  RELEASE: 'release',
  PRESS: 'press',
  CANCEL: 'cancel',
};

/**
 * Iterate through actions and then determine the corresponding function and params that need to be
 * called for that action.
 *
 * https://github.com/jlipps/simple-wd-spec#perform-actions
 *
 */
helpers.translateActions = function (actionsArr) {
  let multiActions = [];
  let errMsg = 'Could not translate W3C actions to JSONWP actions';
  for (let touchAction of actionsArr) {
    const {type, parameters, actions} = touchAction;

    // Validate the type of interaction
    if (!ACTION_TYPES[type]) {
      throw new errors.BadParametersError(`${errMsg}: ${type} is not a valid type`);
    } else if (type !== ACTION_TYPES.pointer) {
      throw new errors.BadParametersError(`${errMsg}: ${type} actions are not supported by this driver`);
    }

    // Validate that the TOUCH pointer type was provided. Only touches can be translated to JSONWP,
    // other action types need to be implemented by the driver
    if (parameters && parameters.pointerType) {
      const pointerType = parameters.pointerType.toLowerCase();
      if (!POINTER_TYPES[pointerType]) {
        throw new errors.BadParametersError(`${errMsg}: ${parameters.pointerType} is not a valid pointerType`);
      } else if (pointerType !== POINTER_TYPES.TOUCH) {
        throw new errors.BadParametersError(`${errMsg}: ${parameters.pointerType} is not supported by this driver`);
      }
    }

    let touchActions = [];
    for (let action of actions) {
      let options;
      switch (action.type.toLowerCase()) {
        case POINTER_ACTION_TYPES.MOVE:
          options = _.omitBy({x: action.x, y: action.y, duration: action.duration, origin: action.origin}, _.isUndefined);
          touchActions.push({action: JSONWP_POINTER_TYPES.MOVE_TO, options: _.omit(options, _.isUndefined)});
          break;
        case POINTER_ACTION_TYPES.PAUSE:
          options = _.omitBy({duration: action.duration}, _.isUndefined);
          touchActions.push({action: JSONWP_POINTER_TYPES.WAIT, options});
          break;
        case POINTER_ACTION_TYPES.UP:
          touchActions.push({action: JSONWP_POINTER_TYPES.RELEASE});
          break;
        case POINTER_ACTION_TYPES.DOWN:
          touchActions.push({action: JSONWP_POINTER_TYPES.PRESS});
          break;
        case POINTER_ACTION_TYPES.CANCEL:
          touchActions.push({action: JSONWP_POINTER_TYPES.CANCEL});
          break;
        default:
          throw new errors.BadParametersError(`${errMsg}: ${action.type} is not a valid action type`);
      }
    }
    multiActions.push(touchActions);
  }
  return multiActions;
};

Object.assign(extensions, commands, helpers);
export { commands, helpers};
export default extensions;
