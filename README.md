# Homebridge plugin for [inio](https://inio-light.com) lights

## Still under development!

This plugin lets you control your inio lamps with Homekit.

currently working:
- brightness
- on/off
- set to "connected" mode (which follows the predetermined pattern by the app)

Exposes a lamp and a switch currently

## Installation

```
npm i homebridge-inio
```

or just add it in the homebridge UI


## Configuration

Example for one accesory
```
{
    accesory: "inioLight",
    name: "<same name>",
    url: "http://<ip of lamp>",
}
```

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->