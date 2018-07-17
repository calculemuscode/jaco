// Mostly from https://github.com/TypeStrong/ts-loader
const path = require("path");

module.exports = {
    mode: "production",
    devtool: "inline-source-map",
    entry: path.resolve(__dirname, "src", "demo", "demo.ts"),
    output: {
      filename: "jaco.js",
      path: path.resolve(__dirname, "demo")
    },
    resolve: {
      // Add `.ts` and `.tsx` as a resolvable extension.
      extensions: [".ts", ".tsx", ".js"]
    },
    module: {
      rules: [
        // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
        { test: /\.tsx?$/, loader: "ts-loader" }
      ]
    },
    externals: {
        "codemirror": "CodeMirror"
    },
  };
  