'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _options = require('./options');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var cp = require('child_process');
var fs = require('fs');
var path = require('path');
var tmp = require('tmp');
var rimraf = require('rimraf');
var md5 = require('md5');

var tmpDir = _bluebird2.default.promisify(tmp.dir);
var readFile = _bluebird2.default.promisify(fs.readFile);
var writeFile = _bluebird2.default.promisify(fs.writeFile);
var execFile = _bluebird2.default.promisify(cp.execFile);
var rf = _bluebird2.default.promisify(rimraf);

function buildModule(wasmName, indexContent) {
  var Module = {
    wasmBinaryFile: wasmName,
    ENVIRONMENT: 'WEB'
  };

  return `module.exports = (function(existingModule)
          {
              return {
                initialize: function(userDefinedModule)
                {
                  return new Promise((resolve, reject) =>
                  {
                    if (!userDefinedModule)
                    {
                      userDefinedModule = {}
                    }
                    var Module = Object.assign({}, userDefinedModule, existingModule);
                    Module['onRuntimeInitialized'] = () => resolve(Module);
                    \n${indexContent}\n
                  });
                }
              }
            })(${JSON.stringify(Module)})`;
}

function createBuildWasmName(resource, content, wasmName) {
  if (wasmName) return wasmName;
  var fileName = path.basename(resource, path.extname(resource));
  return `${fileName}-${md5(content)}.wasm`;
}

exports.default = async function loader(content) {
  var cb = this.async();
  var folder = null;

  try {
    var options = (0, _options.loadOptions)(this);

    var wasmBuildName = createBuildWasmName(this.resourcePath, content, options.wasmName);

    var inputFile = `input${path.extname(this.resourcePath)}`;
    var indexFile = wasmBuildName.replace('.wasm', '.js');
    var wasmFile = wasmBuildName;

    options.emccFlags = [inputFile, '-s', 'WASM=1'].concat(_toConsumableArray(options.emccFlags), ['-o', indexFile]);

    folder = await tmpDir();

    // write source to tmp directory
    await writeFile(path.join(folder, inputFile), content);

    // compile source file to WASM
    await execFile(options.emccPath, options.emccFlags, {
      cwd: folder
    });

    var indexContent = await readFile(path.join(folder, indexFile), 'utf8');
    var wasmContent = await readFile(path.join(folder, wasmFile));

    this.emitFile(wasmBuildName, wasmContent);

    var module = buildModule(wasmBuildName, indexContent);

    if (folder !== null) {
      await rf(folder);
    }
    cb(null, module);
  } catch (e) {
    if (folder !== null) {
      await rf(folder);
    }
    cb(e);
  }

  return null;
};