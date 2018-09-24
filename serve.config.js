const path = require('path');
const serve = require('webpack-serve');
let wpConfig = require('./webpack.config.js');

let serverConfig = {
    host: 'localhost',
    port: 9300,
    config: wpConfig,
    content: path.resolve(__dirname, 'dist'),
    hot: true,
    logTime: true
};

serve(serverConfig);