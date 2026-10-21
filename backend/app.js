const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store, CATEGORIES, PHONE_RE, MIN_PASSWORD_LEN } = require('./store');

const INDEX_HTML = path.join(__dirname, '..', 'frontend', 'index.html');

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const error = (res, status, message) => send(res, status, { error: message });

function clubView(club) {
  const { members, ...rest } = club;
  return { ...rest, members_count: members.size };
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw) || {});
      } catch {
        resolve({});
      }
    });
  });
}

function createApp() {
  const store = new Store();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(INDEX_HTML).pipe(res);
    }

    if (req.method === 'GET' && pathname === '/health') {
      return send(res, 200, { status: 'ok' });
    }

    // UC-2: каталог клубів
    if (req.method === 'GET' && pathname === '/api/categories') {
      return send(res, 200, CATEGORIES);
    }

    if (req.method === 'GET' && pathname === '/api/clubs') {
      const clubs = store.listClubs({
        category: url.searchParams.get('category'),
        query: (url.searchParams.get('q') || '').trim(),
      });
      return send(res, 200, clubs.map(clubView));
    }

    const clubMatch = pathname.match(/^\/api\/clubs\/(\d+)(\/join)?$/);
    if (clubMatch) {
      const id = Number(clubMatch[1]);
      const club = store.getClub(id);
      const isJoin = Boolean(clubMatch[2]);

      if (!isJoin && req.method === 'GET') {
        if (!club) return error(res, 404, 'Клуб не знайдено');
        return send(res, 200, clubView(club));
      }

      if (isJoin && req.method === 'POST') {
        const { phone = '' } = await readJson(req);
        if (!club) return error(res, 404, 'Клуб не знайдено');
        if (!store.users.has(phone)) return error(res, 401, 'Спочатку зареєструйтесь');
        if (!store.joinClub(id, phone)) return error(res, 409, 'Ви вже є учасником цього клубу');
        return send(res, 200, clubView(club));
      }
    }

    // UC-1: реєстрація
    if (req.method === 'POST' && pathname === '/api/register') {
      const { phone = '', password = '' } = await readJson(req);
      if (!PHONE_RE.test(phone)) {
        return error(res, 400, 'Номер телефону має бути у форматі +380XXXXXXXXX');
      }
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN) {
        return error(res, 400, `Пароль має містити щонайменше ${MIN_PASSWORD_LEN} символів`);
      }
      if (store.users.has(phone)) return error(res, 409, 'Користувач з таким номером уже існує');

      store.createUser(phone, password); // зберігається лише хеш
      return send(res, 201, { phone });
    }

    return error(res, 404, 'Не знайдено');
  });

  server.store = store;
  return server;
}

module.exports = { createApp };
