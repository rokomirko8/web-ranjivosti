const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-tajna',
  resave: false,
  saveUninitialized: false,
  rolling: true, // kolačić se šalje u svakom odgovoru (da se HttpOnly odmah promijeni s prekidačem)
}));

// ---------- BAZA ----------
// Baza živi u memoriji i puni se pri svakom pokretanju servera.
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    email TEXT,
    oib TEXT,
    adresa TEXT
  );
  CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    author TEXT,
    text TEXT
  );
`);

const addUser = db.prepare(
  'INSERT INTO users (username, password, role, email, oib, adresa) VALUES (?, ?, ?, ?, ?, ?)'
);
addUser.run('admin', 'admin123', 'admin', 'admin@firma.hr', '11111111111', 'Unska 3, Zagreb');
addUser.run('Roko',  'Roko123',  'user',  'roko@mail.hr',   '22222222222', 'Ilica 10, Zagreb');
addUser.run('Frano', 'Frano123', 'user',  'frano@mail.hr',  '33333333333', 'Vukovarska 5, Split');

// ---------- PREKIDAČI ----------
const vuln = { xss: true, bac: true };

app.use((req, res, next) => {
  // XSS uključen  -> kolačić sesije NIJE HttpOnly, JavaScript ga vidi (document.cookie)
  // XSS isključen -> kolačić sesije je HttpOnly, JavaScript ga ne vidi
  req.session.cookie.httpOnly = !vuln.xss;
  res.locals.vuln = vuln;
  res.locals.user = req.session.user || null;
  next();
});

app.post('/toggle', (req, res) => {
  const name = req.body.name;
  if (Object.hasOwn(vuln, name)) {
    vuln[name] = req.body.on === 'on';
  }
  res.redirect('/');
});

// ---------- POMOĆNE FUNKCIJE ----------
function renderIndex(res, error = null) {
  const comments = db
    .prepare('SELECT id, author, text FROM comments ORDER BY id DESC')
    .all();
  res.render('index', { error, comments });
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// ---------- PRIJAVA ----------
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db
    .prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?')
    .get(username, password);

  if (!u) {
    return renderIndex(res, 'Pogrešno korisničko ime ili lozinka');
  }

  req.session.user = u;
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- XSS: KOMENTARI ----------
app.post('/comment', requireLogin, (req, res) => {
  const text = (req.body.text || '').slice(0, 1000);
  db.prepare('INSERT INTO comments (author, text) VALUES (?, ?)')
    .run(req.session.user.username, text);
  res.redirect('/');
});

app.post('/comments/clear', (req, res) => {
  db.prepare('DELETE FROM comments').run();
  res.redirect('/');
});

// ---------- BROKEN ACCESS CONTROL ----------
// Profil korisnika: /profil?id=2
app.get('/profil', requireLogin, (req, res) => {
  const id = Number(req.query.id);
  const me = req.session.user;

  if (!vuln.bac) {
    // SIGURNO: običan korisnik smije vidjeti samo SVOJ profil, admin sve
    if (id !== me.id && me.role !== 'admin') {
      return res.status(403).render('zabranjeno', {
        poruka: `Nemaš pravo pristupa profilu korisnika s ID-om ${req.query.id}.`,
      });
    }
  }
  // RANJIVO: nema provjere - svaki prijavljeni korisnik vidi bilo čiji profil

  const profil = db
    .prepare('SELECT id, username, role, email, oib, adresa FROM users WHERE id = ?')
    .get(id);

  if (!profil) {
    return res.status(404).render('zabranjeno', {
      poruka: `Korisnik s ID-om ${req.query.id} ne postoji.`,
    });
  }
  res.render('profil', { profil });
});

// Admin stranica: popis svih korisnika s osobnim podacima
app.get('/admin', requireLogin, (req, res) => {
  if (!vuln.bac && req.session.user.role !== 'admin') {
    // SIGURNO: samo uloga "admin" smije na ovu stranicu
    return res.status(403).render('zabranjeno', {
      poruka: 'Admin stranica dostupna je samo administratorima.',
    });
  }
  // RANJIVO: provjerava se samo je li korisnik prijavljen, ne i ima li ulogu admin

  const users = db
    .prepare('SELECT id, username, role, email, oib, adresa FROM users')
    .all();
  res.render('admin', { users });
});

// ---------- POČETNA ----------
app.get('/', (req, res) => {
  renderIndex(res);
});

app.listen(PORT, (err) => {
  if (err) {
    console.error('Greška pri pokretanju servera:', err.message);
    process.exit(1);
  }
  console.log(`Server radi na http://localhost:${PORT}`);
});
