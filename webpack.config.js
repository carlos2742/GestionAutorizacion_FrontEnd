'use strict';

// Modules
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const isProd = process.env.MODE === 'production';


module.exports = {
    mode: !isProd ? 'development' : 'production',
    entry: [
        'whatwg-fetch',
        path.join(__dirname, "src", "app", "app.js")
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: isProd ? '[name].[chunkhash].js' : '[name].bundle.js',
        chunkFilename: isProd ? '[name].[chunkhash].js' : '[name].js',
        publicPath: '/'
    },
    devtool: isProd ? "source-map" : "eval-source-map",
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                options: {
                    configFile: path.resolve('babel.config.js')
                },
                include: [
                    path.resolve('src'),
                    // These dependencies have es6 syntax which ie11 doesn't like.
                    path.resolve('node_modules/zipcelx')
                ]
            }, {
                test: /\.(css|sass|scss)$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: !isProd,
                            minimize: isProd
                        }
                    },
                    {
                        loader: "sass-loader"
                    }
                ]
            }, {
                test: /\.(png|svg|jpg|gif)$/,
                use: [
                    'file-loader?name=[path][name].[ext]'
                ]
            }, {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                use: [{
                    loader: 'file-loader',
                    options: {
                        name: '[path][name].[hash].[ext]',
                        context: path.resolve(__dirname, 'src', 'public')
                    }
                }]
            }, {
                test: /\.html$/,
                use: [ {
                    loader: 'html-loader',
                    options: {
                        minimize: isProd
                    }
                }],
            }
        ]
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
            automaticNameDelimiter: '.',
        },
        runtimeChunk: 'single',
    },
    plugins: [
        new MiniCssExtractPlugin({
            // Options similar to the same options in webpackOptions.output
            // both options are optional
            filename: isProd ? "[name].[hash].css" : "[name].css",
            chunkFilename: isProd ? "[name].[hash].css" : "[name].css"
        }),
        new HtmlWebpackPlugin({
            template: './src/public/index.html',
            inject: 'body',
            minify: {
                removeComments: true,
                collapseWhitespace: true
            },
        }),
        new CopyWebpackPlugin([{
            from: path.resolve(__dirname, 'src', 'public', 'app.conf.json'),
        }, {
            from: path.resolve(__dirname, 'src', 'public', 'web.config'),
        }, {
            from: path.resolve(__dirname, 'src', 'public', 'img', 'favicon.ico'),
            to: path.resolve(__dirname, 'dist', 'img'),
        }]),
        new LodashModuleReplacementPlugin({
            shorthands: true,
            cloning: true,
            caching: true,
            collections: true,
            paths: true
        }),
        new webpack.DefinePlugin({
            DEBUG_MODE: JSON.stringify(!isProd)
        }),
        new webpack.optimize.ModuleConcatenationPlugin()
    ]
};
