const fs = require('fs');
const uglify = require('uglify-js');

(async () => {
    console.log('Creating bookmarklet from tam-drawio.js');
    console.log('==================================');
    console.log('Reading tam-drawio.js');
    const code = await fs.promises.readFile('tam-drawio.js', 'utf8');

    console.log('Minifying code')
    const result = uglify.minify(code);
    if (result.error) {
        return console.error(result.error);
    }

    console.log('Reading resources/index.template.html');
    const html = await fs.promises.readFile('resources/index.template.html', 'utf8');

    console.log('Writing docs/index.html');
    const escapedScript = result.code
        .replace(/</g, '&#60;')
        .replace(/>/g, '&#62;')
        .replace(/"/g, '&#34;')
        .replace(/\\/g, '&#92;');
    await fs.promises.writeFile(
        'docs/index.html',
        html
            .replace(/<!-- bookmarklet start \/-->.+?<!-- bookmarklet end \/-->/gim, `<a class="link-button" href="javascript:${escapedScript}">Add TAM Plugin</a>`)
            .replace(/<!-- download start \/-->.+?<!-- download end \/-->/gim, `<a class="link-button" href="data:application/javascript,${escapedScript}" download="tam-drawio">Download TAM Plugin</a>`)
    );

    console.log('==================================');
    console.log('Done!');
})();





