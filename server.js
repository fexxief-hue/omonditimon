const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const db = require('./db');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const isProduction = process.env.NODE_ENV === 'production';

const uploadsRoot = path.join(__dirname, 'public', 'uploads');
const playerUploads = path.join(uploadsRoot, 'players');
const mediaUploads = path.join(uploadsRoot, 'media');
for (const dir of [uploadsRoot, playerUploads, mediaUploads]) {
  fs.mkdirSync(dir, { recursive: true });
}

const useCloudinary =
  process.env.MEDIA_STORAGE === 'cloudinary';

if (useCloudinary) {
  let credentials = null;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    credentials = {
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    };
  } else if (process.env.CLOUDINARY_URL) {
    try {
      const parsed = new URL(process.env.CLOUDINARY_URL.trim());
      const cloudName = decodeURIComponent(parsed.hostname);
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);
      if (
        parsed.protocol !== 'cloudinary:' ||
        !cloudName || !apiKey || !apiSecret ||
        /API_KEY|API_SECRET|CLOUD_NAME|CHANGE_THIS/i.test(process.env.CLOUDINARY_URL)
      ) throw new Error('Invalid Cloudinary URL');
      credentials = { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
    } catch (_) {
      throw new Error('CLOUDINARY_URL is missing or invalid. Set a real Cloudinary URL in the service environment.');
    }
  }

  if (!credentials) {
    throw new Error('MEDIA_STORAGE=cloudinary requires CLOUDINARY_URL or all three Cloudinary credential fields.');
  }

  cloudinary.config({ ...credentials, secure: true });
}

const localStorage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(
      null,
      file.fieldname === 'photo'
        ? playerUploads
        : mediaUploads
    ),

  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase() ||
      '.jpg';

    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
    );
  }
});

const cloudinaryStorage = {
  _handleFile(req, file, cb) {
    const folder =
      file.fieldname === 'photo'
        ? 'losblancosfc/players'
        : 'losblancosfc/media';

    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) return cb(error);

          cb(null, {
            destination: 'cloudinary',
            filename: result.public_id,
            path: result.secure_url,
            size: result.bytes,
            mimetype: file.mimetype,
            cloudinaryPublicId: result.public_id,
            cloudinarySecureUrl: result.secure_url
          });
        }
      );

    file.stream.pipe(stream);
  },

  _removeFile(req, file, cb) {
    if (!file.cloudinaryPublicId) {
      return cb(null);
    }

    cloudinary.uploader.destroy(
      file.cloudinaryPublicId,
      { resource_type: 'image' },
      () => cb(null)
    );
  }
};

const storage = useCloudinary
  ? cloudinaryStorage
  : localStorage;

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          'Only JPG, PNG, WEBP or GIF images are allowed.'
        )
      );
    }

    cb(null, true);
  }
});

const publicFile = file => {
  if (!file) return null;

  if (useCloudinary) {
    return file.cloudinarySecureUrl || file.path || null;
  }

  return `/uploads/${file.destination.endsWith(path.sep + 'players') ? 'players' : 'media'}/${file.filename}`;
};
const removePublicFile = url => {
  if (!url) return;

  // Cloudinary URLs cannot be removed from the local filesystem.
  // Their public_id is handled separately by the upload storage cleanup.
  if (String(url).startsWith('http://') || String(url).startsWith('https://')) {
    return;
  }

  if (!String(url).startsWith('/uploads/')) return;

  const file = path.join(
    __dirname,
    'public',
    String(url).replace(/^\//, '')
  );

  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (_) {}
};

function issueAuth(res, user) {
  const token = jwt.sign(
    {
      id: Number(user.id),
      role: String(user.role),
      email: String(user.email)
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('lbfc_auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return token;
}

function auth(req, res, next) {
  try {
    const token = req.cookies.lbfc_auth;
    if (!token) return res.status(401).json({ error: 'Login required' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}
function ownerOnly(req, res, next) {
  if (req.user?.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
  next();
}
function playerOnly(req, res, next) {
  if (req.user?.role !== 'player') return res.status(403).json({ error: 'Player access required' });
  next();
}
function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function cleanDate(value) { return value ? String(value).slice(0, 10) : null; }
async function audit(userId, action, entityType, entityId, details = '') {
  try {
    await db.query(`INSERT INTO audit_logs (user_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)`, [userId || null, action, entityType || null, entityId || null, details || null]);
  } catch (_) {}
}
async function notify(userId, type, title, message, link = null) {
  if (!userId) return;
  await db.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`, [userId, type, title, message, link]);
}

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT 1 AS ok');
    res.json({ ok: row.ok === 1, service: 'Los Blancos FC', time: new Date().toISOString() });
  } catch (e) { res.status(503).json({ ok: false, error: 'Database unavailable' }); }
});

app.post('/api/auth/register', upload.single('photo'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { email, password, full_name, jersey_number, position, date_of_birth, preferred_foot, phone, bio } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const name = String(full_name || '').trim();
    if (!cleanEmail || !name || !password) {
      if (req.file) removePublicFile(publicFile(req.file));
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      if (req.file) removePublicFile(publicFile(req.file));
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const [[existing]] = await conn.query(`SELECT id FROM users WHERE email=? LIMIT 1`, [cleanEmail]);
    if (existing) {
      if (req.file) removePublicFile(publicFile(req.file));
      return res.status(409).json({ error: 'That email is already registered.' });
    }
    const [pending] = await conn.query(`SELECT id FROM player_applications WHERE email=? AND status='pending' LIMIT 1`, [cleanEmail]);
    if (pending.length) {
      if (req.file) removePublicFile(publicFile(req.file));
      return res.status(409).json({ error: 'A player request already exists for this email.' });
    }
    await conn.beginTransaction();
    const hash = await bcrypt.hash(password, 12);
    const [userResult] = await conn.query(`INSERT INTO users (email,password_hash,role) VALUES (?,?, 'player')`, [cleanEmail, hash]);
    const photo = publicFile(req.file);
    await conn.query(`INSERT INTO player_applications (user_id,email,full_name,photo,jersey_number,position,date_of_birth,preferred_foot,phone,bio,team,status) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'pending')`, [userResult.insertId, cleanEmail, name, photo, cleanNumber(jersey_number), position || null, cleanDate(date_of_birth), preferred_foot || null, phone || null, bio || null, 'Los Blancos FC']);
    const [[ownerUser]] = await conn.query(`SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1`);
    if (ownerUser) {
      await conn.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`, [ownerUser.id, 'player_request', 'New player request', `${name} has submitted a player registration request.`, '#owner/requests']);
    }
    await conn.commit();
    issueAuth(res, { id: userResult.insertId, email: cleanEmail, role: 'player' });
    await audit(userResult.insertId, 'register', 'player_application', null, `${name} submitted a registration request`);
    res.status(201).json({ message: 'Registration submitted. The owner has been notified and must approve your profile.', user: { id: userResult.insertId, email: cleanEmail, role: 'player' } });
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    if (req.file) removePublicFile(publicFile(req.file));
    console.error('REGISTER ERROR', e);
    res.status(500).json({ error: 'Registration failed.' });
  } finally { conn.release(); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const [rows] = await db.query(
      `SELECT id,email,password_hash,role,player_id
       FROM users
       WHERE email=?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      String(user.password_hash || '')
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    issueAuth(res, user);

    return res.status(200).json({
      user: {
        id: Number(user.id),
        email: String(user.email),
        role: String(user.role),
        playerId:
          user.player_id === null || user.player_id === undefined
            ? null
            : Number(user.player_id)
      }
    });

  } catch (e) {
    console.error('LOGIN ERROR:', e);
    return res.status(500).json({
      error: 'Login failed.',
      details: e.message
    });
  }
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('lbfc_auth'); res.json({ message: 'Logged out.' }); });
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const [[user]] = await db.query(`SELECT id,email,role,player_id FROM users WHERE id=?`, [req.user.id]);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user });
  } catch (e) { res.status(500).json({ error: 'Could not load account.' }); }
});

app.get('/api/public/home', async (req, res) => {
  try {
    const [[settings]] = await db.query(`SELECT COALESCE(MAX(CASE WHEN setting_key='club_name' THEN setting_value END),'Los Blancos FC') club_name, COALESCE(MAX(CASE WHEN setting_key='tagline' THEN setting_value END),'Discipline Ã¢â‚¬Â¢ Unity Ã¢â‚¬Â¢ Victory') tagline, COALESCE(MAX(CASE WHEN setting_key='hero_background' THEN setting_value END),'') hero_background, COALESCE(MAX(CASE WHEN setting_key='logo_url' THEN setting_value END),'') logo_url, COALESCE(MAX(CASE WHEN setting_key='intro_video_url' THEN setting_value END),'') intro_video_url FROM site_settings`);
    const [nextMatches] = await db.query(`SELECT m.*, t.team_name opponent_name, t.logo opponent_logo FROM matches m LEFT JOIN teams t ON t.id=m.opponent_id WHERE m.match_date >= CURDATE() AND m.status IN ('scheduled','live') ORDER BY m.match_date,m.match_time LIMIT 3`);
    const [results] = await db.query(`SELECT m.*, t.team_name opponent_name,t.logo opponent_logo FROM matches m LEFT JOIN teams t ON t.id=m.opponent_id WHERE m.status='finished' ORDER BY m.match_date DESC,m.match_time DESC LIMIT 5`);
    const [players] = await db.query(`SELECT id,full_name,photo,jersey_number,position,team FROM players WHERE approval_status='approved' ORDER BY jersey_number LIMIT 6`);
    const [news] = await db.query(`SELECT id,title,excerpt,image,published_at FROM news WHERE status='published' ORDER BY published_at DESC,id DESC LIMIT 4`);
    const leadershipMatches = [...nextMatches, ...results];
    let captain = null;
    let viceCaptain = null;
    let leadershipMatch = null;
    for (const match of leadershipMatches) {
      const [leaders] = await db.query(
        `SELECT ml.leadership_role, p.id, p.full_name, p.photo, p.jersey_number, p.position
        FROM match_lineups ml INNER JOIN players p ON p.id=ml.player_id
        WHERE ml.match_id=? AND ml.is_starter=1
          AND ml.leadership_role IN ('captain','vice_captain')
        ORDER BY ml.leadership_role
      `, [match.id]);
      captain = leaders.find(x => x.leadership_role === 'captain') || null;
      viceCaptain = leaders.find(x => x.leadership_role === 'vice_captain') || null;
      if (captain || viceCaptain) { leadershipMatch = match; break; }
    }
    res.json({ settings, nextMatches, results, players, news, captain, viceCaptain, leadershipMatch });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load homepage.' }); }
});
app.get('/api/public/players', async (req, res) => {
  const [rows] = await db.query(`SELECT id,full_name,photo,jersey_number,position,date_of_birth,preferred_foot,bio,team,joined_at FROM players WHERE approval_status='approved' ORDER BY jersey_number,full_name`);
  res.json(rows);
});
app.get('/api/public/players/:id', async (req, res) => {
  const [[player]] = await db.query(`SELECT id,full_name,photo,jersey_number,position,date_of_birth,preferred_foot,bio,team,joined_at FROM players WHERE id=? AND approval_status='approved'`, [req.params.id]);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  const [[stats]] = await db.query(`SELECT COALESCE(SUM(appearances),0) appearances,COALESCE(SUM(goals),0) goals,COALESCE(SUM(assists),0) assists,COALESCE(SUM(yellow_cards),0) yellow_cards,COALESCE(SUM(red_cards),0) red_cards FROM player_match_stats WHERE player_id=?`, [req.params.id]);
  res.json({ player, stats });
});
app.get('/api/public/teams', async (req,res)=>{ const [rows]=await db.query(`SELECT * FROM teams ORDER BY team_name`); res.json(rows); });
app.get('/api/public/matches', async (req,res)=>{ const [rows]=await db.query(`SELECT m.*,t.team_name opponent_name,t.logo opponent_logo FROM matches m LEFT JOIN teams t ON t.id=m.opponent_id ORDER BY m.match_date DESC,m.match_time DESC`); res.json(rows); });
app.get('/api/public/matches/:id', async (req,res)=>{
  const [[match]] = await db.query(`SELECT m.*,t.team_name opponent_name,t.logo opponent_logo FROM matches m LEFT JOIN teams t ON t.id=m.opponent_id WHERE m.id=?`, [req.params.id]);
  if (!match) return res.status(404).json({ error:'Match not found.' });
  const [lineup] = await db.query(`SELECT ml.*,p.full_name,p.photo,p.jersey_number player_jersey_number,p.position player_position FROM match_lineups ml INNER JOIN players p ON p.id=ml.player_id WHERE ml.match_id=? ORDER BY ml.is_starter DESC,p.jersey_number`, [req.params.id]);
  const [stats] = await db.query(`SELECT s.*,p.full_name,p.jersey_number,p.position FROM player_match_stats s INNER JOIN players p ON p.id=s.player_id WHERE s.match_id=? ORDER BY s.goals DESC,s.assists DESC,p.jersey_number`, [req.params.id]);
  const [media] = await db.query(`SELECT * FROM media WHERE match_id=? ORDER BY created_at DESC`, [req.params.id]);
  res.json({match,lineup,stats,media});
});
app.get('/api/public/stats', async (req,res)=>{
  const [players] = await db.query(`SELECT p.id,p.full_name,p.photo,p.jersey_number,p.position,COALESCE(SUM(s.appearances),0) appearances,COALESCE(SUM(s.goals),0) goals,COALESCE(SUM(s.assists),0) assists,COALESCE(SUM(s.yellow_cards),0) yellow_cards,COALESCE(SUM(s.red_cards),0) red_cards FROM players p LEFT JOIN player_match_stats s ON s.player_id=p.id WHERE p.approval_status='approved' GROUP BY p.id ORDER BY goals DESC,assists DESC`);
  res.json(players);
});
app.get('/api/public/news', async (req,res)=>{ const [rows]=await db.query(`SELECT id,title,excerpt,body,image,status,published_at,created_at FROM news WHERE status='published' ORDER BY published_at DESC,id DESC`); res.json(rows); });
app.get('/api/public/news/:id', async (req,res)=>{ const [[row]]=await db.query(`SELECT * FROM news WHERE id=? AND status='published'`,[req.params.id]); if(!row) return res.status(404).json({error:'News item not found.'}); res.json(row); });
app.get('/api/public/media', async (req,res)=>{ try { const type=['gallery','match','background','logo'].includes(String(req.query.type||'')) ? String(req.query.type) : null; const [rows]=await db.query(type ? `SELECT * FROM media WHERE media_type=? ORDER BY created_at DESC` : `SELECT * FROM media ORDER BY created_at DESC`, type ? [type] : []); res.json(rows); } catch(e){ res.status(500).json({error:'Could not load media.'}); } });

app.get('/api/owner/dashboard', auth, ownerOnly, async (req,res)=>{
  const [[counts]] = await db.query(`SELECT (SELECT COUNT(*) FROM players WHERE approval_status='approved') active_players,(SELECT COUNT(*) FROM matches WHERE status='scheduled') upcoming_matches,(SELECT COUNT(*) FROM player_applications WHERE status='pending') pending_requests,(SELECT COUNT(*) FROM matches WHERE status='finished') results_count,(SELECT COUNT(*) FROM news WHERE status='published') published_news`);
  const [requests] = await db.query(`SELECT id,full_name,email,position,created_at,status FROM player_applications WHERE status='pending' ORDER BY created_at DESC LIMIT 5`);
  const [notifications] = await db.query(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 8`, [req.user.id]);
  res.json({ counts, requests, notifications });
});

app.get('/api/owner/applications', auth, ownerOnly, async (req,res)=>{ const [rows]=await db.query(`SELECT a.*,u.email account_email FROM player_applications a LEFT JOIN users u ON u.id=a.user_id ORDER BY FIELD(a.status,'pending','approved','rejected'),a.created_at DESC`); res.json(rows); });
app.get('/api/owner/applications/pending-count', auth, ownerOnly, async (req,res)=>{ const [[row]]=await db.query(`SELECT COUNT(*) count FROM player_applications WHERE status='pending'`); res.json({count:Number(row.count)}); });
app.post('/api/owner/applications/:id/approve', auth, ownerOnly, async (req,res)=>{
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const [[application]]=await conn.query(`SELECT * FROM player_applications WHERE id=? FOR UPDATE`,[req.params.id]);
    if(!application){await conn.rollback();return res.status(404).json({error:'Request not found.'});}
    let playerId;
    const [[existing]] = await conn.query(`SELECT id FROM players WHERE user_id=?`,[application.user_id]);
    if(existing){ playerId=existing.id; await conn.query(`UPDATE players SET full_name=?,photo=?,jersey_number=?,position=?,date_of_birth=?,preferred_foot=?,phone=?,bio=?,team=?,approval_status='approved',joined_at=COALESCE(joined_at,CURDATE()) WHERE id=?`,[application.full_name,application.photo,application.jersey_number,application.position,application.date_of_birth,application.preferred_foot,application.phone,application.bio,application.team||'Los Blancos FC',playerId]); }
    else { const [r]=await conn.query(`INSERT INTO players (user_id,full_name,photo,jersey_number,position,date_of_birth,preferred_foot,phone,bio,team,approval_status,joined_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'approved',CURDATE())`,[application.user_id,application.full_name,application.photo,application.jersey_number,application.position,application.date_of_birth,application.preferred_foot,application.phone,application.bio,application.team||'Los Blancos FC']); playerId=r.insertId; }
    await conn.query(`UPDATE users SET player_id=? WHERE id=?`,[playerId,application.user_id]);
    await conn.query(`UPDATE player_applications SET status='approved',reviewed_by=?,reviewed_at=NOW() WHERE id=?`,[req.user.id,application.id]);
    await conn.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`,[application.user_id,'approval','Profile approved','Your Los Blancos FC player profile has been approved.','#player/profile']);
    await conn.commit(); await audit(req.user.id,'approve','player_application',application.id,application.full_name); res.json({message:'Player approved.',playerId});
  }catch(e){try{await conn.rollback();}catch(_){} console.error(e);res.status(500).json({error:'Approval failed.'});}finally{conn.release();}
});
app.post('/api/owner/applications/:id/reject', auth, ownerOnly, async (req,res)=>{
  try{ const [[a]]=await db.query(`SELECT user_id,full_name FROM player_applications WHERE id=?`,[req.params.id]); if(!a)return res.status(404).json({error:'Request not found.'}); await db.query(`UPDATE player_applications SET status='rejected',reviewed_by=?,reviewed_at=NOW() WHERE id=?`,[req.user.id,req.params.id]); await notify(a.user_id,'rejection','Application update','Your player application was not approved at this time.','#player/profile'); await audit(req.user.id,'reject','player_application',req.params.id,a.full_name); res.json({message:'Application rejected.'}); }catch(e){res.status(500).json({error:'Rejection failed.'});}
});

app.get('/api/owner/contributions', auth, ownerOnly, async (req,res)=>{
  try{
    const [contributions]=await db.query(`SELECT c.id,c.player_id,CASE WHEN p.id IS NULL THEN c.contributor_name ELSE p.full_name END contributor_name,CASE WHEN p.id IS NULL THEN 0 ELSE 1 END is_registered,c.amount,c.currency_code,c.contribution_date,c.note,c.created_at,u.email recorded_by_email FROM contributions c LEFT JOIN players p ON p.id=c.player_id LEFT JOIN users u ON u.id=c.recorded_by ORDER BY c.contribution_date DESC,c.id DESC`);
    const [registeredPlayers]=await db.query(`SELECT p.id,p.full_name,p.jersey_number FROM players p INNER JOIN users u ON u.id=p.user_id AND u.player_id=p.id AND u.role='player' WHERE p.approval_status='approved' ORDER BY p.full_name`);
    res.json({contributions,registeredPlayers});
  }catch(e){console.error('CONTRIBUTIONS LIST ERROR:',e);res.status(500).json({error:'Could not load the contribution ledger.'});}
});
app.post('/api/owner/contributions', auth, ownerOnly, async (req,res)=>{
  const amount=Number(req.body.amount);
  const playerId=req.body.player_id?Number(req.body.player_id):null;
  const currencyCode=String(req.body.currency_code||'KES').trim().toUpperCase();
  const contributionDate=String(req.body.contribution_date||'').slice(0,10);
  const note=String(req.body.note||'').trim().slice(0,500)||null;
  if(!Number.isFinite(amount)||amount<=0||amount>9999999999)return res.status(400).json({error:'Enter a contribution amount greater than zero.'});
  if(!/^[A-Z]{3}$/.test(currencyCode))return res.status(400).json({error:'Use a three-letter currency code.'});
  const parsedDate=new Date(`${contributionDate}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(contributionDate)||Number.isNaN(parsedDate.valueOf())||parsedDate.toISOString().slice(0,10)!==contributionDate)return res.status(400).json({error:'Choose a valid contribution date.'});
  try{
    let contributorName=String(req.body.contributor_name||'').trim().slice(0,190);
    let registeredPlayer=null;
    if(playerId){
      if(!Number.isInteger(playerId)||playerId<1)return res.status(400).json({error:'Choose a valid registered player.'});
      const [[player]]=await db.query(`SELECT p.id,p.full_name,u.id user_id FROM players p INNER JOIN users u ON u.id=p.user_id AND u.player_id=p.id AND u.role='player' WHERE p.id=? AND p.approval_status='approved'`,[playerId]);
      if(!player)return res.status(400).json({error:'Choose an approved, registered player.'});
      registeredPlayer=player;
      contributorName=player.full_name;
    }else if(!contributorName){
      return res.status(400).json({error:'Enter the contributor’s name for an unregistered contributor.'});
    }
    const conn=await db.getConnection();
    let result;
    try{
      await conn.beginTransaction();
      [result]=await conn.query(`INSERT INTO contributions (player_id,contributor_name,amount,currency_code,contribution_date,note,recorded_by) VALUES (?,?,?,?,?,?,?)`,[playerId,contributorName,amount.toFixed(2),currencyCode,contributionDate,note,req.user.id]);
      if(registeredPlayer){
        const paymentText=`${currencyCode} ${amount.toFixed(2)}`;
        const playerMessage=`Your ${paymentText} payment was successfully recorded in the club ledger. You’re helping keep the squad fueled and focused—our striker says thanks (he usually only talks to the ball). ⚽😄`;
        await conn.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`,[registeredPlayer.user_id,'contribution_received','Payment received successfully!',playerMessage,'#/player/contributions']);
      }
      await conn.commit();
    }catch(e){try{await conn.rollback();}catch(_){}throw e;}finally{conn.release();}
    await audit(req.user.id,'create','contribution',result.insertId,`${contributorName} · ${currencyCode} ${amount.toFixed(2)}`);
    res.status(201).json({message:registeredPlayer?'Contribution recorded; the player has been notified.':'Contribution recorded.',contributionId:result.insertId});
  }catch(e){console.error('CONTRIBUTION CREATE ERROR:',e);res.status(500).json({error:'Could not record the contribution.'});}
});
app.delete('/api/owner/contributions/:id', auth, ownerOnly, async (req,res)=>{
  try{
    const [[row]]=await db.query(`SELECT contributor_name,amount,currency_code FROM contributions WHERE id=?`,[req.params.id]);
    if(!row)return res.status(404).json({error:'Contribution not found.'});
    await db.query(`DELETE FROM contributions WHERE id=?`,[req.params.id]);
    await audit(req.user.id,'delete','contribution',req.params.id,`${row.contributor_name} · ${row.currency_code} ${row.amount}`);
    res.json({message:'Contribution removed from the ledger.'});
  }catch(e){console.error('CONTRIBUTION DELETE ERROR:',e);res.status(500).json({error:'Could not remove the contribution.'});}
});
app.get('/api/owner/notification-recipients', auth, ownerOnly, async (req,res)=>{
  try{
    const [rows]=await db.query(`SELECT p.id,p.full_name,p.jersey_number,u.email FROM players p INNER JOIN users u ON u.id=p.user_id AND u.player_id=p.id AND u.role='player' WHERE p.approval_status='approved' ORDER BY p.full_name`);
    res.json(rows);
  }catch(e){console.error('NOTIFICATION RECIPIENTS ERROR:',e);res.status(500).json({error:'Could not load registered players.'});}
});
app.post('/api/owner/notifications/send', auth, ownerOnly, async (req,res)=>{
  const title=String(req.body.title||'').trim().slice(0,255);
  const message=String(req.body.message||'').trim();
  const audience=req.body.audience==='all'?'all':'selected';
  if(!title||!message)return res.status(400).json({error:'Enter a notification title and message.'});
  if(message.length>5000)return res.status(400).json({error:'Keep the notification under 5,000 characters.'});
  try{
    let recipients=[];
    if(audience==='all'){
      [recipients]=await db.query(`SELECT u.id user_id,p.id player_id,p.full_name FROM players p INNER JOIN users u ON u.id=p.user_id AND u.player_id=p.id AND u.role='player' WHERE p.approval_status='approved' ORDER BY p.full_name`);
    }else{
      const playerIds=[...new Set((Array.isArray(req.body.player_ids)?req.body.player_ids:[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
      if(!playerIds.length)return res.status(400).json({error:'Select at least one registered player.'});
      const placeholders=playerIds.map(()=>'?').join(',');
      [recipients]=await db.query(`SELECT u.id user_id,p.id player_id,p.full_name FROM players p INNER JOIN users u ON u.id=p.user_id AND u.player_id=p.id AND u.role='player' WHERE p.approval_status='approved' AND p.id IN (${placeholders}) ORDER BY p.full_name`,playerIds);
      if(recipients.length!==playerIds.length)return res.status(400).json({error:'One or more selected players are not registered and approved.'});
    }
    if(!recipients.length)return res.status(400).json({error:'There are no registered, approved players to notify.'});
    const conn=await db.getConnection();
    try{
      await conn.beginTransaction();
      for(const recipient of recipients)await conn.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`,[recipient.user_id,'club_message',title,message,'#/player/notifications']);
      await conn.commit();
    }catch(e){try{await conn.rollback();}catch(_){}throw e;}finally{conn.release();}
    await audit(req.user.id,'send','player_notification',null,`${title} (${recipients.length} recipients)`);
    res.status(201).json({message:`Notification sent to ${recipients.length} registered player${recipients.length===1?'':'s'}.`,recipientCount:recipients.length});
  }catch(e){console.error('PLAYER NOTIFICATION SEND ERROR:',e);res.status(500).json({error:'Could not send the notification.'});}
});

app.get('/api/owner/players', auth, ownerOnly, async (req,res)=>{ const [rows]=await db.query(`SELECT * FROM players ORDER BY approval_status DESC,jersey_number,full_name`); res.json(rows); });
app.post('/api/owner/players', auth, ownerOnly, upload.single('photo'), async (req,res)=>{
  try{ const {full_name,jersey_number,position,date_of_birth,preferred_foot,phone,bio,team}=req.body; if(!full_name){if(req.file)removePublicFile(publicFile(req.file));return res.status(400).json({error:'Player name is required.'});} const [r]=await db.query(`INSERT INTO players (full_name,photo,jersey_number,position,date_of_birth,preferred_foot,phone,bio,team,approval_status,joined_at) VALUES (?,?,?,?,?,?,?,?,?,'approved',CURDATE())`,[full_name,publicFile(req.file),cleanNumber(jersey_number),position||null,cleanDate(date_of_birth),preferred_foot||null,phone||null,bio||null,team||'Los Blancos FC']); await audit(req.user.id,'create','player',r.insertId,full_name); res.status(201).json({message:'Player added.',playerId:r.insertId}); }catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not add player.'});}
});
app.put('/api/owner/players/:id', auth, ownerOnly, upload.single('photo'), async (req,res)=>{
  try{ const [[p]]=await db.query(`SELECT * FROM players WHERE id=?`,[req.params.id]); if(!p){if(req.file)removePublicFile(publicFile(req.file));return res.status(404).json({error:'Player not found.'});} const photo=req.file?publicFile(req.file):p.photo; await db.query(`UPDATE players SET full_name=?,photo=?,jersey_number=?,position=?,date_of_birth=?,preferred_foot=?,phone=?,bio=?,team=? WHERE id=?`,[req.body.full_name||p.full_name,photo,cleanNumber(req.body.jersey_number),req.body.position||null,cleanDate(req.body.date_of_birth),req.body.preferred_foot||null,req.body.phone||null,req.body.bio||null,req.body.team||'Los Blancos FC',req.params.id]); if(req.file&&p.photo)removePublicFile(p.photo); await audit(req.user.id,'update','player',req.params.id,req.body.full_name||p.full_name); res.json({message:'Player updated.'}); }catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not update player.'});}
});
app.delete('/api/owner/players/:id', auth, ownerOnly, async(req,res)=>{ try{const [[p]]=await db.query(`SELECT photo,full_name FROM players WHERE id=?`,[req.params.id]);if(!p)return res.status(404).json({error:'Player not found.'});await db.query(`DELETE FROM players WHERE id=?`,[req.params.id]);if(p.photo)removePublicFile(p.photo);await audit(req.user.id,'delete','player',req.params.id,p.full_name);res.json({message:'Player deleted.'});}catch(e){res.status(500).json({error:'Could not delete player.'});} });

app.get('/api/owner/teams',auth,ownerOnly,async(req,res)=>{const [rows]=await db.query(`SELECT * FROM teams ORDER BY team_name`);res.json(rows);});
app.post('/api/owner/teams',auth,ownerOnly,upload.single('logo'),async(req,res)=>{try{const [r]=await db.query(`INSERT INTO teams (team_name,short_name,logo,home_city) VALUES (?,?,?,?)`,[req.body.team_name,req.body.short_name||null,publicFile(req.file),req.body.home_city||null]);res.status(201).json({message:'Team added.',teamId:r.insertId});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not add team.'});}});
app.put('/api/owner/teams/:id',auth,ownerOnly,upload.single('logo'),async(req,res)=>{try{const [[t]]=await db.query(`SELECT * FROM teams WHERE id=?`,[req.params.id]);if(!t){if(req.file)removePublicFile(publicFile(req.file));return res.status(404).json({error:'Team not found.'});}const logo=req.file?publicFile(req.file):t.logo;await db.query(`UPDATE teams SET team_name=?,short_name=?,logo=?,home_city=? WHERE id=?`,[req.body.team_name||t.team_name,req.body.short_name||null,logo,req.body.home_city||null,req.params.id]);if(req.file&&t.logo)removePublicFile(t.logo);res.json({message:'Team updated.'});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not update team.'});}});
app.delete('/api/owner/teams/:id',auth,ownerOnly,async(req,res)=>{try{await db.query(`DELETE FROM teams WHERE id=?`,[req.params.id]);res.json({message:'Team deleted.'});}catch(e){res.status(500).json({error:'Could not delete team.'});}});

app.get('/api/owner/matches',auth,ownerOnly,async(req,res)=>{const [rows]=await db.query(`SELECT m.*,t.team_name opponent_name,t.logo opponent_logo FROM matches m LEFT JOIN teams t ON t.id=m.opponent_id ORDER BY m.match_date DESC,m.match_time DESC`);res.json(rows);});
app.post('/api/owner/matches',auth,ownerOnly,upload.single('background'),async(req,res)=>{try{const b=publicFile(req.file);const[r]=await db.query(`INSERT INTO matches (opponent_id,competition,match_date,match_time,venue,home_score,away_score,status,headline,notes,hero_background) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[cleanNumber(req.body.opponent_id),req.body.competition||null,cleanDate(req.body.match_date),req.body.match_time||null,req.body.venue||null,req.body.home_score===''?null:cleanNumber(req.body.home_score),req.body.away_score===''?null:cleanNumber(req.body.away_score),req.body.status||'scheduled',req.body.headline||null,req.body.notes||null,b]);await audit(req.user.id,'create','match',r.insertId,req.body.headline||'');res.status(201).json({message:'Match created.',matchId:r.insertId});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not create match.'});}});
app.put('/api/owner/matches/:id',auth,ownerOnly,upload.single('background'),async(req,res)=>{try{const[[m]]=await db.query(`SELECT * FROM matches WHERE id=?`,[req.params.id]);if(!m){if(req.file)removePublicFile(publicFile(req.file));return res.status(404).json({error:'Match not found.'});}const bg=req.file?publicFile(req.file):m.hero_background;await db.query(`UPDATE matches SET opponent_id=?,competition=?,match_date=?,match_time=?,venue=?,home_score=?,away_score=?,status=?,headline=?,notes=?,hero_background=? WHERE id=?`,[cleanNumber(req.body.opponent_id),req.body.competition||null,cleanDate(req.body.match_date),req.body.match_time||null,req.body.venue||null,req.body.home_score===''?null:cleanNumber(req.body.home_score),req.body.away_score===''?null:cleanNumber(req.body.away_score),req.body.status||'scheduled',req.body.headline||null,req.body.notes||null,bg,req.params.id]);if(req.file&&m.hero_background)removePublicFile(m.hero_background);await audit(req.user.id,'update','match',req.params.id,req.body.headline||'');res.json({message:'Match updated.'});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not update match.'});}});
app.delete('/api/owner/matches/:id',auth,ownerOnly,async(req,res)=>{try{const[[m]]=await db.query(`SELECT hero_background,headline FROM matches WHERE id=?`,[req.params.id]);await db.query(`DELETE FROM match_lineups WHERE match_id=?`,[req.params.id]);await db.query(`DELETE FROM player_match_stats WHERE match_id=?`,[req.params.id]);await db.query(`DELETE FROM media WHERE match_id=?`,[req.params.id]);await db.query(`DELETE FROM matches WHERE id=?`,[req.params.id]);if(m?.hero_background)removePublicFile(m.hero_background);res.json({message:'Match deleted.'});}catch(e){res.status(500).json({error:'Could not delete match.'});}});

app.get('/api/owner/matches/:matchId/lineup',auth,ownerOnly,async(req,res)=>{const [players]=await db.query(`SELECT id,full_name,photo,jersey_number,position FROM players WHERE approval_status='approved' ORDER BY jersey_number,full_name`);const[lineup]=await db.query(`SELECT * FROM match_lineups WHERE match_id=? ORDER BY is_starter DESC,position,shirt_number`,[req.params.matchId]);res.json({players,lineup});});
app.put('/api/owner/matches/:matchId/lineup',auth,ownerOnly,async(req,res)=>{
  const conn=await db.getConnection();

  try{
    const matchId=Number(req.params.matchId);
    const incoming=Array.isArray(req.body?.players)?req.body.players:[];

    if(!matchId){
      return res.status(400).json({error:'Invalid match ID.'});
    }

    const [[match]]=await conn.query(
      `SELECT id FROM matches WHERE id=?`,
      [matchId]
    );

    if(!match){
      return res.status(404).json({error:'Match not found.'});
    }

    const players=incoming
      .map(item=>({
        player_id:Number(item.player_id),
        position:item.position?String(item.position):null,
        is_starter:item.is_starter===false?0:1,
        shirt_number:cleanNumber(item.shirt_number),
        leadership_role:['captain','vice_captain'].includes(item.leadership_role)
          ? item.leadership_role
          : null
      }))
      .filter(item=>item.player_id>0);

    const ids=players.map(p=>p.player_id);

    if(new Set(ids).size!==ids.length){
      return res.status(400).json({error:'A player cannot appear more than once in the lineup.'});
    }

    if(players.filter(p=>p.is_starter===1).length!==11){
      return res.status(400).json({
        error:`A Starting XI must contain exactly 11 players. Received ${players.filter(p=>p.is_starter===1).length}.`
      });
    }

    const captainCount=players.filter(p=>p.leadership_role==='captain').length;
    const viceCaptainCount=players.filter(p=>p.leadership_role==='vice_captain').length;

    if(captainCount>1){
      return res.status(400).json({error:'Only one Captain is allowed.'});
    }

    if(viceCaptainCount>1){
      return res.status(400).json({error:'Only one Vice Captain is allowed.'});
    }

    await conn.beginTransaction();

    await conn.query(
      `DELETE FROM match_lineups WHERE match_id=?`,
      [matchId]
    );

    for(const item of players){
      await conn.query(
        `INSERT INTO match_lineups
        (match_id,player_id,position,is_starter,shirt_number,leadership_role)
        VALUES (?,?,?,?,?,?)`,
        [
          matchId,
          item.player_id,
          item.position,
          item.is_starter,
          item.shirt_number,
          item.leadership_role
        ]
      );
    }

    await conn.commit();

    await audit(
      req.user.id,
      'save',
      'lineup',
      matchId,
      `Saved ${players.length} lineup rows`
    );

    res.json({
      message:`Lineup saved successfully. ${players.filter(p=>p.is_starter===1).length} starters saved.`,
      count:players.length
    });

  }catch(e){

    try{await conn.rollback();}catch(_){}

    console.error('LINEUP SAVE ERROR:',e);

    res.status(500).json({
      error:'Could not save lineup.',
      details:e.message
    });

  }finally{
    conn.release();
  }
});
app.get('/api/owner/matches/:matchId/stats',auth,ownerOnly,async(req,res)=>{const[players]=await db.query(`SELECT id,full_name,jersey_number,position FROM players WHERE approval_status='approved' ORDER BY jersey_number,full_name`);const[stats]=await db.query(`SELECT * FROM player_match_stats WHERE match_id=?`,[req.params.matchId]);res.json({players,stats});});
app.put('/api/owner/matches/:matchId/stats',auth,ownerOnly,async(req,res)=>{const conn=await db.getConnection();try{await conn.beginTransaction();for(const item of(req.body.players||[])){const pid=Number(item.player_id);if(!pid)continue;await conn.query(`INSERT INTO player_match_stats (match_id,player_id,appearances,minutes,goals,assists,yellow_cards,red_cards) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE appearances=VALUES(appearances),minutes=VALUES(minutes),goals=VALUES(goals),assists=VALUES(assists),yellow_cards=VALUES(yellow_cards),red_cards=VALUES(red_cards)`,[req.params.matchId,pid,Number(item.appearances||0),Number(item.minutes||0),Number(item.goals||0),Number(item.assists||0),Number(item.yellow_cards||0),Number(item.red_cards||0)]);}await conn.commit();res.json({message:'Match statistics saved.'});}catch(e){try{await conn.rollback();}catch(_){}res.status(500).json({error:'Could not save statistics. Ensure the match stats unique key exists.'});}finally{conn.release();}});

app.get('/api/owner/news',auth,ownerOnly,async(req,res)=>{const[rows]=await db.query(`SELECT * FROM news ORDER BY created_at DESC`);res.json(rows);});
app.post('/api/owner/news',auth,ownerOnly,upload.single('image'),async(req,res)=>{try{const status=req.body.status==='published'?'published':'draft';const[r]=await db.query(`INSERT INTO news (title,excerpt,body,content,image,status,published_at) VALUES (?,?,?,?,?,?,?)`,[req.body.title,req.body.excerpt||null,req.body.body,req.body.body,publicFile(req.file),status,status==="published"?new Date():null]);res.status(201).json({message:'News saved.',newsId:r.insertId});}catch(e){console.error('NEWS CREATE ERROR:',e);if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not save news.',details:e.message});}});
app.put('/api/owner/news/:id',auth,ownerOnly,upload.single('image'),async(req,res)=>{try{const[[n]]=await db.query(`SELECT * FROM news WHERE id=?`,[req.params.id]);if(!n){if(req.file)removePublicFile(publicFile(req.file));return res.status(404).json({error:'News not found.'});}const image=req.file?publicFile(req.file):n.image;const status=req.body.status==='published'?'published':'draft';await db.query(`UPDATE news SET title=?,excerpt=?,body=?,content=?,image=?,status=?,published_at=? WHERE id=?`,[req.body.title||n.title,req.body.excerpt||null,req.body.body||n.body,req.body.body||n.body,image,status,status==="published"?(n.published_at||new Date()):null,req.params.id]);if(req.file&&n.image)removePublicFile(n.image);res.json({message:'News updated.'});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not update news.'});}});
app.delete('/api/owner/news/:id',auth,ownerOnly,async(req,res)=>{try{const[[n]]=await db.query(`SELECT image FROM news WHERE id=?`,[req.params.id]);await db.query(`DELETE FROM news WHERE id=?`,[req.params.id]);if(n?.image)removePublicFile(n.image);res.json({message:'News deleted.'});}catch(e){res.status(500).json({error:'Could not delete news.'});}});

app.get('/api/owner/media',auth,ownerOnly,async(req,res)=>{const[rows]=await db.query(`SELECT m.*,t.team_name FROM media m LEFT JOIN matches mt ON mt.id=m.match_id LEFT JOIN teams t ON t.id=mt.opponent_id ORDER BY m.created_at DESC`);res.json(rows);});
app.post('/api/owner/media',auth,ownerOnly,upload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Choose an image first.'});const type=['background','match','gallery','logo'].includes(req.body.media_type)?req.body.media_type:'gallery';const matchId=cleanNumber(req.body.match_id);const filePath=publicFile(req.file);const[r]=await db.query(`INSERT INTO media (title,file_path,media_type,match_id,is_active) VALUES (?,?,?,?,0)`,[req.body.title||req.file.originalname,filePath,type,matchId]);res.status(201).json({message:'Media uploaded.',mediaId:r.insertId});}catch(e){if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not upload media.'});}});
app.post('/api/owner/media/:id/activate',auth,ownerOnly,async(req,res)=>{const conn=await db.getConnection();try{const[[m]]=await conn.query(`SELECT * FROM media WHERE id=?`,[req.params.id]);if(!m)return res.status(404).json({error:'Media not found.'});await conn.beginTransaction();if(m.media_type==='background')await conn.query(`UPDATE media SET is_active=0 WHERE media_type='background'`);await conn.query(`UPDATE media SET is_active=1 WHERE id=?`,[m.id]);if(m.media_type==='background')await conn.query(`INSERT INTO site_settings (setting_key,setting_value) VALUES ('hero_background',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,[m.file_path]);
if(m.media_type==='logo')await conn.query(`INSERT INTO site_settings (setting_key,setting_value) VALUES ('logo_url',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,[m.file_path]);await conn.commit();res.json({message:'Media activated.'});}catch(e){try{await conn.rollback();}catch(_){}res.status(500).json({error:'Could not activate media.'});}finally{conn.release();}});
app.delete('/api/owner/media/:id',auth,ownerOnly,async(req,res)=>{try{const[[m]]=await db.query(`SELECT file_path FROM media WHERE id=?`,[req.params.id]);await db.query(`DELETE FROM media WHERE id=?`,[req.params.id]);if(m?.file_path)removePublicFile(m.file_path);res.json({message:'Media deleted.'});}catch(e){res.status(500).json({error:'Could not delete media.'});}});

app.get('/api/owner/settings',auth,ownerOnly,async(req,res)=>{const[rows]=await db.query(`SELECT setting_key,setting_value FROM site_settings ORDER BY setting_key`);const obj={};rows.forEach(r=>obj[r.setting_key]=r.setting_value);res.json(obj);});
app.put('/api/owner/settings',auth,ownerOnly,async(req,res)=>{try{for(const[key,value]of Object.entries(req.body||{})){await db.query(`INSERT INTO site_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,[key,String(value??'')]);}res.json({message:'Settings saved.'});}catch(e){res.status(500).json({error:'Could not save settings.'});}});
app.get('/api/owner/audit',auth,ownerOnly,async(req,res)=>{const[rows]=await db.query(`SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`);res.json(rows);});

app.get('/api/player/me',auth,playerOnly,async(req,res)=>{const[[user]]=await db.query(`SELECT id,email,player_id FROM users WHERE id=?`,[req.user.id]);const[[player]]=await db.query(`SELECT * FROM players WHERE user_id=?`,[req.user.id]);const[[application]]=await db.query(`SELECT * FROM player_applications WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,[req.user.id]);res.json({user,player:player||null,application:application||null});});
app.put('/api/player/me',auth,playerOnly,upload.single('photo'),async(req,res)=>{const conn=await db.getConnection();try{const[[user]]=await conn.query(`SELECT * FROM users WHERE id=?`,[req.user.id]);const[[current]]=await conn.query(`SELECT * FROM players WHERE user_id=?`,[req.user.id]);const [[application]]=await conn.query(`SELECT * FROM player_applications WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,[req.user.id]);const photo=req.file?publicFile(req.file):(application?.photo||current?.photo||null);await conn.beginTransaction();if(application){await conn.query(`UPDATE player_applications SET full_name=?,photo=?,jersey_number=?,position=?,date_of_birth=?,preferred_foot=?,phone=?,bio=?,status='pending',reviewed_at=NULL WHERE id=?`,[req.body.full_name,photo,cleanNumber(req.body.jersey_number),req.body.position||null,cleanDate(req.body.date_of_birth),req.body.preferred_foot||null,req.body.phone||null,req.body.bio||null,application.id]);}else{await conn.query(`INSERT INTO player_applications (user_id,email,full_name,photo,jersey_number,position,date_of_birth,preferred_foot,phone,bio,team,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')`,[req.user.id,user.email,req.body.full_name,photo,cleanNumber(req.body.jersey_number),req.body.position||null,cleanDate(req.body.date_of_birth),req.body.preferred_foot||null,req.body.phone||null,req.body.bio||null,'Los Blancos FC']);}const[[ownerUser]]=await conn.query(`SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1`);if(ownerUser)await conn.query(`INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)`,[ownerUser.id,'player_update','Player profile update',`${req.body.full_name} submitted profile changes for approval.`,'#owner/requests']);await conn.commit();if(req.file&&current?.photo)removePublicFile(current.photo);res.json({message:'Profile changes submitted for owner approval.'});}catch(e){try{await conn.rollback();}catch(_){}if(req.file)removePublicFile(publicFile(req.file));res.status(500).json({error:'Could not update profile.'});}finally{conn.release();}});
app.get('/api/player/matches',auth,playerOnly,async(req,res)=>{
  try{
    const [[u]]=await db.query(
      `SELECT player_id FROM users WHERE id=?`,
      [req.user.id]
    );

    const playerId=u?.player_id;

    if(!playerId){
      return res.json([]);
    }

    const [rows]=await db.query(
      `SELECT DISTINCT
        m.*,
        t.team_name AS opponent_name,
        t.logo AS opponent_logo
      FROM matches m
      LEFT JOIN teams t ON t.id=m.opponent_id
      LEFT JOIN match_lineups ml
        ON ml.match_id=m.id
        AND ml.player_id=?
      LEFT JOIN player_match_stats s
        ON s.match_id=m.id
        AND s.player_id=?
      WHERE
        ml.player_id IS NOT NULL
        OR s.player_id IS NOT NULL
        OR m.status='scheduled'
      ORDER BY m.match_date ASC,m.match_time ASC`,
      [playerId,playerId]
    );

    res.json(rows);
  }catch(e){
    console.error('PLAYER MATCHES ERROR:',e);
    res.status(500).json({
      error:'Could not load player matches.'
    });
  }
});app.get('/api/player/stats',auth,playerOnly,async(req,res)=>{const[[u]]=await db.query(`SELECT player_id FROM users WHERE id=?`,[req.user.id]);if(!u?.player_id)return res.json({stats:{appearances:0,goals:0,assists:0,yellow_cards:0,red_cards:0},matches:[]});const[[stats]]=await db.query(`SELECT COALESCE(SUM(appearances),0) appearances,COALESCE(SUM(goals),0) goals,COALESCE(SUM(assists),0) assists,COALESCE(SUM(yellow_cards),0) yellow_cards,COALESCE(SUM(red_cards),0) red_cards FROM player_match_stats WHERE player_id=?`,[u.player_id]);const[matches]=await db.query(`SELECT m.id,m.match_date,m.opponent_id,t.team_name opponent_name,s.* FROM player_match_stats s INNER JOIN matches m ON m.id=s.match_id LEFT JOIN teams t ON t.id=m.opponent_id WHERE s.player_id=? ORDER BY m.match_date DESC`,[u.player_id]);res.json({stats,matches});});
app.get('/api/player/lineup',auth,playerOnly,async(req,res)=>{const[[u]]=await db.query(`SELECT player_id FROM users WHERE id=?`,[req.user.id]);if(!u?.player_id)return res.json([]);const[rows]=await db.query(`SELECT ml.*,m.match_date,m.match_time,m.status,t.team_name opponent_name FROM match_lineups ml INNER JOIN matches m ON m.id=ml.match_id LEFT JOIN teams t ON t.id=m.opponent_id WHERE ml.player_id=? ORDER BY m.match_date DESC`,[u.player_id]);res.json(rows);});

app.get('/api/player/contributions',auth,playerOnly,async(req,res)=>{
  try{
    const [[player]]=await db.query(`SELECT p.id,p.full_name FROM users u INNER JOIN players p ON p.id=u.player_id AND p.user_id=u.id WHERE u.id=? AND u.role='player' AND p.approval_status='approved'`,[req.user.id]);
    if(!player)return res.status(403).json({error:'The contribution ledger is available to approved, registered players only.'});
    const [contributions]=await db.query(`SELECT c.id,c.player_id,CASE WHEN p.id IS NULL THEN c.contributor_name ELSE p.full_name END contributor_name,CASE WHEN p.id IS NULL THEN 0 ELSE 1 END is_registered,c.amount,c.currency_code,c.contribution_date,c.note FROM contributions c LEFT JOIN players p ON p.id=c.player_id ORDER BY c.contribution_date DESC,c.id DESC`);
    res.json({playerId:player.id,playerName:player.full_name,contributions});
  }catch(e){console.error('PLAYER CONTRIBUTIONS ERROR:',e);res.status(500).json({error:'Could not load the contribution ledger.'});}
});

app.get('/api/notifications',auth,async(req,res)=>{const[rows]=await db.query(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,[req.user.id]);res.json(rows);});
app.post('/api/notifications/:id/read',auth,async(req,res)=>{await db.query(`UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`,[req.params.id,req.user.id]);res.json({message:'Notification read.'});});
app.post('/api/notifications/read-all',auth,async(req,res)=>{await db.query(`UPDATE notifications SET is_read=1 WHERE user_id=?`,[req.user.id]);res.json({message:'All notifications marked as read.'});});

app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:err.message||'Unexpected server error'});});

(async()=>{
  try{
    await db.query('SELECT 1');
    await db.query(`CREATE TABLE IF NOT EXISTS contributions (
      id INT NOT NULL AUTO_INCREMENT,
      player_id INT NULL,
      contributor_name VARCHAR(190) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency_code CHAR(3) NOT NULL DEFAULT 'KES',
      contribution_date DATE NOT NULL,
      note VARCHAR(500) NULL,
      recorded_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_contributions_player_date (player_id, contribution_date),
      KEY idx_contributions_date (contribution_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log(' Database connection ready');
  }
  catch(e){console.error(' Database connection failed:',e.message);}
  app.listen(PORT,'0.0.0.0',()=>console.log(` Los Blancos FC new portal running on port ${PORT}`));
})();

















