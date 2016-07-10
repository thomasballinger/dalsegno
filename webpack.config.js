module.exports = {
    entry: "./entry.js",
    output: {
        path: __dirname,
        filename: "bundle.js"
    },
    devtool: 'source-map',
    loaders: [
        { test: /\.css$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel',
          query: {
            presets: ['es2015'],
            cacheDirectory: true,
          },
        },
        { test: /\.js$/, loader: "style!css" }
    ],
    externals: {
      'ace': "ace",
    },
};
