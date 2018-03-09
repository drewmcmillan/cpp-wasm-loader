'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadOptions = loadOptions;
var loaderUtils = require('loader-utils');

function loadOptions(loader) {
  var options = loaderUtils.getOptions(loader);

  var buildPath = options.buildPath ? options.buildPath : undefined;
  if (buildPath === undefined) {
    throw new Error('You have to specify build path, where the WASM files will be stored');
  }

  var emccPath = options.emccPath ? options.emccPath : process.platform === 'win32' ? 'em++.bat' : 'em++';
  var emccFlags = options.emccFlags ? options.emccFlags : ['-O3'];
  var wasmName = options.wasmName;

  return {
    buildPath, emccPath, emccFlags, wasmName
  };
}