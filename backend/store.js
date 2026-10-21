// Сховище даних у пам'яті. На наступних етапах буде замінене на БД.
const crypto = require('node:crypto');

const PHONE_RE = /^\+380\d{9}$/;
const MIN_PASSWORD_LEN = 8;

const CATEGORIES = ['книги', 'рукоділля', 'спорт', 'музика', 'настільні ігри'];

const SEED_CLUBS = [
  { id: 1, name: 'Київський книжковий клуб', category: 'книги', city: 'Київ', description: 'Щомісяця обговорюємо нову книжку.' },
  { id: 2, name: 'Клубок', category: 'рукоділля', city: 'Львів', description: "В'язання, вишивка та обмін схемами." },
  { id: 3, name: 'Ранкові пробіжки', category: 'спорт', city: 'Дніпро', description: 'Бігаємо разом по вихідних.' },
  { id: 4, name: 'Гітара на кухні', category: 'музика', city: 'Одеса', description: 'Грамо, співаємо, вчимо одне одного.' },
  { id: 5, name: 'Кубик', category: 'настільні ігри', city: 'Харків', description: 'Вечори настільних ігор для всіх.' },
];

class Store {
  constructor() {
    this.clubs = new Map(SEED_CLUBS.map((c) => [c.id, { ...c, members: new Set() }]));
    this.users = new Map(); // phone -> { phone, salt, hash }
  }

  // ----- клуби -----
  listClubs({ category, query } = {}) {
    const q = (query || '').toLowerCase();
    return [...this.clubs.values()].filter((club) => {
      if (category && club.category !== category) return false;
      if (q && !`${club.name} ${club.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  getClub(id) {
    return this.clubs.get(id);
  }

  // true — приєднався, false — уже був у клубі
  joinClub(id, phone) {
    const members = this.clubs.get(id).members;
    if (members.has(phone)) return false;
    members.add(phone);
    return true;
  }

  // ----- користувачі -----
  createUser(phone, password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 32).toString('hex');
    this.users.set(phone, { phone, salt, hash });
  }

  verifyUser(phone, password) {
    const user = this.users.get(phone);
    if (!user) return false;
    const hash = crypto.scryptSync(password, user.salt, 32);
    return crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'));
  }
}

module.exports = { Store, CATEGORIES, PHONE_RE, MIN_PASSWORD_LEN };
