import path from 'node:path'
import { fileURLToPath } from 'node:url'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import WebpackPwaManifest from 'webpack-pwa-manifest'
import WorkboxPlugin from 'workbox-webpack-plugin'

const root = path.dirname(fileURLToPath(import.meta.url))
const TITLE = 'Mapa nadajników radiowych'

export default (env, argv) => {
    const production = argv.mode !== 'development'
    return {
        mode: production ? 'production' : 'development',
        devtool: production ? false : 'eval-cheap-module-source-map',
        entry: './src/app.js',
        output: {
            path: path.resolve(root, 'dist'),
            filename: production ? '[name].[contenthash:8].js' : '[name].js',
            publicPath: '/',
            // Katalog dist/data/ tworzy scripts/build-data.mjs przed budowaniem aplikacji.
            clean: { keep: /^data[\\/]/ }
        },
        devServer: {
            static: { directory: path.join(root, 'dist') },
            historyApiFallback: true,
            compress: true,
            port: 9000
        },
        performance: { hints: false },
        plugins: [
            new MiniCssExtractPlugin({ filename: production ? '[name].[contenthash:8].css' : '[name].css' }),
            new HtmlWebpackPlugin({
                title: TITLE,
                template: './src/index.html',
                filename: 'index.html',
                favicon: './src/assets/favicon.ico'
            }),
            new WebpackPwaManifest({
                fingerprints: false,
                publicPath: '/',
                name: 'Mapa Nadajników',
                short_name: 'Nadajniki',
                description: 'Mapa pozwoleń radiowych RRL UKE.',
                background_color: '#fcfcfb',
                theme_color: '#2a78d6',
                start_url: '/?utm_source=a2hs',
                display: 'standalone',
                ios: {
                    'apple-mobile-web-app-status-bar-style': 'default'
                },
                icons: [
                    {
                        src: path.resolve(root, 'src/assets/icon.png'),
                        destination: 'icons',
                        sizes: [96, 128, 192, 256, 384, 512],
                        ios: true
                    },
                    {
                        src: path.resolve(root, 'src/assets/icon.png'),
                        destination: 'icons',
                        size: 512,
                        ios: 'startup'
                    }
                ]
            }),
            ...(production ? [new WorkboxPlugin.GenerateSW({
                clientsClaim: true,
                skipWaiting: true,
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                // Adresy /stacja/... to ta sama aplikacja (index.html).
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//, /^\/data\//],
                runtimeCaching: [
                    {
                        // Dane zmieniają się co miesiąc: najpierw sieć, kopia tylko bez połączenia.
                        urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/'),
                        handler: 'NetworkFirst',
                        options: { cacheName: 'data', networkTimeoutSeconds: 10, expiration: { maxEntries: 300 } }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'fonts', expiration: { maxEntries: 10 } }
                    }
                ]
            })] : [])
        ],
        module: {
            rules: [
                {
                    test: /\.s[ac]ss$/i,
                    use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
                },
                {
                    test: /\.css$/i,
                    use: [MiniCssExtractPlugin.loader, 'css-loader']
                },
                {
                    test: /\.(png|jpe?g|gif|svg|woff2?|ttf)$/i,
                    type: 'asset/resource'
                }
            ]
        }
    }
}
