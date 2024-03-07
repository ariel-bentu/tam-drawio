var connect = require('connect');
var serveStatic = require('serve-static');

connect()
    .use(serveStatic("../drawio/src/main/webapp/"))
    .listen(8080, () => console.log('Server running on http://localhost:8080/?dev=1'));