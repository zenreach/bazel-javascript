const fs = require("fs-extra");
const path = require("path");
var babel = require("@babel/core");
const { safeSymlink } = require("../common/symlink");

const [
  nodePath,
  scriptPath,
  fullSrcDir,
  destinationDir,
  joinedSrcs
] = process.argv;

const srcs = new Set(joinedSrcs.split("|"));

// Compile with Babel.
transformDir(".");

function transformDir(dirRelativePath) {
  for (const fileName of fs.readdirSync(
    path.join(fullSrcDir, dirRelativePath)
  )) {
    const relativeFilePath = path.join(dirRelativePath, fileName);
    const srcFilePath = path.join(fullSrcDir, relativeFilePath);
    let destFilePath = path.join(destinationDir, relativeFilePath);
    fs.ensureDirSync(path.dirname(destFilePath));
    if (fs.lstatSync(srcFilePath).isDirectory()) {
      transformDir(relativeFilePath);
    } else if (
      srcs.has(relativeFilePath) &&
      (fileName.endsWith(".es6") ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".jsx"))
    ) {
      const transformed = babel.transformFileSync(srcFilePath, {
        presets: [
            [require("@babel/preset-env"), { "modules": false }],
            require("@babel/preset-react"),
        ],
        plugins: [
          // Stage 2
          [require("@babel/plugin-proposal-decorators"), { "legacy": true }],
          require("@babel/plugin-proposal-function-sent"),
          require("@babel/plugin-proposal-export-namespace-from"),
          require("@babel/plugin-proposal-numeric-separator"),
          require("@babel/plugin-proposal-throw-expressions"),

          // Stage 3
          require("@babel/plugin-syntax-dynamic-import"),
          require("@babel/plugin-syntax-import-meta"),
          [require("@babel/plugin-proposal-class-properties"), { "loose": true }],
          require("@babel/plugin-proposal-json-strings")
        ],
        ignore: ["node_modules"]
      });
      if (!transformed.code) {
        throw new Error(`Could not compile ${srcFilePath}.`);
      }
      if (!destFilePath.endsWith(".js")) {
        destFilePath =
          destFilePath.substr(0, destFilePath.lastIndexOf(".")) + ".js";
      }
      fs.writeFileSync(destFilePath, transformed.code, "utf8");
    } else {
      // Symlink any file that:
      // - isn't a source file of this package; or
      // - is not a JavaScript file (e.g. CSS assets).
      safeSymlink(srcFilePath, destFilePath);
    }
  }
}
