import Promise from 'bluebird';
import { loadOptions } from './options';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const rimraf = require('rimraf');
const md5 = require('md5');

const tmpDir = Promise.promisify(tmp.dir);
const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);
const execFile = Promise.promisify(cp.execFile);
const rf = Promise.promisify(rimraf);

function buildModule(wasmName, indexContent) {
  const Module = {
    wasmBinaryFile: wasmName,
    ENVIRONMENT: 'WEB',
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

function createBuildWasmName(resource, content) {
  const fileName = path.basename(resource, path.extname(resource));
  return `${fileName}-${md5(content)}.wasm`;
}

export default async function loader(content) {
  const cb = this.async();
  let folder = null;

  try {
    const options = loadOptions(this);
    
    const wasmBuildName = createBuildWasmName(this.resourcePath, content);

    var inputFile = `input${path.extname(this.resourcePath)}`;
    var indexFile = wasmBuildName.replace('.wasm', '.js');
    var wasmFile = wasmBuildName;

    options.emccFlags = [inputFile, '-s', 'WASM=1', ...options.emccFlags, '-o', indexFile];

    folder = await tmpDir();

    // write source to tmp directory
    await writeFile(path.join(folder, inputFile), content);

    // compile source file to WASM
    await execFile(options.emccPath, options.emccFlags, {
      cwd: folder,
    });

    const indexContent = await readFile(path.join(folder, indexFile), 'utf8');
    const wasmContent = await readFile(path.join(folder, wasmFile));

    this.emitFile(wasmBuildName, wasmContent);

    const module = buildModule(wasmBuildName, indexContent);

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
}
