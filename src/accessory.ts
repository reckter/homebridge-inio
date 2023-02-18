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

type LampPowers = {
    cold: number;
    warm: number;
};

type LampTemperature = {
    brightness: number;
    kelvin: number;
};

type EstimationItem = {
    power: LampPowers;
    temperature: LampTemperature;
};

type Mode = 'OFF' | 'CONNECTED' | 'STATIC';
type Addon = 'NONE' | 'BOOST' | 'RELAX' | 'SCENARIO';

type Status = {
    mode: Mode;
    addon: Addon;
};

import packedArray from './data-packed.json';

const estimationMap: Array<EstimationItem> = packedArray.map((it) => ({
  temperature: {
    brightness: it[0],
    kelvin: it[1],
  },
  power: {
    warm: it[2],
    cold: it[3],
  },
}));

export class InioAccessoryPlugin implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly config: Config;
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

    // this.modeSwitch.setCharacteristic(this.api.hap.Characteristic.Name, 'Inio Light Mode');
    // this.modeSwitch.setCharacteristic(this.api.hap.Characteristic.Model, 'Inio Light Mode');

    this.modeSwitch.getCharacteristic(this.api.hap.Characteristic.On)
    // .setProps({ description: "Turn on/off the 'connected' mode"})
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

    this.lightBulb.getCharacteristic(this.api.hap.Characteristic.ColorTemperature)
      .setProps({minValue: 153, maxValue: 370})
      .onGet(this.handleColorTemperatureGet.bind(this))
      .onSet(this.handleColorTemperatureSet.bind(this));
  }

  apiUrl(suffix: string) {
    return this.config.url.replace(/\/$/, '') + suffix;
  }


  async pushUpdate() {
    // this.lightBulb.updateCharacteristic(this.api.hap.Characteristic.On, await this.handleOnGet());
    // this.lightBulb.updateCharacteristic(this.api.hap.Characteristic.Brightness, await this.handleBrightnesGet());
    // this.lightBulb.updateCharacteristic(this.api.hap.Characteristic.ColorTemperature, await this.handleColorTemperatureGet());
    //
    // this.modeSwitch.updateCharacteristic(this.api.hap.Characteristic.On, await this.handleModeGet());
  }

  async getStatus(): Promise<Status> {
    const response = await axios(this.apiUrl('/api/app/status'));
    return response.data;
  }

  async setToMode(mode: Mode) {
    const status = await this.getStatus();
    if (status.mode === mode) {
      return;
    }

    switch (mode) {
      case 'OFF':
        await axios(this.apiUrl('/api/interface/btn_short_manual'), {method: 'PUT'});
        break;
      case 'CONNECTED':
        if (status.mode === 'OFF') {
          await axios(this.apiUrl('/api/interface/btn_short_manual'), {method: 'PUT'});
        }
        await axios(this.apiUrl('/api/interface/btn_short_connect'), {method: 'PUT'});
        break;
      case 'STATIC':
        if (status.mode === 'OFF') {
          await axios(this.apiUrl('/api/interface/btn_short_manual'), {method: 'PUT'});
        } else if (status.mode === 'CONNECTED') {
          await axios(this.apiUrl('/api/interface/btn_short_connect'), {method: 'PUT'});
        }
        break;
      default:
        this.log.error('Unknown mode: ' + mode);

    }
    await this.pushUpdate();
  }

  async handleModeGet(): Promise<CharacteristicValue> {
    const status = await this.getStatus();
    return status.mode === 'CONNECTED';
  }

  async handleModeSet(value: CharacteristicValue) {
    this.log.debug('handleModeSet', value);
    await this.setToMode(value ? 'CONNECTED' : 'OFF');
  }

  /**
     * euclidian distance
     */
  distance(a: LampPowers, b: LampPowers): number {
    const coldDistance = Math.abs(a.cold - b.cold);
    const warmDistance = Math.abs(a.warm - b.warm);
    return coldDistance * coldDistance + warmDistance * warmDistance;
  }

  /**
     * Gets the current lamp power
     * This is a bit tricky because the lamp takes some time to settle
     * So we wait until the values are stable
     */
  async getLampPower(): Promise<LampPowers> {
    let response = (await axios(this.apiUrl('/api/app/pwm_duty_get'))).data;
    let settled = false;
    this.log.debug('Getting lamp status');
    while (!settled) {
      this.log.debug('Waiting for lamp to settle');
      await sleep(100);
      const current = (await axios(this.apiUrl('/api/app/pwm_duty_get'))).data;
      settled = current.cold === response.cold && current.warm === response.warm;
      response = current;
    }
    this.log.debug('settled on ' + JSON.stringify(response));
    return response;
  }

  /**
     * Gets the estimated temperature based on the current power
     */
  getEstimate(power: LampPowers): LampTemperature {
    let best = estimationMap[0];
    let bestDistance = this.distance(power, best.power);

    estimationMap.forEach(it => {
      if (this.distance(it.power, power) < bestDistance) {
        best = it;
        bestDistance = this.distance(it.power, power);
      }
    });

    return best.temperature;
  }

  async getEstimatedTemperature(): Promise<LampTemperature> {
    const power = await this.getLampPower();
    return this.getEstimate(power);
  }

  async handleBrightnesGet(): Promise<CharacteristicValue> {
    const res = (await this.getEstimatedTemperature()).brightness;
    return res;
  }

  async handleBrightnesSet(value: CharacteristicValue) {
    try {
      await this.setToMode('STATIC');
      const temperature = await this.getEstimatedTemperature();
      await axios(this.apiUrl('/api/app/light_color'), {
        method: 'POST',
        data: {
          ...temperature,
          brightness: value,
        },
      });
      void this.pushUpdate();
    } catch (e) {
      this.log.error('got an error', e);
    }
  }

  async handleColorTemperatureGet(): Promise<CharacteristicValue> {
    const res = (await this.getEstimatedTemperature()).kelvin;
    // kelvin to mirek
    return 1_000_000 / res;
  }

  async handleColorTemperatureSet(value: CharacteristicValue) {
    try {
      await this.setToMode('STATIC');
      const temperature = await this.getEstimatedTemperature();
      // We need to clamp the value because the lamp does not support all values
      const kelvin = Math.floor(1_000_000 / (value as number));
      const clamped = Math.max(2700, Math.min(6500, kelvin));
      await axios(this.apiUrl('/api/app/light_color'), {
        method: 'POST',
        data: {
          ...temperature,
          kelvin: clamped,
        },
      });
      void this.pushUpdate();
    } catch (e) {
      this.log.error('got an error', e);
    }
  }

  async handleOnGet(): Promise<CharacteristicValue> {
    const status = await this.getStatus();
    return status.mode !== 'OFF';
  }

  async handleOnSet(value: CharacteristicValue) {
    try {
      await this.setToMode(value ? 'STATIC' : 'OFF');
      void this.pushUpdate();
    } catch (e) {
      this.log.error('got an error', e);
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


async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}