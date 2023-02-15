import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';
import axios from 'axios';

type Config = AccessoryConfig & {
    url: string;
};

export class InioAccessoryPlugin implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly config: Config;
  private switchOn = false;
  private api: API;

  private readonly lightBulb: Service;
  private readonly informationService: Service;
  private readonly modeSwitch: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config as Config;
    this.api = api;

    this.log.debug('Loading InioAccessoryPlugin');

    this.informationService = new this.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Inio')
      .setCharacteristic(this.api.hap.Characteristic.Model, 'Inio Light');

    // expose a switch to turn on/off the "connected" mode
    this.modeSwitch = new this.api.hap.Service.Switch('Inio Light Mode');

    this.modeSwitch.getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(this.handleModeGet.bind(this))
      .onSet(this.handleModeSet.bind(this));

    // expose a lightbulb with brightness
    this.lightBulb = new this.api.hap.Service.Lightbulb('Inio Light');

    this.lightBulb.getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    this.lightBulb.getCharacteristic(this.api.hap.Characteristic.Brightness)
      .onGet(this.handleBrightnesGet.bind(this))
      .onSet(this.handleBrightnesSet.bind(this));
  }

  apiUrl(suffix: string) {
    return this.config.url.replace(/\/$/, '') + suffix;
  }

  async handleModeGet(): Promise<CharacteristicValue> {
    this.log.debug('Getting current state of Inio Light switch');
    const response = await axios(this.apiUrl('/api/app/status'));
    return response.data.mode === 'CONNECTED';
  }

  async handleModeSet(value: CharacteristicValue) {
    const response = await axios(this.apiUrl('/api/app/status'));
    const mode = response.data.mode;
    try {

      if (value) {
        if (mode === 'CONNECTED') {
          return;
        }
        if (mode === 'OFF') {
          await axios(
            this.apiUrl('/api/interface/btn_short_connect'),
            {
              method: 'PUT',
            });
        }

        switch (mode) {
          case 'CONNECTED':
            return;
          case 'OFF':
            await axios(
              this.apiUrl('/api/interface/btn_short_manual'),
              {
                method: 'PUT',
              });
            // we actually want to fall through here
            // eslint-disable-next-line no-fallthrough
          case 'SCENARIO':
          case 'STATIC' :
            await axios(this.apiUrl('/api/interface/btn_short_connect'), {
              method: 'PUT',
            });
            break;
          default:
            this.log.error('Unknown mode: ' + mode);
            break;
        }
      } else {
        if (mode === 'OFF') {
          return;
        }
        await axios(
          this.apiUrl('/api/interface/btn_short_manual'),
          {
            method: 'PUT',
          });
      }
    } catch (e) {
      this.log.error(e);
    }
  }

  async handleBrightnesGet(): Promise<CharacteristicValue> {
    const response = await axios(this.apiUrl('/api/interface/slider_position'));
    return Math.floor(response.data.slider_position / 255 * 100);
  }

  async handleBrightnesSet(value: CharacteristicValue) {
    if (!await this.handleOnGet()) {
      await this.handleOnSet(true);
    }
    if (value === 0) {
      return await this.handleOnSet(false);
    }

    try {
      await axios(this.apiUrl('/api/interface/slider'), {
        method: 'POST',
        data: {
          'position': Math.floor((value as number / 100) * 255),
        },
      });
    } catch (e) {
      this.log.error(e);
    }
  }

  async handleOnGet(): Promise<CharacteristicValue> {
    this.log.debug('Getting current state of Inio Light');
    const response = await axios(this.apiUrl('/api/app/status'));
    return response.data.mode !== 'OFF';
  }

  async handleOnSet(value: CharacteristicValue) {
    try {
      const status = await this.handleOnGet();
      if (status === value) {
        return;
      }

      if (value) {
        if (status) {
          return;
        }
        await axios(
          this.apiUrl('/api/interface/btn_short_manual'),
          {
            method: 'PUT',
          });

        await axios(
          this.apiUrl('/api/interface/btn_short_connect'), {
            method: 'PUT',
          });
      } else {
        await axios(
          this.apiUrl('/api/interface/btn_short_manual'),
          {
            method: 'PUT',
          });
      }
    } catch (e) {
      this.log.error(e);
    }
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.lightBulb,
      this.modeSwitch,
    ];
  }

}