module.exports = {
    entry: "./entry.js",
    output: {
        path: __dirname,
        filename: "bundle.js"
    },
    devtool: 'source-map',
    module: {
      loaders: [
          { test: /\.js$/,
            loader: 'babel',
            query: {
              presets: ['es2015'],
            },
            exclude: /(node_modules|bower_components)/,
          },
      ],
    },
    externals: {
      'ace': "ace",
    },
};
