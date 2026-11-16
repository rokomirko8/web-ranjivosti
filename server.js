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
}));

// ---------- BAZA ----------
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
addUser.run('Roko', 'Roko123', 'user',  'roko@mail.hr',  '22222222222', 'Ilica 10, Zagreb');
addUser.run('Frano',   'Frano123',   'user',  'frano@mail.hr',    '33333333333', 'Vukovarska 5, Split');

// ---------- PREKIDAČI ----------
const vuln = { xss: true, bac: true };

app.use((req, res, next) => {
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
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db
    .prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?')
    .get(username, password);

  if (!u) {
    return res.render('index', { error: 'Pogrešno korisničko ime ili lozinka' });
  }

  req.session.user = u;
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
app.get('/', (req, res) => {
  res.render('index', { error: null });
});

app.listen(PORT, (err) => {
  if (err) {
    console.error('Greška pri pokretanju servera:', err.message);
    process.exit(1);
  }
  console.log(`Server radi na http://localhost:${PORT}`);
});