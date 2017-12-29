// transpile:main

// BaseDriver exports
import BaseDriver from './lib/basedriver/driver';
import DeviceSettings from './lib/basedriver/device-settings';
import ImageHelpers from './lib/basedriver/image-helpers';

export { BaseDriver, DeviceSettings, ImageHelpers };
export default BaseDriver;

// MJSONWP exports
import { MobileJsonWireProtocol, routeConfiguringFunction, errors, isErrorType,
         errorFromCode, ALL_COMMANDS, METHOD_MAP, routeToCommandName,
         NO_SESSION_ID_COMMANDS, isSessionCommand } from './lib/mjsonwp';

export { MobileJsonWireProtocol, routeConfiguringFunction, errors, isErrorType,
         errorFromCode, ALL_COMMANDS, METHOD_MAP, routeToCommandName,
         NO_SESSION_ID_COMMANDS, isSessionCommand };

// Express exports
import { server } from './lib/express/server';
export { server };

// jsonwp-proxy exports
import JWProxy from './lib/jsonwp-proxy/proxy';
export { JWProxy };

// jsonwp-status exports
import { codes, getSummaryByCode } from './lib/jsonwp-status/status';
const statusCodes = codes;
export { statusCodes, getSummaryByCode };

// W3C capabilities parser
import { processCapabilities } from './lib/basedriver/capabilities';
export { processCapabilities };