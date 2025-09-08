# Deploy MediaWiki Seite per GitHub Action

Diese Action logged sich via MediaWiki API ein und aktualisiert eine Seite (Standard: `MediaWiki:Common.js`) mit dem Inhalt einer bereitgestellten Datei.

## Features

- Puppeteer gesteuerte Login-/Edit-Session
- Konfigurierbarer Device-Emulator (KnownDevices)
- Dateipfad als Input wählbar

## Inputs (action.yml)

| Name         | Pflicht | Default               | Beschreibung                                          |
| ------------ | ------- | --------------------- | ----------------------------------------------------- |
| `file`       | ja      | `dist/somefile.js`    | Pfad zur Quell-Datei deren Inhalt veröffentlicht wird |
| `page-title` | ja      | `MediaWiki:Common.js` | Zielseite im Wiki                                     |
| `username`   | ja      | -                     | Bot Benutzername (Secret)                             |
| `password`   | ja      | -                     | Bot Passwort (Secret)                                 |

## Secrets

- `BOT_USERNAME`
- `BOT_PASSWORD`

## Beispiel Workflow

```yaml
name: Deploy MediaWiki
on:
	workflow_dispatch:
		inputs:
			file:
				description: 'Datei'
				required: false
				default: 'dist/somefile.js'
jobs:
	deploy:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with:
					node-version: '20'
			- run: npm ci
			- run: npm run build
			- uses: ./
				with:
					file: ${{ github.event.inputs.file || 'dist/somefile.js' }}
					username: ${{ secrets.BOT_USERNAME }}
					password: ${{ secrets.BOT_PASSWORD }}
```

## Entwicklung lokal

```powershell
npm i
npm run build
node dist/index.js
```

Erforderliche ENV Variablen lokal (falls benötigt): `GITHUB_REPOSITORY`, `GITHUB_ACTOR`, `GITHUB_SHA`.
