// Local visual preview only. The JSON below is sample data and never touches the database.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const players = [
  { id: 1, full_name: 'James Mwangi', jersey_number: 10, position: 'Forward' },
  { id: 2, full_name: 'Brian Otieno', jersey_number: 7, position: 'Midfielder' },
  { id: 3, full_name: 'Kevin Njogo', jersey_number: 11, position: 'Defender' },
  { id: 4, full_name: 'Felix Omondi', jersey_number: 8, position: 'Midfielder' },
  { id: 5, full_name: 'Samuel Kamau', jersey_number: 4, position: 'Defender' },
  { id: 6, full_name: 'Martin Ochieng', jersey_number: 1, position: 'Goalkeeper' }
].map(player => ({ ...player, photo: null, team: 'Los Blancos FC' }));
const stats = players.map((player, index) => ({
  ...player, appearances: 12 - index, goals: [8, 4, 2, 3, 1, 0][index],
  assists: [3, 6, 1, 4, 0, 0][index], yellow_cards: index % 3, red_cards: 0
}));
const home = {
  settings: {
    club_name: 'Los Blancos FC', tagline: 'Dream • Play • Conquer',
    hero_background: '/assets/home-background.jpg', logo_url: ''
  },
  nextMatches: [{ id: 11, opponent_name: 'Riverside FC', opponent_logo: '', competition: 'LEAGUE FIXTURE', match_date: '2026-10-24', match_time: '16:00:00', venue: 'Greenwood Stadium', status: 'scheduled' }],
  results: [
    { id: 7, opponent_name: 'Unity FC', match_date: '2026-09-20', home_score: 2, away_score: 1 },
    { id: 6, opponent_name: 'Riverside FC', match_date: '2026-09-13', home_score: 3, away_score: 0 }
  ],
  players,
  news: [{ id: 1, title: 'A new chapter begins', excerpt: 'The squad looks ahead to another season of ambition and growth.', published_at: '2026-09-21' }]
};
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/auth/me') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"Preview mode"}'); }
  if (url.pathname === '/api/public/home') return json(res, home);
  if (url.pathname === '/api/public/stats') return json(res, stats);
  if (url.pathname === '/api/public/players') return json(res, players);
  const clean = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(root, clean || 'index.html');
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Preview file not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(3177, '127.0.0.1', () => console.log('Los Blancos visual preview at http://127.0.0.1:3177'));

function json(res, value) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
