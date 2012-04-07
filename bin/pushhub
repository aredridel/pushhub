#! /usr/bin/env node

var program = require('commander');

var app = require('../index');
var package = require('../package.json');

program
  .version(package.version)
  .option('-p, --port <port>', 'Port to listen to.', parseInt)
  .option('-h, --host <host>', 'Host to listen on.')
  .option('-d, --directory <dir>', 'Directory containing your git repositories')
  .parse(process.argv);

var port = program.port || 3000;
var host = program.host || 'localhost';

if(program.directory) {
    app.set('git root', program.directory);
}

console.log('Listening at: http://%s:%d', host, port);
app.listen(port, host);
