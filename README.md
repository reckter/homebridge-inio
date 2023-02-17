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
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/reckter"><img src="https://avatars.githubusercontent.com/u/1771450?v=4?s=100" width="100px;" alt="Hannes Güdelhöfer"/><br /><sub><b>Hannes Güdelhöfer</b></sub></a><br /><a href="https://github.com/reckter/homebridge-inio/commits?author=reckter" title="Code">💻</a> <a href="#ideas-reckter" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-reckter" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-reckter" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!