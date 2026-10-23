const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../backend-config.js'), 'utf8');

test('static hosting defaults to the hosted API', () => {
  let saved = null;
  vm.runInNewContext(source, {localStorage: {
    getItem: () => saved, setItem: (key, value) => { saved = value; }
  }});
  assert.equal(saved, 'https://aisgk.onrender.com/api');
});

test('explicit classroom backend is preserved', () => {
  let saved = 'http://school-lan/api';
  vm.runInNewContext(source, {localStorage: {
    getItem: () => saved, setItem: (key, value) => { saved = value; }
  }});
  assert.equal(saved, 'http://school-lan/api');
});

test('blocked browser storage does not stop initialization', () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, {
    localStorage: {getItem() { throw Error('storage disabled'); }}
  }));
});
