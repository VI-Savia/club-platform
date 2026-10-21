const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./app');

const PHONE = '+380501234567';
const PASSWORD = 'secret123';

let server;
let base;

beforeEach(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const get = (path) => fetch(base + path);
const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const register = (phone = PHONE, password = PASSWORD) => post('/api/register', { phone, password });

describe('health', () => {
  it('повертає ok', async () => {
    const res = await get('/health');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: 'ok' });
  });

  it('віддає головну сторінку', async () => {
    const res = await get('/');
    assert.strictEqual(res.status, 200);
    await res.text();
  });
});

describe('каталог клубів', () => {
  it('повертає категорії', async () => {
    const data = await (await get('/api/categories')).json();
    assert.ok(data.includes('книги'));
  });

  it('повертає всі клуби', async () => {
    const data = await (await get('/api/clubs')).json();
    assert.strictEqual(data.length, 5);
  });

  it('фільтрує за категорією', async () => {
    const data = await (await get('/api/clubs?category=' + encodeURIComponent('спорт'))).json();
    assert.strictEqual(data.length, 1);
    assert.strictEqual(data[0].category, 'спорт');
  });

  it('шукає за ключовим словом', async () => {
    const data = await (await get('/api/clubs?q=' + encodeURIComponent("в'язання"))).json();
    assert.deepStrictEqual(data.map((c) => c.name), ['Клубок']);
  });

  it('пошук не залежить від регістру', async () => {
    const data = await (await get('/api/clubs?q=' + encodeURIComponent('КУБИК'))).json();
    assert.strictEqual(data.length, 1);
  });

  it('повертає один клуб', async () => {
    const res = await get('/api/clubs/1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).members_count, 0);
  });

  it('404 для неіснуючого клубу', async () => {
    const res = await get('/api/clubs/999');
    assert.strictEqual(res.status, 404);
    await res.json();
  });
});

describe('реєстрація', () => {
  it('створює користувача', async () => {
    const res = await register();
    assert.strictEqual(res.status, 201);
    assert.strictEqual((await res.json()).password, undefined);
  });

  it('не зберігає пароль у відкритому вигляді', async () => {
    await (await register()).json();
    const user = server.store.users.get(PHONE);
    assert.notStrictEqual(user.hash, PASSWORD);
    assert.ok(server.store.verifyUser(PHONE, PASSWORD));
    assert.ok(!server.store.verifyUser(PHONE, 'wrong-password'));
  });

  it('відхиляє неправильний телефон', async () => {
    const res = await register('12345');
    assert.strictEqual(res.status, 400);
    await res.json();
  });

  it('відхиляє короткий пароль', async () => {
    const res = await register(PHONE, '123');
    assert.strictEqual(res.status, 400);
    await res.json();
  });

  it('відхиляє дублікат', async () => {
    await (await register()).json();
    const res = await register();
    assert.strictEqual(res.status, 409);
    await res.json();
  });
});

describe('приєднання до клубу', () => {
  it('додає учасника', async () => {
    await (await register()).json();
    const res = await post('/api/clubs/1/join', { phone: PHONE });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).members_count, 1);
  });

  it('потребує реєстрації', async () => {
    const res = await post('/api/clubs/1/join', { phone: PHONE });
    assert.strictEqual(res.status, 401);
    await res.json();
  });

  it('не дозволяє приєднатися двічі', async () => {
    await (await register()).json();
    await (await post('/api/clubs/1/join', { phone: PHONE })).json();
    const res = await post('/api/clubs/1/join', { phone: PHONE });
    assert.strictEqual(res.status, 409);
    await res.json();
  });

  it('404 для неіснуючого клубу', async () => {
    await (await register()).json();
    const res = await post('/api/clubs/999/join', { phone: PHONE });
    assert.strictEqual(res.status, 404);
    await res.json();
  });
});
