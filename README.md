# tam-drawio
A [draw.io](https://github.com/jgraph/drawio) plugin which offers TAM notation


TAM is a subset of UML2 and FMC (Fundamental Modeling Concepts) block diagrams based on DIN 66200 - (Data processing systems operation; concepts, job relationships
STANDARD by Deutsches Institut Fur Normung E.V. (German National Standard), 03/01/1992)

For more information on TAM Notation, see [here](http://www.fmc-modeling.org/notation_reference)

draw.io is an open-source for web-based diagramming tool. It can be downloaded to run as a desktop application or consumed from [diagrams.net](https://app.diagrams.net/) 

This plugin adds some components to draw.io, which cover the common components used in TAM's block diagrams.


## How to install

- First you need to have the file `tam-drawio.js` on your local file system
- Simple way to do so is to clone this repo: `git clone https://github.com/ariel-bentu/tam-drawio`

### Install in draw.io desktop

**Note:** Since draw.io v19.0.3, in the desktop (Electron) version of draw.io, plugins are disabled by default, and since v20,  also are blocked from `extra->configurations` menu. To allow plugins, one needs to pass a command-line argument to draw.io `--enable-plugins`.

 For Mac users, there are three possible methods:
 1. Easiest, but requires downloading an unsigned app
    - download [this tar](./launchDrawioWithPlugins.tar)
    - extract it locally -> you will now see a macOS `app`
    - drag and drop it onto your 'Applications' folder
    - first time, right-click on it and select `Open` - you'll be prompted to Open an app with unverified developer. Choose `Open` - That's it.
    - Next time, you can simple double click normally to open the app.
    - Note: The tar file contains 3 files: icon, plist.info, script to run the original draw.io
 2. Easy, but not perfect:
    - Open “Script Editor”
    - Paste this code: 
    ```
       do shell script "\"/Applications/draw.io.app/Contents/MacOS/draw.io\" --enable-plugins"
       quit
    ```
    - Save… -> choose “file format” to be “application”, give it a name: e.g. `tamDrawIO`
    - Now you have an application with your chosen name.
 3. Harder, but then seemless experience: [see here](./mac-pass-arg.md)

 After you enabled plugins, follow these steps:
 - Goto Menu `Extras->Plugins...`
 - Press `Add`
 - browse and select `tam-drawio.js`
 - Press `Apply`
 - Restart Drawio


> in some cases if you re-install the plugin, you get the error "File Already Exists". then go to the `<appData>/draw.io/plugins` and remove the file manually before re-installing.

```
<appData> is:
- %APPDATA%   on Windows
- $XDG_CONFIG_HOME or ~/.config   on Linux
- ~/Library/Application Support   on macOS
```


#### Note for Draw.io 21.3.0 release and after!!!
- The Sidepanel does not show the TAM elements in Dark mode.
- Select Light mode and restart.

#### Note for Draw.io 24 release and after!!!
- Plugin often is not loaded 
- Workaround:
  - open drawio
  - select menu: `Help->Open Developer Tools`
  - go "Application" tab
  - under `Local storage->file://`
  - look for a key `.drawio-config`
  - edit the value, changing the `plugins` array. Change the `tam-drawio.js` from having a full path to only file name (`tam-drawio.js`).
  - restart Drawio


### Install in VSCode
- Assuming you have Drawio vs-code extension. If not: [Get It](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio)
- Open the Settings
- Search for `plugins`
- Find the `Draw.io Integration` under `Extensions`
- Select the `Hediet > VSCode-drawio: Plugins`
- Choose to `edit in Settings.json`
- Add an entry to the array:
```
"hediet.vscode-drawio.plugins": [
    {"file":"path/to/file/tam-drawio.js"}
]
```
- Restart VSCode
- You will be prompted to Allow this plugin (once ever)
- Allow and you are good to go

### Install in app.diagrams.net
- `app.diagrams.net` has restricted allow-list for the plugin source domains and script checksums, 
  which prevents plugin from being added in a standard way (via `Extras --> Plugins...`)
- As a workaround the [bookmarklet](https://en.wikipedia.org/wiki/Bookmarklet) may be used. 
    - Navigate to the [page with bookmarklet link](https://ariel-bentu.github.io/tam-drawio/) and
      drag the link to the bookmark bar of your  browser.
    - Every time you visit https://app.diagrams.net, click on the bookmark before you open
      or create new diagram. That will install plugin for the current editor session.
- If anyone has an idea how to permanently enable plugin in `app.diagrams.net`, please speak-up

### Verify installation
An installation is successful, if you see TAM's new toolbar side-pannels, and 2 new buttons in the toolbar (as depicted in this screenshot).

<img height="400px" src="./resources/successful-installation.png"/>

### Configuration:
- Adding hidden text in the model for those who do not have the plugin:

#### Desktop version
Menu Extras --> Configuration
```json
{
  "globalVars": {
    "tam": {
      "addPluginMissingLabel": true
    }
  }
}
```

#### VSCode
Add the following entry in the VSCode `settings.json` (<kbd>F1</kbd> --> `Preferences: Open Settings (JSON)`)
```
"hediet.vscode-drawio.globalVars": {
  "tam": {
    "addPluginMissingLabel": true
  }
}
```

## Usage tips
- When using the using-edge (the line with circle and "R" and arrow), you can flip the direction by selecting the edge and pressing the new button on the toolbar (tooltip: Flip Use Direction).
- Use direction and side, can be controlled by the Style.
- If you send the model to another person, that other person would need the TAM plugin to view it properly.

Therefore, the plugin adds a hidden text saying: `Best viewed with the TAM plugin` with a link to this repo. This text field is hidden as long as you have the plugin installed. Anyone without a plugin, will see this text item. (this is also hidden in the svg representation of a model).

To disable this behavior, see the configuration section above
- You may save a diagram file as "editable vector image (.svg)", then it gets saved as an svg with the drawio diagram embedded. this is useful for embedding into markdown files without maintaining two files - one for the diagram source and one for embedding into markdown.

## Contribution
Contributions are welcome. open Issues, submit pull-requests etc.

## Credits
- Special thanks to [micellius](https://github.com/micellius) for improving the code, contributing the bookmarklet concept for the online option, improving the settings and more. 

## Development
To modify cloned/downloaded version of `tam-drawio` plugin, you don't need to run any build step.
However, if you plan to contribute your change, you need to run the script that updates links in documentation. 

### Debug
The best way to debug the code is to load the plugin on an html version of draw.io. here are the steps:
- clone draw.io (`https://github.com/jgraph/drawio`) into a sibling folder to this project. (so `../drawio` would find it)
- Copy the tam-drawio.js into `../drawio/src/main/webapp/plugins`
- Modify `../drawio/src/main/webapp/index.html` this file by changing these two variables:
```
      ...
    if (urlParams['dev'] == '1')
		{
	    // Used to request grapheditor/mxgraph sources in dev mode
			var mxDevUrl = document.location.protocol + '//localhost:8080/';
			
			// Used to request draw.io sources in dev mode
			var drawDevUrl = document.location.protocol + '//localhost:8080/';
		
```
- Run: `node drawio.js` and access the server `http://localhost:8080?dev=1`
- Now use the browser debugger to debug the plugin.


### Prerequisites
- Download and install [Node.js](https://nodejs.org/en/download/) (≥16.14.0)
- Install dependencies by running `npm install` in the root directory of this repository

To update the bookmarklet and download links in documentation, please run
```
npm run pages
```
after changing `tam-drawio.js`, before pushing the code.
