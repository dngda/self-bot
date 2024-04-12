<p align="center">
  <img src="https://user-images.githubusercontent.com/35982346/123402400-e57d3000-d5d1-11eb-84c0-6881b56ad370.png" height="128"/>
</p>
<p align="center">
  <a href="https://github.com/dngda/self-bot"><img title="Whatsapp-Bot" src="https://img.shields.io/badge/Sero Whatsapp Bot-blue?colorB=%23ffd700&style=for-the-badge"></a>
    <br>
  🤖 Typescript - Lightweight WhatsApp bot using <a href="https://github.com/WhiskeySockets/Baileys">Baileys</a> Library<hr>
</p>
<h3 align="center">Made with ❤️</h3>
<p align="center">
  <a href="https://github.com/dngda/"><img title="Author" src="https://img.shields.io/badge/author-dngda-blue?style=for-the-badge&logo=github"></a>
</p>

<p align="center">
  <a href="https://github.com/dngda/followers"><img title="Followers" src="https://img.shields.io/github/followers/dngda?color=blue&style=flat-square"></a>
  <a href="https://github.com/dngda/self-bot/stargazers/"><img title="Stars" src="https://img.shields.io/github/stars/dngda/self-bot?color=red&style=flat-square"></a>
  <a href="https://github.com/dngda/self-bot/network/members"><img title="Forks" src="https://img.shields.io/github/forks/dngda/self-bot?color=red&style=flat-square"></a>
  <a href="https://github.com/dngda/self-bot/watchers"><img title="Watching" src="https://img.shields.io/github/watchers/dngda/self-bot?label=watchers&color=blue&style=flat-square"></a>
    <br>
  <a href="https://sonarcloud.io/summary/new_code?id=dngda_self-bot">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=dngda_self-bot&metric=alert_status" alt="Quality Gate Status">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=dngda_self-bot">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=dngda_self-bot&metric=code_smells" alt="Code Smells">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=dngda_self-bot">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=dngda_self-bot&metric=security_rating" alt="Security Rating">
  </a>
</p>

## Getting Started

<a href="https://saweria.co/dngda" target="_blank"><img id="wse-buttons-preview" src=".github\saweria.png" height="25" style="border:0px;height:25px;" alt="Trakteer Saya"></a>
<a href="https://trakteer.id/dngda/tip?quantity=1" target="_blank"><img id="wse-buttons-preview" src="https://cdn.trakteer.id/images/embed/trbtn-red-3.png" height="25" style="border:0px;height:25px;" alt="Trakteer Saya"></a>

## Prerequisite

-   Star this repository 🌟
-   Minimum Node.js version `v14` as this project works well in `v16`
-   Need to install `ffmpeg` globally to be able use animated sticker converter

### How to

Clone this project or download zip

```bash
> git clone https://github.com/dngda/self-bot
> cd self-bot
```

Install the dependencies:

```bash
> npm install ts-node typescript -g
> npm install
```

Setup your `.env` files

```bash
> cp .env.sample .env
```

or copy paste `.env.sample` and rename to `.env`
and fill it with your related data!

### Usage

Run the WhatsApp Bot

```bash
> tsc
> node build
```

or use `ts-node` without compile to `.js`

```bash
> npm start
```

After running it you need to scan the QR

## Features

-   Text to sticker
-   Search Pinterest image
-   Sticker Creator using [WA-Sticker-Formatter](https://github.com/AlenVelocity/wa-sticker-formatter)
-   Note database with sqlite [Sequelize](https://sequelize.org/)
-   Add caption to image with [memegen](https://api.memegen.link) and make sticker of it
-   Browser related such as screenshot web or search ddg/ggl
-   Social media video downloader using ssyoutube.com
-   Split long video to 30s for WA Status
-   Jadwal sholat kabupaten based
-   Anti-delete msg/status
-   Quran + audio per-ayah
-   Get one-view media
-   Sticker commands
-   Video to mp3

💡 Leave any feature ideas out in this [discussion](https://github.com/dngda/self-bot/discussions) 🙏

## Thanks to

-   [`Baileys`](https://github.com/WhiskeySockets/Baileys)
-   [`WA-Sticker-Formatter`](https://github.com/AlenVelocity/wa-sticker-formatter)
