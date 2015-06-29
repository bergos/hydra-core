var
  exec = require('child_process').exec;


var run = function (command) {
  return new Promise(function (resolve, reject) {
    exec(command, function (error, stdout, stderr) {
      if (error != null) {
        return reject(error);
      }

      if (stderr.trim() !== '') {
        console.error(stderr.trim());
      }

      if (stdout.trim() !== '') {
        console.log(stdout.trim());
      }

      resolve();
    });
  });
};


var browserify = function (source, target, options) {
  options = options || {};

  var cmd = './node_modules/.bin/browserify ' + source + ' -o ' + target;

  if (options.debug) {
    cmd += ' --debug';
  }

  if (options.exclude) {
    cmd += ' ' + options.exclude
      .map(function (exclude) {
        return '-u ' + exclude;
      })
      .join(' ');
  }

  if (options.list) {
    cmd += ' --list';
  }

  if (options.noBuiltins) {
    cmd += ' --no-builtins';
  }

  if (options.noBundleExternal) {
    cmd += ' --no-bundle-external';
  }

  if (options.standalone) {
    cmd += ' --standalone=' + options.standalone;
  }

  return run(cmd);
};


var exorcist = function (source, target, options) {
  options = options || {};

  var cmd = 'cat ' + source + ' | ./node_modules/.bin/exorcist ' + target + ' > /dev/null';

  return run(cmd);
};


var uglify = function (source, target, options) {
  options = options || {};

  var cmd = './node_modules/.bin/uglifyjs ' + source + ' -o ' + target;


  if (options.compress) {
    cmd += ' --compress';
  }

  if (options.inSourceMap) {
    cmd += ' --in-source-map ' + options.inSourceMap;
  }

  if (options.sourceMap) {
    cmd += ' --source-map ' + options.sourceMap;
  }

  if (options.sourceMapUrl) {
    cmd += ' --source-map-url ' + options.sourceMapUrl;
  }

  return run(cmd);
};


browserify('hydra-core.js', 'dist/hydra-core.js', { debug: true, noBundleExternal:true, standalone: 'hydra' })
  .then(function () {
    return exorcist('dist/hydra-core.js', 'dist/hydra-core.js.map', {});
  })
  .then(function () {
    return browserify('hydra-core.js', 'dist/hydra-core.js', { noBundleExternal:true, standalone: 'hydra' })
  })
  .then(function () {
    return uglify('dist/hydra-core.js', 'dist/hydra-core.min.js', {
      compress: true,
      inSourceMap: 'dist/hydra-core.js.map',
      sourceMap: 'dist/hydra-core.min.js.map',
      sourceMapUrl: 'hydra-core.min.js.map'
    });
  })
  .catch(function (error) {
    console.error(error.stack);
  });
