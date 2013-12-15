var spawn = require('child_process').spawn;
var path = require('path');

var reporter = process.env.TRAVIS ? 'mocha-lcov-reporter' : 'nyan';

function test(reporter, stdin, stdout, stderr) {
  return spawn(
    path.join('node_modules', 'mocha', 'bin', 'mocha'),
    ['--reporter', reporter],
    {
      stdio: [stdin, stdout, stderr]
    }
  );
};

if (process.env.TRAVIS) {
  process.env.MIO_COVERAGE = true;
  process.env.JSCOV = true;

  var mocha = test('mocha-lcov-reporter', process.stdin, 'pipe', process.stderr);

  var coveralls = spawn(
    path.join('node_modules', 'coveralls', 'bin', 'coveralls.js'),
    [],
    {
      stdio: ['pipe', process.stdout, process.stderr]
    }
  );
  mocha.stdout.pipe(coveralls.stdin);
}
else {
  test('nyan', process.stdin, process.stdout, process.stderr);
}
