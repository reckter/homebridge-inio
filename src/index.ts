import type { API } from 'homebridge';

import { ACESSORY_NAME } from './settings';
import {InioAccessoryPlugin} from './accessory';

/**
 * This method registers the platform with Homebridge
 */
export default (api: API) => {
  api.registerAccessory(ACESSORY_NAME, InioAccessoryPlugin);
};
