const { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync,
      chmodSync} = require("fs");
const { join } = require("path");
const { join : unixjoin } = require("path/posix");

const map = new Map();

function loopFiles(root, path) {
  const stat = statSync(join(root, path));
  if (stat.isDirectory()) for (const file of readdirSync(join(root, path))) {
    loopFiles(root, unixjoin(path, file));
  }
  else map.set(path, readFileSync(join(root, path), 'utf-8'));
}
loopFiles(`${__dirname}/build`, "/");

const requireFn = `
let mainModule
const requireCache = {};
function createRequire(root, declareMain = false) {
    function loadModule(rp, path) {
        const modO = sources.get(path);
        if (!modO) return require(mod);
        const module = {};
        const exports = {};
        module.exports = exports;
        if (declareMain) mainModule = module;
        requireCache[rp] = () => module.exports;
        modO(module, exports, createRequire(path));
        return requireCache[rp]();
    }
    function customRequire(mod) {
        if (!mod.startsWith(".")) return require(mod);
        const { join } = require("path/posix");
        const path = join(root, "..", mod);
        if (typeof requireCache[path] != 'undefined') return requireCache[path]();
        let module;
        if (sources.has(path)) module = loadModule(path, path);
        if (sources.has(path + ".js")) module = loadModule(path, path + ".js");
        if (sources.has(join(path, "index.js"))) module = loadModule(path, join(path, "index.js"));
        if (module) {
            return module;
        }
        return require(mod);
    }
    customRequire.main = mainModule;
    return customRequire;
}
`;

mkdirSync(`${__dirname}/bin`, { recursive: true });

const sources = "const sources = new Map([" + [...map.entries()]
      .map(([path, content]) => `["${path}", (module, exports, require) => { ${content} }]`).join(",") + "]);";

writeFileSync(`${__dirname}/bin/ess.js`, "#!/usr/bin/node\n" + requireFn + sources + "createRequire(\"/\", true)(\"./index.js\")");
chmodSync(`${__dirname}/bin/ess.js`, "755");
