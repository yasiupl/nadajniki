const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const WorkboxPlugin = require('workbox-webpack-plugin');
const path = require('path');

module.exports = {
    entry: ['./src/app.js', './src/style.scss'],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    resolve: {
        fallback: {
            "stream": require.resolve("stream-browserify"),
            "timers": require.resolve("timers-browserify")
        }
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: 'style.css'
        }),
        new HtmlWebpackPlugin({
            hash: true,
            title: 'Mapa nadajników radiowych',
            template: './src/index.html',
            filename: './index.html',
            favicon: './src/assets/favicon.ico'
        }),
        new WebpackPwaManifest({
            fingerprints: false,
            name: 'Mapa Nadajników',
            short_name: 'Nadajniki',
            description: 'Mapa pozwoleń radiowych RRL UKE.',
            background_color: '#ffffff',
            theme_color: '#2196F3',
            start_url: '/?utm_source=a2hs',
            display: 'standalone',
            ios: {
                'apple-mobile-web-app-status-bar-style': 'white'
            },
            icons: [
              {
                src: path.resolve('src/assets/icon.png'),
                destination: './icons/',
                sizes: [96, 128, 192, 256, 384, 512],
                ios: true
              },
              {
                src: path.resolve('src/assets/icon.png'),
                destination: './icons/',
                size: 512,
                ios: 'startup'
              }
            ]
          }),
          new WorkboxPlugin.GenerateSW({
            runtimeCaching: [{
                urlPattern: /.*/,
                handler: 'StaleWhileRevalidate',}]
          }),
    ],
    module: {
        rules: [
            {
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'sass-loader',
                ],
            },
            {
                test: /\.(jpe?g|gif|png|svg|woff|ttf|wav|mp3)$/,
                loader: "file-loader"
            }
        ]
    }
}