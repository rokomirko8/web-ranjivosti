# Web ranjivosti – XSS i Broken Access Control

Web-aplikacija s dvije namjerno ugrađene ranjivosti koje se uključuju i isključuju prekidačem (checkbox) u sučelju:

1. **Cross-site scripting (XSS)** – pohranjeni (stored) XSS kroz komentare
2. **Loša kontrola pristupa (Broken Access Control)** – IDOR na profilima i nezaštićena admin stranica

## Pokretanje lokalno

Potreban je Node.js 22 ili noviji.

```
npm install
npm start
```

Aplikacija se otvara na http://localhost:3000

Baza (SQLite) je u memoriji i puni se pri svakom pokretanju, pa svaki restart vraća početno stanje.

## Testni korisnici

| Korisnik | Lozinka  | ID | Uloga |
|----------|----------|----|-------|
| admin    | admin123 | 1  | admin |
| Roko     | Roko123  | 2  | user  |
| Frano    | Frano123 | 3  | user  |

## Testiranje

### XSS
1. Prijavi se (npr. Frano / Frano123), prekidač XSS uključen.
2. Objavi komentar `<script>alert(document.cookie)</script>`.
3. Iskoči dijalog s kolačićem sesije (`connect.sid=...`). Isto se dogodi svakom drugom korisniku koji otvori stranicu.
4. Isključi prekidač – isti komentar prikazuje se kao običan tekst, a kolačić sesije postaje HttpOnly.

### Broken Access Control
1. Prijavi se kao Roko / Roko123, prekidač uključen.
2. Otvori profil s ID-om 3 ili 1 – vide se tuđi osobni podaci (e-mail, OIB, adresa).
3. Otvori „Admin stranica” – običan korisnik vidi popis svih korisnika.
4. Isključi prekidač – tuđi profil i admin stranica vraćaju „403 Pristup odbijen”; vlastiti profil i dalje radi, a admin vidi sve.
