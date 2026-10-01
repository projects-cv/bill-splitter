const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Run the real TypeScript modules with storage and React lifecycle boundaries controlled.
function loadModule(file, mocks) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}

const receipt = (id, total = 12) => ({
  id, storeName: `Store ${id}`, date: 'Oct 1, 2026', subtotal: 10, tax: 1, fees: 1, total,
  items: [{ id: 'item', name: 'Lunch', price: 10, assignedTo: ['person'] }],
  participants: [{ id: 'person', name: 'Casey', color: '#000000' }],
  promoDiscount: 0, promoSplitMethod: 'equal',
});

function storageModule(storage) {
  return loadModule('src/utils/receiptHistory.ts', {
    '@react-native-async-storage/async-storage': storage,
  });
}

function hookHarness(history) {
  const slots = [];
  let cursor, dirty = true, value, effects;
  const same = (a, b) => a && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, next => {
        const updated = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(updated, slots[index].value)) { slots[index].value = updated; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] || (slots[index] = { current: initial });
    },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, fn };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const { useReceiptHistory } = loadModule('src/store/useReceiptHistory.ts', {
    react, '../utils/receiptHistory': history,
  });
  return {
    get value() { return value; },
    async flush() {
      for (let i = 0; i < 20; i++) {
        if (dirty) {
          dirty = false; cursor = 0; effects = [];
          value = useReceiptHistory();
          effects.forEach(run => run());
        }
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty) return;
      }
      throw new Error('History did not settle');
    },
  };
}

test('history round trips the entire split and rejects damaged data', async () => {
  let stored = null;
  const history = storageModule({ getItem: async () => stored, setItem: async (_, value) => { stored = value; } });
  assert.deepEqual(await history.loadReceiptHistory(), []);
  const split = receipt('a');
  await history.saveReceiptHistory([split]);
  assert.deepEqual(await history.loadReceiptHistory(), [split]);
  for (const bad of ['{', '{}', '[{}]', JSON.stringify([{ ...split, items: [{ price: 'bad' }] }])]) {
    stored = bad;
    await assert.rejects(history.loadReceiptHistory());
  }
});

test('writes stay ordered and a failed write does not block later saves', async () => {
  let release;
  const writes = [];
  const history = storageModule({ setItem: async (_, value) => {
    writes.push(JSON.parse(value)[0].id);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    if (writes.length === 2) throw new Error('Storage full');
  } });
  const first = history.saveReceiptHistory([receipt('a')]);
  const second = history.saveReceiptHistory([receipt('b')]);
  const rejected = assert.rejects(second);
  const third = history.saveReceiptHistory([receipt('c')]);
  await Promise.resolve();
  assert.deepEqual(writes, ['a']);
  release();
  await Promise.all([first, rejected, third]);
  assert.deepEqual(writes, ['a', 'b', 'c']);
});

test('new splits and edits survive hydration and reload without duplicates', async () => {
  let release;
  let stored = JSON.stringify([receipt('old'), receipt('same')]);
  let writes = 0;
  const history = storageModule({
    getItem: () => new Promise(resolve => { release = () => resolve(stored); }),
    setItem: async (_, value) => { stored = value; writes++; },
  });
  const hook = hookHarness(history);
  await hook.flush();
  const edited = { ...receipt('same', 24), promoDiscount: 2, promoCode: 'SAVE' };
  hook.value.saveReceipt(edited);
  await hook.flush();
  assert.equal(writes, 0, 'do not overwrite history before it loads');
  release();
  await hook.flush();
  assert.deepEqual(hook.value.savedReceipts, [edited, receipt('old')]);
  hook.value.saveReceipt(receipt('new'));
  hook.value.saveReceipt({ ...edited, tax: 3 });
  await hook.flush();
  assert.deepEqual(hook.value.savedReceipts.map(x => x.id), ['same', 'new', 'old']);
  assert.equal(hook.value.savedReceipts[0].tax, 3);
  const reloaded = hookHarness(storageModule({ getItem: async () => stored, setItem: async () => {} }));
  await reloaded.flush();
  assert.deepEqual(reloaded.value.savedReceipts, hook.value.savedReceipts);
});

test('read and write errors are visible and can be retried without losing history', async () => {
  let failRead = true, failWrite = false, stored = JSON.stringify([receipt('old')]), writes = 0;
  const hook = hookHarness(storageModule({
    getItem: async () => { if (failRead) throw new Error('Read failed'); return stored; },
    setItem: async (_, value) => { if (failWrite) throw new Error('Write failed'); stored = value; writes++; },
  }));
  await hook.flush();
  hook.value.saveReceipt(receipt('new'));
  await hook.flush();
  assert.match(hook.value.historyError, /load/);
  assert.equal(writes, 0);
  failRead = false;
  hook.value.retryHistory();
  await hook.flush();
  assert.equal(hook.value.historyError, null);
  assert.deepEqual(hook.value.savedReceipts.map(x => x.id), ['new', 'old']);
  failWrite = true;
  hook.value.saveReceipt(receipt('new', 30));
  await hook.flush();
  assert.match(hook.value.historyError, /saved/);
  failWrite = false;
  hook.value.retryHistory();
  await hook.flush();
  assert.equal(hook.value.historyError, null);
  assert.equal(JSON.parse(stored)[0].total, 30);
});

test('tapping a real recent split selects it before navigating to Summary', () => {
  const split = receipt('saved');
  const actions = [];
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const native = new Proxy({ StyleSheet: { create: x => x } }, { get: (obj, key) => obj[key] || key });
  const { default: Dashboard } = loadModule('src/screens/DashboardScreen.tsx', {
    react, 'react-native': native, '../theme/colors': { Colors: {} }, 'lucide-react-native': {},
    '../../package.json': { version: 'test' },
    '../store/ReceiptContext': { useReceipt: () => ({ savedReceipts: [split], setReceipt: value => actions.push(value) }) },
  });
  const tree = Dashboard({ navigation: { navigate: (...args) => actions.push(args) } });
  const list = tree.props.children.find(child => child?.type === 'FlatList');
  assert.deepEqual(list.props.data, [split]);
  list.props.renderItem({ item: split }).props.onPress();
  assert.deepEqual(actions, [split, ['Summary', { receiptId: 'saved' }]]);
});
