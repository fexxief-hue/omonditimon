 const state = { user:null, home:null };
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const toast = document.getElementById('toast');

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = v => v ? new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtTime = v => v ? String(v).slice(0,5) : '';
const heroFallback = 'linear-gradient(135deg,#0e2b49,#030810 72%)';
function notify(message,type='success'){toast.textContent=message;toast.className=`toast show ${type}`;setTimeout(()=>toast.className='toast',3000)}
async function api(url, options={}){
  const res = await fetch(url,{credentials:'same-origin',...options});
  let data={}; try{data=await res.json()}catch(_){data={};}
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function getRoute(){return location.hash.replace(/^#/,'') || '/';}
function nav(route){location.hash=route;}
function imageOrPlaceholder(url,label='LB'){return url?`<img src="${esc(url)}" alt="${esc(label)}">`:`<div style="height:100%;display:grid;place-items:center;font-size:2rem;font-weight:900;color:#f6c644">${esc(label.slice(0,2).toUpperCase())}</div>`}

function publicHeader(active='/', logged=false){
  const logo = state.home?.settings?.logo_url || '/assets/los-blancos-badge.jpg';
  const portal = state.user
    ? `<button class="header-portal" data-route="#/${state.user.role==='owner'?'owner':'player'}">${state.user.role==='owner'?'CLUB CONTROL':'MY CLUB'}</button>
       <button class="header-icon" data-route="#/${state.user.role==='owner'?'owner':'player'}/notifications" aria-label="Notifications">●</button>
       <button class="header-logout" data-action="logout">LOG OUT</button>`
    : `<button class="header-login" data-route="#/login">LOG IN</button><button class="header-join" data-route="#/register">JOIN</button>`;
  const items=[['/','Home'],['/matches','Matches'],['/squad','Squad'],['/stats','Performance'],['/news','Stories'],['/media','Media']];
  return `<header class="site-header">
    <button class="site-brand" data-route="#/" aria-label="Los Blancos FC home">
      <span class="site-crest"><img src="${esc(logo)}" alt="Los Blancos FC"></span>
      <span><b>LOS BLANCOS</b><small>FOOTBALL CLUB</small></span>
    </button>
    <nav class="site-nav" aria-label="Primary navigation">${items.map(([r,t])=>`<button class="${active===r?'active':''}" data-route="#${r}">${t}</button>`).join('')}</nav>
    <div class="site-actions">${portal}</div>
  </header>`;
}

async function loadHome(){ try{state.home=await api('/api/public/home')}catch(e){state.home={settings:{club_name:'Los Blancos FC',tagline:'Discipline • Unity • Victory',hero_background:''},nextMatches:[],results:[],players:[],news:[]}; notify(e.message,'error');} }
function matchCard(m){const finished=m.status==='finished';return `<div class="card match-card"><div class="match-row"><div><div class="team-logo"><img src="/assets/los-blancos-badge.jpg" alt="Los Blancos FC"></div><strong>Los Blancos FC</strong></div><div><div class="score">${finished?`${esc(m.home_score ?? '0')} - ${esc(m.away_score ?? '0')}`:'VS'}</div><span class="pill">${esc(m.status||'scheduled')}</span></div><div><div class="team-logo">${imageOrPlaceholder(m.opponent_logo,m.opponent_name||'OP')}</div><strong>${esc(m.opponent_name||'Opponent')}</strong></div></div><div class="fixture-meta"><span>${fmtDate(m.match_date)}</span><span>${fmtTime(m.match_time)}</span><span>${esc(m.venue||'Venue TBC')}</span></div><div style="margin-top:16px;text-align:center"><button class="btn outline" data-route="#/match/${m.id}">View Match Centre</button></div></div>`}
function playerCard(p){return `<article class="card player-card"><div class="player-photo">${imageOrPlaceholder(p.photo,p.full_name)}</div><div class="player-info"><span class="player-number">#${esc(p.jersey_number||'—')}</span><div class="player-name">${esc(p.full_name)}</div><div class="muted">${esc(p.position||'Player')} • ${esc(p.team||'Los Blancos FC')}</div><button class="btn outline" style="margin-top:12px;width:100%" data-route="#/player/${p.id}">View Profile</button></div></article>`}
function newsCard(n){return `<article class="card news-card"><div class="news-image">${n.image?`<img src="${esc(n.image)}" alt="${esc(n.title)}">`:''}</div><div class="news-body"><div class="small muted">${fmtDate(n.published_at||n.created_at)}</div><h3>${esc(n.title)}</h3><p class="muted">${esc(n.excerpt||'Latest club news and updates.')}</p><button class="btn outline" data-route="#/news/${n.id}">Read Story</button></div></article>`}

async function publicPage(route){
  if(route==='/'){
    await loadHome();
    const h=state.home, logo=h.settings.logo_url||'/assets/los-blancos-badge.jpg';
    const bg=h.settings.hero_background||'/assets/home-background.jpg';
    const introVideo=h.settings.intro_video_url||'/assets/los-blancos-intro.mp4';
    const next=h.nextMatches?.[0], featured=h.players||[], results=h.results||[], news=h.news||[];
    const heroStats=await api('/api/public/stats').catch(()=>[]);
    const goals=heroStats.reduce((a,p)=>a+Number(p.goals||0),0);
    const assists=heroStats.reduce((a,p)=>a+Number(p.assists||0),0);
    const appearances=heroStats.reduce((a,p)=>a+Number(p.appearances||0),0);
    document.documentElement.style.setProperty('--club-hero',`url("${esc(bg)}")`);
    app.innerHTML=`
      <div class="cinema-intro intro-has-film" id="lb-intro" aria-label="Los Blancos FC opening" style="--intro-image:url('${esc(bg)}')">
        <video class="intro-film" data-intro-film src="${esc(introVideo)}" poster="${esc(bg)}" autoplay muted playsinline preload="auto"></video>
        <div class="intro-noise"></div><div class="intro-lights"></div><div class="intro-pitch"></div><div class="intro-scan" aria-hidden="true"></div>
        <div class="intro-kicker"><span>LOS BLANCOS FC</span><i></i><span>EST. WITH AMBITION</span></div>
        <div class="intro-sequence"><small>ONE CLUB · ONE STANDARD</small><strong>THE GAME<br><em>STARTS HERE.</em></strong><span class="intro-progress"><i></i></span></div>
        <div class="intro-reveal"><div class="intro-halo"></div><img src="${esc(logo)}" alt="Los Blancos FC badge"><strong>${esc(h.settings.club_name||'LOS BLANCOS FC')}</strong><span>DISCIPLINE · UNITY · AMBITION</span><button class="intro-enter" data-action="enter-club">ENTER THE CLUB <b>↗</b></button><small class="intro-credit">DESIGNED BY <b>OMONDITIMON</b></small></div>
        <button class="intro-skip" data-action="enter-club" aria-label="Skip intro">SKIP INTRO <span>↗</span></button>
      </div>
      ${publicHeader('/')}
      <main class="new-home">
        <section class="hero-new" style="--hero-image:url('${esc(bg)}')">
          <div class="hero-gridline"></div><div class="hero-orbit"></div>
          <div class="hero-copy"><div class="section-kicker"><span></span> OFFICIAL CLUB PLATFORM</div><h1>BUILT FOR<br><em>THE NEXT</em><br>MATCH.</h1><p>${esc(h.settings.tagline||'Dream • Play • Conquer')} — squad, matchday, performance and club stories in one place.</p><div class="hero-cta"><button class="cta-main" data-route="#/matches">MATCH CENTRE <span>↗</span></button><button class="cta-ghost" data-route="#/squad">MEET THE SQUAD</button></div></div>
          <div class="hero-badge"><img src="${esc(logo)}" alt=""><span>LBFC</span></div><div class="hero-edge"><span>01</span><i></i><span>THE CLUB</span></div>
        </section>
        <section class="ticker"><div>LOS BLANCOS FC</div><div>DISCIPLINE</div><div>UNITY</div><div>AMBITION</div><div>LEGACY</div><div>LOS BLANCOS FC</div></section>
        <section class="home-section next-section"><div class="section-intro"><div><span class="section-no">01</span><div class="section-kicker">MATCHDAY</div><h2>THE NEXT<br><em>CHAPTER.</em></h2></div><button class="text-link" data-route="#/matches">ALL FIXTURES ↗</button></div>
          ${next?`<article class="next-match"><div class="match-identity"><span>NEXT MATCH</span><small>${esc(next.competition||'FIXTURE')} · ${fmtDate(next.match_date)} · ${fmtTime(next.match_time)||'TBC'}</small></div><div class="match-teams"><div class="home-team"><img src="${esc(logo)}" alt=""><strong>LOS<br>BLANCOS</strong></div><div class="match-middle"><b>VS</b><span>${esc(next.venue||'VENUE TBC')}</span><button class="cta-main small" data-route="#/match/${next.id}">MATCH CENTRE ↗</button></div><div class="away-team">${imageOrPlaceholder(next.opponent_logo,next.opponent_name||'OP')}<strong>${esc(next.opponent_name||'OPPONENT')}</strong></div></div></article>`:`<div class="empty-panel">No upcoming fixture has been published yet.</div>`}
        </section>
        <section class="home-section squad-section"><div class="section-intro"><div><span class="section-no">02</span><div class="section-kicker">FIRST TEAM</div><h2>THE<br><em>SQUAD.</em></h2></div><button class="text-link" data-route="#/squad">FULL SQUAD ↗</button></div>
          <div class="squad-marquee"><div class="squad-rail">${[...featured.slice(0,10),...featured.slice(0,10)].map((p,i)=>`<article class="player-tile" data-route="#/player/${p.id}" tabindex="${i>=featured.slice(0,10).length?'-1':'0'}" ${i>=featured.slice(0,10).length?'aria-hidden="true"':''}><div class="player-tile-image">${imageOrPlaceholder(p.photo,p.full_name)}</div><div class="player-tile-overlay"></div><span class="player-tile-number">${String(p.jersey_number||'—').padStart(2,'0')}</span><div class="player-tile-copy"><small>${esc(p.position||'PLAYER')}</small><strong>${esc(p.full_name)}</strong><button tabindex="${i>=featured.slice(0,10).length?'-1':'0'}" data-route="#/player/${p.id}">PROFILE ↗</button></div></article>`).join('')||'<div class="empty-panel">No approved players yet.</div>'}</div></div>
        </section>
        <section class="home-section numbers-section"><div class="section-intro"><div><span class="section-no">03</span><div class="section-kicker">THE NUMBERS</div><h2>PLAY.<br><em>MEASURED.</em></h2></div><button class="text-link" data-route="#/stats">FULL PERFORMANCE ↗</button></div><div class="number-grid"><div><b>${heroStats.length}</b><span>PLAYERS</span></div><div><b>${appearances}</b><span>APPEARANCES</span></div><div><b>${goals}</b><span>GOALS</span></div><div><b>${assists}</b><span>ASSISTS</span></div></div></section>
        <section class="home-section split-section"><div class="results-panel"><div class="section-kicker">LATEST RESULTS</div><h2>FULL<br><em>TIME.</em></h2>${results.slice(0,4).map(m=>`<button class="result-row" data-route="#/match/${m.id}"><span>${fmtDate(m.match_date)}</span><b>LBFC</b><strong>${esc(m.home_score??0)} — ${esc(m.away_score??0)}</strong><span>${esc(m.opponent_name||'Opponent')}</span><i>↗</i></button>`).join('')||'<div class="empty-panel">No completed matches yet.</div>'}<button class="text-link" data-route="#/results">VIEW RESULTS ↗</button></div>
          <div class="story-panel"><div class="section-kicker">FROM THE CLUB</div><h2>THE<br><em>STORY.</em></h2>${news[0]?`<button class="featured-story" data-route="#/news/${news[0].id}"><div class="story-image">${news[0].image?`<img src="${esc(news[0].image)}" alt="">`:''}</div><div><small>${fmtDate(news[0].published_at)}</small><strong>${esc(news[0].title)}</strong><span>${esc(news[0].excerpt||'Read the latest from Los Blancos FC.')}</span><b>READ STORY ↗</b></div></button>`:'<div class="empty-panel">The newsroom is ready for the next club story.</div>'}<button class="text-link" data-route="#/news">NEWSROOM ↗</button></div></section>
        <section class="lineup-tease"><div class="lineup-tease-copy"><span class="section-kicker">SIGNATURE MATCH FEATURE</span><h2>SEE THE<br><em>XI.</em></h2><p>Real formations. Real players. Real match data. Open any match to see the lineup on a full football pitch.</p><button class="cta-main" data-route="#/matches">OPEN MATCH CENTRE ↗</button></div><div class="mini-pitch"><div class="pitch-line mid"></div><div class="pitch-circle"></div><div class="pitch-box top"></div><div class="pitch-box bottom"></div><span class="pitch-dot d1">9</span><span class="pitch-dot d2">10</span><span class="pitch-dot d3">7</span><span class="pitch-dot d4">8</span><span class="pitch-dot d5">6</span><span class="pitch-dot d6">1</span></div></section>
        <section class="join-band"><div><span class="section-kicker">FOR PLAYERS</span><h2>YOUR NEXT<br><em>CHAPTER.</em></h2></div><button class="cta-main" data-route="#/register">JOIN LOS BLANCOS ↗</button></section>
      </main>
      <footer class="new-footer"><div class="footer-mark"><img src="${esc(logo)}" alt=""><strong>LOS BLANCOS FC</strong><span>FOOTBALL CLUB</span></div><div class="footer-links"><button data-route="#/club">THE CLUB</button><button data-route="#/squad">SQUAD</button><button data-route="#/matches">MATCHES</button><button data-route="#/news">STORIES</button><button data-route="#/login">LOGIN</button></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Los Blancos FC</span><span>ONE CLUB · ONE STANDARD</span></div></footer>`;
    startClubIntro();
    return;
  }
  if(route==='/club')return renderClub();
  if(route==='/squad')return renderSquad();
  if(route==='/matches')return renderPublicMatches(false);
  if(route==='/results')return renderPublicMatches(true);
  if(route==='/stats')return renderPublicStats();
  if(route==='/news')return renderPublicNews();
  if(route==='/media')return renderPublicMedia();
  if(route.startsWith('/news/'))return renderNewsDetail(route.split('/')[2]);
  if(route.startsWith('/match/'))return renderMatchDetail(route.split('/')[2]);
  if(['/player','/player/profile','/player/matches','/player/stats','/player/lineup','/player/notifications'].includes(route))return renderPlayer(route.replace('/player','')||'/');
  if(route.startsWith('/player/')&&!route.startsWith('/player/portal'))return renderPublicPlayer(route.split('/')[2]);
  if(route==='/contact'){app.innerHTML=`${publicHeader('/contact')}<section class="auth-page"><div class="clean-panel"><div class="section-kicker">CONTACT</div><h1 class="page-title">TALK TO THE CLUB</h1><p class="muted">For fixtures, registration, media or club enquiries, use the available club portal.</p><div class="action-row"><button class="cta-main" data-route="#/register">PLAYER REGISTRATION ↗</button><button class="cta-ghost" data-route="#/login">ACCOUNT LOGIN</button></div></div></section>`;return;}
  if(route==='/login')return renderLogin();
  if(route==='/register')return renderRegister();
  if(route.startsWith('/owner'))return renderOwner(route.replace('/owner','')||'/');
  if(route.startsWith('/player')&&!route.startsWith('/player/portal'))return renderPlayer(route.replace('/player','')||'/');
  return nav('/');
}

function accountShell(mode, content){
  const logo=state.home?.settings?.logo_url||'/assets/los-blancos-badge.jpg';
  return `${publicHeader(mode==='login'?'/login':'')}<main class="account-screen"><section class="account-showcase" style="--account-image:url('/assets/home-background.jpg')"><div class="account-glow"></div><div class="account-brand"><img src="${esc(logo)}" alt="Los Blancos FC badge"><span>LOS BLANCOS FC<small>ONE CLUB · ONE STANDARD</small></span></div><div class="account-message"><span class="section-kicker">OFFICIAL CLUB PORTAL</span><h1>YOUR CLUB.<br><em>YOUR STORY.</em></h1><p>Matchday, people and progress — all connected to the badge.</p></div><div class="account-side-note">DISCIPLINE · UNITY · AMBITION</div></section><section class="account-form-wrap"><div class="account-form-card">${content}</div><div class="account-footnote">SECURE CLUB ACCESS <i></i> LOS BLANCOS FC</div></section></main>${publicFooter()}`;
}

function renderLogin(){
  app.innerHTML=accountShell('login',`<div class="section-kicker">MEMBER ACCESS</div><h2>Welcome back.</h2><p class="account-subtitle">Sign in to continue to your club space.</p><form id="login-form" class="account-form"><div class="account-error" id="login-error" role="alert" hidden></div><label class="field"><span>Email address</span><input class="input" type="email" name="email" autocomplete="username" placeholder="you@example.com" required></label><label class="field"><span>Password</span><div class="password-control"><input class="input" id="login-password" type="password" name="password" autocomplete="current-password" placeholder="Enter your password" required><button class="password-toggle" type="button" id="toggle-login-password" aria-label="Show password" aria-pressed="false">SHOW</button></div></label><button class="account-submit" type="submit">SIGN IN <b>↗</b></button></form><div class="account-divider"><span>NEW TO THE CLUB?</span></div><button class="account-secondary" data-route="#/register">Create a player account <b>↗</b></button><button class="account-home" data-route="#/">← Return to club website</button>`);
  const form=document.getElementById('login-form');
  const error=document.getElementById('login-error');
  const password=document.getElementById('login-password');
  const toggle=document.getElementById('toggle-login-password');
  toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'HIDE':'SHOW';toggle.setAttribute('aria-label',show?'Hide password':'Show password');toggle.setAttribute('aria-pressed',String(show));});
  form.addEventListener('submit',async event=>{
    event.preventDefault();error.hidden=true;
    const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='SIGNING IN…';
    try{
      const body=Object.fromEntries(new FormData(form).entries());
      const result=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      state.user=result.user;notify('Welcome back.');nav(result.user?.role==='owner'?'/owner':'/player');
    }catch(err){error.textContent=err.message||'Could not sign in. Please try again.';error.hidden=false;button.disabled=false;button.innerHTML='SIGN IN <b>↗</b>';}
  });
}

function renderRegister(){
  app.innerHTML=accountShell('register',`<div class="section-kicker">JOIN THE CLUB</div><h2>Start your story.</h2><p class="account-subtitle">Create a player account. The club will review your request.</p><form id="register-form" class="account-form"><div class="account-error" id="register-error" role="alert" hidden></div><label class="field"><span>Full name</span><input class="input" name="full_name" autocomplete="name" placeholder="Your full name" required></label><label class="field"><span>Email address</span><input class="input" type="email" name="email" autocomplete="email" placeholder="you@example.com" required></label><label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required></label><label class="field"><span>Position <small>OPTIONAL</small></span><select class="select" name="position"><option value="">Choose position</option><option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select></label><label class="field"><span>Player photo <small>OPTIONAL</small></span><input class="input" type="file" name="photo" accept="image/*"></label><button class="account-submit" type="submit">SEND PLAYER REQUEST <b>↗</b></button></form><div class="account-divider"><span>ALREADY REGISTERED?</span></div><button class="account-secondary" data-route="#/login">Sign in to your account <b>↗</b></button><button class="account-home" data-route="#/">← Return to club website</button>`);
  const form=document.getElementById('register-form');
  const error=document.getElementById('register-error');
  form.addEventListener('submit',async event=>{
    event.preventDefault();error.hidden=true;
    const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='SENDING REQUEST…';
    try{
      const result=await api('/api/auth/register',{method:'POST',body:new FormData(form)});
      state.user=result.user;notify(result.message||'Player request sent.');nav('/player');
    }catch(err){error.textContent=err.message||'Could not submit your request.';error.hidden=false;button.disabled=false;button.innerHTML='SEND PLAYER REQUEST <b>↗</b>';}
  });
}

function statQuick(t,v,icon){return `<div class="card stat-card"><div>${icon}</div><div class="muted small">${t}</div><div class="value">${esc(v)}</div></div>`}
function publicFooter(){return `<footer class="footer">© ${new Date().getFullYear()} Los Blancos FC • Official Club Website</footer>`}

function startClubIntro(){
  const intro=document.getElementById('lb-intro'); if(!intro)return;
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const film=intro.querySelector('[data-intro-film]');
  const leave=()=>{if(intro.classList.contains('intro-leave'))return;intro.classList.add('intro-leave');setTimeout(()=>intro.remove(),900);sessionStorage.setItem('lb_intro_seen_v3','1');};
  intro.querySelectorAll('[data-action="enter-club"]').forEach(button=>button.addEventListener('click',leave));
  if(reduced || sessionStorage.getItem('lb_intro_seen_v3')==='1'){intro.classList.add('intro-skip','intro-brand-ready');setTimeout(leave,reduced?100:350);return;}
  if(film){
    film.addEventListener('ended',()=>intro.classList.add('intro-brand-ready'),{once:true});
    film.addEventListener('error',()=>setTimeout(()=>intro.classList.add('intro-brand-ready'),4500),{once:true});
  }else setTimeout(()=>intro.classList.add('intro-brand-ready'),4800);
}

function bindPremiumInteractions(){
  if(state.countdownTimer)clearInterval(state.countdownTimer);
  const countdown=document.querySelector('[data-countdown]');
  if(countdown){
    const target=new Date(countdown.dataset.countdown);
    const tick=()=>{let diff=Math.max(0,target-Date.now());const units={days:Math.floor(diff/86400000)};diff%=86400000;units.hours=Math.floor(diff/3600000);diff%=3600000;units.minutes=Math.floor(diff/60000);diff%=60000;units.seconds=Math.floor(diff/1000);Object.entries(units).forEach(([k,v])=>{const el=countdown.querySelector(`[data-unit="${k}"]`);if(el)el.textContent=String(v).padStart(2,'0')})};tick();state.countdownTimer=setInterval(tick,1000);}
  const track=document.querySelector('[data-drag-scroll]');
  if(track){let down=false,startX=0,left=0;track.addEventListener('pointerdown',e=>{down=true;startX=e.clientX;left=track.scrollLeft;track.setPointerCapture?.(e.pointerId)});track.addEventListener('pointermove',e=>{if(down)track.scrollLeft=left-(e.clientX-startX)});['pointerup','pointercancel','pointerleave'].forEach(x=>track.addEventListener(x,()=>down=false));}
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.12}):null;
  document.querySelectorAll('.lb-reveal:not(.is-visible)').forEach(el=>observer?observer.observe(el):el.classList.add('is-visible'));
}

function statQuick(t,v,icon){return `<div class="card stat-card"><div>${icon}</div><div class="muted small">${t}</div><div class="value">${esc(v)}</div></div>`}
function publicFooter(){return `<footer class="footer">© ${new Date().getFullYear()} Los Blancos FC • Official Club Website • Built for matchday, squad and player management.</footer>`}

async function renderClub(){app.innerHTML=`${publicHeader('/club')}<main><section class="lb-section" style="padding-top:90px"><div class="lb-eyebrow">THE CLUB</div><h1 class="lb-title" style="font-size:clamp(48px,7vw,90px)">More than a team.<br><span class="gold">A family.</span></h1><div class="grid grid-2" style="margin-top:35px"><div class="card pad"><div class="lb-eyebrow">OUR STORY</div><h2>Los Blancos FC</h2><p class="muted" style="line-height:1.9">Los Blancos FC is built around football, discipline, unity and ambition. This platform brings the club's people, performances, matchdays and stories together in one modern digital home.</p></div><div class="card pad" style="min-height:260px;background:linear-gradient(135deg,rgba(216,173,82,.12),rgba(5,12,19,.95))"><div class="lb-eyebrow">OUR IDENTITY</div><h2>Dream • Play • Conquer</h2><p class="muted" style="line-height:1.9">Every match adds another chapter. Every player adds another story. Every supporter adds another reason to keep building.</p></div></div></section><section class="lb-section compact"><div class="lb-section-head"><div><div class="lb-eyebrow">CLUB VALUES</div><h2 class="lb-title">The standard.</h2></div></div><div class="grid grid-4"><div class="card pad"><div class="lb-eyebrow">01</div><h3>Discipline</h3><p class="muted">Preparation, consistency and respect for the badge.</p></div><div class="card pad"><div class="lb-eyebrow">02</div><h3>Unity</h3><p class="muted">One squad, one family and one shared direction.</p></div><div class="card pad"><div class="lb-eyebrow">03</div><h3>Ambition</h3><p class="muted">Compete with purpose and keep raising the standard.</p></div><div class="card pad"><div class="lb-eyebrow">04</div><h3>Legacy</h3><p class="muted">Build something that lasts beyond a single season.</p></div></div></section><section class="lb-section"><div class="card pad" style="text-align:center;padding:70px 25px;background:radial-gradient(circle at center,rgba(216,173,82,.11),transparent 55%),#07111d"><div class="lb-eyebrow">WALL OF LEGENDS</div><h2 class="lb-title">Every era leaves a mark.</h2><p class="muted" style="max-width:620px;margin:16px auto 25px;line-height:1.8">Honours, milestones and legendary moments can grow here as the club's owner records them.</p><button class="btn gold-btn" data-route="#/matches">Explore Matchday →</button></div></section></main>${publicFooter()}`}
async function renderPublicMedia(){const rows=await api('/api/public/media?type=gallery');app.innerHTML=`${publicHeader('/media')}<main><section class="lb-section"><div class="lb-section-head"><div><div class="lb-eyebrow">CLUB MEDIA</div><h1 class="lb-title">Moments that matter.</h1><p class="lb-subtitle">A living gallery for the people, places and matchdays behind Los Blancos FC.</p></div></div><div class="grid grid-3">${rows.map((m,i)=>`<article class="card" style="overflow:hidden"><img src="${esc(m.file_path)}" alt="${esc(m.title)}" style="width:100%;height:280px;object-fit:cover"><div class="pad"><div class="lb-eyebrow">${esc(m.media_type)}</div><h3>${esc(m.title)}</h3><p class="muted small">${fmtDate(m.created_at)}</p></div></article>`).join('')||`<div class="empty">The media wall is ready for the club's first gallery uploads.</div>`}</div></section></main>${publicFooter()}`}

async function renderSquad(){const players=await api('/api/public/players');const reels=[...players,...players];app.innerHTML=`${publicHeader('/squad')}<main class="new-home"><section class="home-section squad-section squad-page"><div class="section-intro"><div><span class="section-no">FIRST TEAM · ${String(players.length).padStart(2,'0')} PLAYERS</span><div class="section-kicker">LOS BLANCOS FC</div><h1 class="page-title">THE<br><em>SQUAD.</em></h1></div><div class="squad-page-note">Meet the players behind the badge.<br><span>Slow-motion reel · hover to pause</span></div></div><div class="squad-marquee squad-marquee-full"><div class="squad-rail">${reels.map((p,i)=>`<article class="player-tile" data-route="#/player/${p.id}" tabindex="${i>=players.length?'-1':'0'}" ${i>=players.length?'aria-hidden="true"':''}><div class="player-tile-image">${imageOrPlaceholder(p.photo,p.full_name)}</div><div class="player-tile-overlay"></div><span class="player-tile-number">${String(p.jersey_number||'—').padStart(2,'0')}</span><div class="player-tile-copy"><small>${esc(p.position||'PLAYER')}</small><strong>${esc(p.full_name)}</strong><button tabindex="${i>=players.length?'-1':'0'}" data-route="#/player/${p.id}">VIEW PLAYER ↗</button></div></article>`).join('')||'<div class="empty-panel">No approved players yet.</div>'}</div></div><div class="squad-reel-caption"><span>01 — FIRST TEAM</span><span>LOS BLANCOS FC · BUILT TOGETHER</span></div></section></main>${publicFooter()}`}
async function renderPublicPlayer(id){
  const {player:p,stats:s}=await api(`/api/public/players/${encodeURIComponent(id)}`);
  app.innerHTML=`${publicHeader('/squad')}<main class="section public-player-page"><button class="btn outline" data-route="#/squad">← Back to the squad</button><section class="public-player-profile"><div class="public-player-photo">${p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.full_name)}">`:imageOrPlaceholder(null,p.full_name)}</div><div class="public-player-copy"><div class="eyebrow">LOS BLANCOS FC · FIRST TEAM</div><span class="player-number">#${esc(p.jersey_number||'—')}</span><h1 class="page-title">${esc(p.full_name)}</h1><p class="section-kicker">${esc(p.position||'PLAYER')} · ${esc(p.team||'LOS BLANCOS FC')}</p>${p.bio?`<p class="muted public-player-bio">${esc(p.bio)}</p>`:''}<div class="grid grid-4 public-player-stats">${statQuick('Appearances',s.appearances,'')}${statQuick('Goals',s.goals,'')}${statQuick('Assists',s.assists,'')}${statQuick('Cards',`${s.yellow_cards}/${s.red_cards}`,'')}</div>${p.joined_at?`<p class="small muted">With the club since ${fmtDate(p.joined_at)}</p>`:''}</div></section></main>${publicFooter()}`;
}
async function renderPublicMatches(resultsOnly){const rows=await api('/api/public/matches');const filtered=rows.filter(m=>resultsOnly?m.status==='finished':m.status!=='finished');app.innerHTML=`${publicHeader(resultsOnly?'/results':'/matches')}<section class="section"><div class="section-head"><div><div class="eyebrow">${resultsOnly?'RESULTS':'FIXTURES'}</div><h1 class="page-title">${resultsOnly?'Results':'Matches'}</h1></div><button class="btn outline" data-route="#/${resultsOnly?'matches':'results'}">View ${resultsOnly?'Upcoming':'Results'}</button></div><div class="grid grid-2">${filtered.map(matchCard).join('')||`<div class="empty">Nothing published here yet.</div>`}</div></section>${publicFooter()}`}
async function renderPublicStats(){const rows=await api('/api/public/stats');app.innerHTML=`${publicHeader('/stats')}<section class="section"><div class="section-head"><div><div class="eyebrow">SEASON STATS</div><h1 class="page-title">Player Statistics</h1></div></div><div class="table-wrap card"><table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Apps</th><th>Goals</th><th>Assists</th><th>YC</th><th>RC</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td>#${esc(p.jersey_number||'—')} ${esc(p.full_name)}</td><td>${esc(p.position||'')}</td><td>${p.appearances}</td><td class="gold">${p.goals}</td><td>${p.assists}</td><td>${p.yellow_cards}</td><td>${p.red_cards}</td><td><button class="btn outline" data-route="#/player/${p.id}">Profile</button></td></tr>`).join('')||`<tr><td colspan="8" class="muted">No stats available.</td></tr>`}</tbody></table></div></section>${publicFooter()}`}
async function renderPublicNews(){const rows=await api('/api/public/news');app.innerHTML=`${publicHeader('/news')}<section class="section"><div class="section-head"><div><div class="eyebrow">CLUB MEDIA</div><h1 class="page-title">News</h1></div></div><div class="grid grid-3">${rows.map(newsCard).join('')||`<div class="empty">No news published yet.</div>`}</div></section>${publicFooter()}`}
async function renderNewsDetail(id){const n=await api(`/api/public/news/${id}`);app.innerHTML=`${publicHeader('/news')}<section class="section"><button class="btn outline" data-route="#/news">← Back to News</button><article class="card pad" style="margin-top:16px"><div class="eyebrow">LOS BLANCOS FC NEWS</div><h1 class="page-title">${esc(n.title)}</h1><p class="muted">${fmtDate(n.published_at||n.created_at)}</p>${n.image?`<img src="${esc(n.image)}" alt="" style="width:100%;max-height:460px;object-fit:cover;border-radius:16px;margin:16px 0">`:''}<p style="white-space:pre-line;line-height:1.8;color:#d7e2ed">${esc(n.body)}</p></article></section>`}
async function renderMatchDetail(id){
  const d=await api(`/api/public/matches/${id}`), m=d.match;
  const starters=d.lineup.filter(x=>Number(x.is_starter)===1), subs=d.lineup.filter(x=>Number(x.is_starter)!==1);
  const pos={GK:[50,87],LB:[17,70],LCB:[38,73],RCB:[62,73],RB:[83,70],LCM:[27,53],CM:[50,56],RCM:[73,53],LW:[18,29],ST:[50,23],RW:[82,29]};
  const fallback=['GK','LB','LCB','RCB','RB','LCM','CM','RCM','LW','ST','RW'], byPosition={};
  starters.forEach((p,i)=>byPosition[p.position||fallback[i]]=p);
  const pitch=Object.entries(pos).map(([key,[x,y]])=>{const p=byPosition[key];return `<div class="match-pitch-player ${p?'filled':'empty'}" style="left:${x}%;top:${y}%">${p?`${p.photo?`<img src="${esc(p.photo)}" alt="">`:`<span class="pitch-avatar">${esc((p.full_name||'P').slice(0,1))}</span>`}<b>${esc(p.full_name)}</b><small>#${esc(p.player_jersey_number||p.shirt_number||'—')}</small>${p.leadership_role==='captain'?'<i>C</i>':''}`:`<span>${key}</span>`}</div>`}).join('');
  app.innerHTML=`${publicHeader('/matches')}<main class="match-page"><button class="back-link" data-route="#/matches">← ALL MATCHES</button>
    <section class="match-hero-card"><div class="match-meta-line"><span>${fmtDate(m.match_date)}</span><span>${fmtTime(m.match_time)||'TBC'}</span><span>${esc(m.venue||'Venue TBC')}</span><span>${esc(m.competition||'MATCH')}</span></div>
      <div class="match-scoreboard"><div class="match-side"><img src="/assets/los-blancos-badge.jpg" alt=""><b>LOS BLANCOS FC</b></div><div class="score-core"><small>${esc(m.status||'MATCH')}</small><strong>${m.status==='finished'?`${esc(m.home_score??0)} <em>—</em> ${esc(m.away_score??0)}`:'VS'}</strong></div><div class="match-side"><div class="opponent-crest">${imageOrPlaceholder(m.opponent_logo,m.opponent_name||'OP')}</div><b>${esc(m.opponent_name||'OPPONENT')}</b></div></div>
    </section>
    <section class="match-lineup-section"><div class="section-intro compact"><div><span class="section-kicker">MATCH LINEUP</span><h2>THE<br><em>XI.</em></h2></div><span class="formation-chip">11 PLAYERS</span></div>
      ${starters.length?`<div class="full-pitch">${pitch}<div class="pitch-half top"></div><div class="pitch-half bottom"></div><div class="pitch-midline"></div><div class="pitch-center"></div><div class="pitch-box-top"></div><div class="pitch-box-bottom"></div><div class="pitch-goal top"></div><div class="pitch-goal bottom"></div></div>`:'<div class="empty-panel">The lineup will appear here when the owner publishes it.</div>'}
      ${subs.length?`<div class="sub-row"><div><span class="section-kicker">BENCH</span><h3>SUBSTITUTES</h3></div><div class="sub-players">${subs.map(p=>`<div class="sub-player">${p.photo?`<img src="${esc(p.photo)}" alt="">`:`<span>${esc((p.full_name||'P').slice(0,1))}</span>`}<b>${esc(p.full_name)}</b><small>#${esc(p.player_jersey_number||p.shirt_number||'—')}</small></div>`).join('')}</div></div>`:''}
    </section>
    ${d.stats.length?`<section class="match-stats-section"><div class="section-kicker">PLAYER PERFORMANCE</div><h2>MATCH <em>IMPACT.</em></h2><div class="performance-table"><div class="performance-head"><span>PLAYER</span><span>APP</span><span>MIN</span><span>G</span><span>A</span><span>YC</span><span>RC</span></div>${d.stats.map(s=>`<div class="performance-row"><span><b>#${esc(s.jersey_number||'—')}</b>${esc(s.full_name)}</span><span>${s.appearances??0}</span><span>${s.minutes??0}</span><span>${s.goals??0}</span><span>${s.assists??0}</span><span>${s.yellow_cards??0}</span><span>${s.red_cards??0}</span></div>`).join('')}</div></section>`:''}
  </main>`;
}
function portalHeader(role,title){
  const owner=role==='owner';
  const name=state.user?.name||state.user?.full_name||state.user?.email||'Club member';
  return `<div class="portal-header"><div><div class="kicker">${owner?'CLUB CONTROL':'PLAYER PORTAL'}</div><h1 class="portal-title">${esc(title)}</h1></div><div class="portal-user"><span>${esc(name)}</span><span class="pill">${owner?'OWNER':'PLAYER'}</span></div></div>`;
}

function sidebar(role,active,count=0){
  const owner=role==='owner';
  const base=owner?'/owner':'/player';
  const links=owner?[
    ['/','Dashboard'],['/requests','Player Requests'],['/players','Players'],['/matches','Matches'],
    ['/lineups','Lineup Centre'],['/statistics','Statistics'],['/teams','Teams'],['/news','News Manager'],
    ['/media','Media Library'],['/notifications','Notifications'],['/settings','Website Settings'],['/audit','Activity Log']
  ]:[
    ['/','Dashboard'],['/profile','My Profile'],['/matches','My Matches'],['/stats','My Stats'],
    ['/lineup','Lineup'],['/notifications','Notifications']
  ];
  return `<aside class="sidebar"><div class="side-title">${owner?'CLUB CONTROL':'MY CLUB'}</div>${links.map(([path,label])=>{
    const route=`${base}${path==='/'?'':path}`;
    const badge=owner&&path==='/requests'&&count?`<span class="badge">${esc(count)}</span>`:'';
    return `<button class="side-btn ${active===path?'active':''}" data-route="#${route}" ${active===path?'aria-current="page"':''}><span>${label}</span>${badge}</button>`;
  }).join('')}</aside>`;
}

async function renderOwner(sub='/'){
  if(!state.user)return nav('/login');
  if(state.user.role!=='owner')return nav('/player');
  let count=0;
  try{const pending=await api('/api/owner/applications/pending-count');count=Number(pending.count)||0;}catch(_){/* The destination page will show its own API error if access is unavailable. */}
  const pages={
    '/':ownerDashboard,'/requests':ownerRequests,'/players':ownerPlayers,'/matches':ownerMatches,
    '/lineups':ownerLineups,'/statistics':ownerStatistics,'/teams':ownerTeams,'/news':ownerNews,
    '/media':ownerMedia,'/notifications':ownerNotifications,'/settings':ownerSettings,'/audit':ownerAudit
  };
  const page=pages[sub];
  if(!page)return nav('/owner');
  return page(count);
}

async function ownerLayout(sub,title,body,count){app.innerHTML=`${publicHeader('',true)}<div class="app-shell">${sidebar('owner',sub,count)}<main class="portal-main">${portalHeader('owner',title)}${body}</main></div>`}
async function ownerDashboard(count){const d=await api('/api/owner/dashboard');const c=d.counts;await ownerLayout('/', 'Dashboard', `<div class="dashboard-actions"><button class="quick-btn" data-route="#/owner/players"><div class="quick-icon">\u{1F464}</div><div class="quick-title">Add / Manage Player</div><div class="quick-note">Create, edit and remove players</div></button><button class="quick-btn" data-route="#/owner/matches"><div class="quick-icon">\u{1F464}</div><div class="quick-title">Add / Manage Match</div><div class="quick-note">Fixtures, results and match details</div></button><button class="quick-btn" data-route="#/owner/lineups"><div class="quick-icon">\u{1F464}</div><div class="quick-title">Manage Lineup</div><div class="quick-note">Formation, starters and substitutes</div></button><button class="quick-btn" data-route="#/owner/requests"><div class="quick-icon">\u{1F464}</div><div class="quick-title">View Requests ${count?`<span class="badge">${count}</span>`:''}</div><div class="quick-note">Approve or reject player registrations</div></button></div><div class="grid grid-4" style="margin-top:18px">${statQuick('Active Players',c.active_players,'')}${statQuick('Upcoming Matches',c.upcoming_matches,'')}${statQuick('Pending Requests',c.pending_requests,'')}${statQuick('Published News',c.published_news,'')}</div><div class="grid grid-2" style="margin-top:18px"><div class="card pad"><div class="split"><div><div class="eyebrow">ACTION NEEDED</div><h2>Pending Player Requests</h2></div><button class="btn outline" data-route="#/owner/requests">View all</button></div>${d.requests.length?`<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Position</th><th>Applied</th><th></th></tr></thead><tbody>${d.requests.map(r=>`<tr><td>${esc(r.full_name)}</td><td>${esc(r.position||'')}</td><td>${fmtDate(r.created_at)}</td><td><button class="btn success" data-action="approve-request" data-id="${r.id}">Approve</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No pending requests.</div>`}</div><div class="card pad"><div class="split"><div><div class="eyebrow">RECENT ALERTS</div><h2>Notifications</h2></div><button class="btn outline" data-route="#/owner/notifications">View all</button></div>${d.notifications.map(n=>`<div class="notification-item ${n.is_read?'':'unread'}"><strong>${esc(n.title)}</strong><p class="muted">${esc(n.message)}</p></div>`).join('')||`<div class="empty">No notifications yet.</div>`}</div></div>` ,count)}
async function ownerRequests(count){const rows=await api('/api/owner/applications');await ownerLayout('/requests','Player Requests',`<div class="card pad"><div class="search-row"><input id="request-search" class="input" placeholder="Search requests by name, email or position..."><button class="btn outline" data-action="refresh">? Refresh</button></div><div class="table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Player</th><th>Email</th><th>Position</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead><tbody id="request-rows">${requestRows(rows)}</tbody></table></div></div>`,count);document.getElementById('request-search').addEventListener('input',e=>{document.getElementById('request-rows').innerHTML=requestRows(rows.filter(r=>`${r.full_name} ${r.email} ${r.position||''}`.toLowerCase().includes(e.target.value.toLowerCase())))})}
function requestRows(rows){return rows.map(r=>`<tr><td><strong>${esc(r.full_name)}</strong><div class="small muted">#${esc(r.jersey_number||'—')}</div></td><td>${esc(r.email)}</td><td>${esc(r.position||'—')}</td><td><span class="pill">${esc(r.status)}</span></td><td>${fmtDate(r.created_at)}</td><td><div class="action-row">${r.status==='pending'?`<button class="btn success" data-action="approve-request" data-id="${r.id}">Approve</button><button class="btn danger" data-action="reject-request" data-id="${r.id}">Reject</button>`:`<button class="btn outline" data-action="view-request" data-id="${r.id}">View</button>`}</div></td></tr>`).join('')||`<tr><td colspan="6"><div class="empty">No requests found.</div></td></tr>`}
async function ownerPlayers(count){const rows=await api('/api/owner/players');await ownerLayout('/players','Players',`<div class="split" style="margin-bottom:15px"><div class="muted">Manage the official squad from one place.</div><button class="btn gold-btn" data-action="add-player">+ Add Player</button></div><div class="card pad"><div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Number</th><th>Position</th><th>Team</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${esc(p.full_name)}</strong></td><td>${esc(p.jersey_number||'—')}</td><td>${esc(p.position||'')}</td><td>${esc(p.team||'')}</td><td><span class="pill">${esc(p.approval_status)}</span></td><td><div class="action-row"><button class="btn outline" data-action="edit-player" data-id="${p.id}">Edit</button><button class="btn danger" data-action="delete-player" data-id="${p.id}">Delete</button></div></td></tr>`).join('')||`<tr><td colspan="6"><div class="empty">No players yet.</div></td></tr>`}</tbody></table></div></div>`,count)}
async function ownerMatches(count){const rows=await api('/api/owner/matches');await ownerLayout('/matches','Matches',`<div class="split" style="margin-bottom:15px"><div class="muted">Create fixtures, enter results, manage backgrounds and open matchday tools.</div><button class="btn gold-btn" data-action="add-match">+ Add Match</button></div><div class="card pad"><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Opponent</th><th>Competition</th><th>Venue</th><th>Status</th><th>Score</th><th>Actions</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${fmtDate(m.match_date)}<div class="small muted">${fmtTime(m.match_time)}</div></td><td>${esc(m.opponent_name||'TBC')}</td><td>${esc(m.competition||'')}</td><td>${esc(m.venue||'')}</td><td><span class="pill">${esc(m.status)}</span></td><td>${m.status==='finished'?`${m.home_score??0}-${m.away_score??0}`:'—'}</td><td><div class="action-row"><button class="btn outline" data-action="edit-match" data-id="${m.id}">Edit</button><button class="btn primary" data-action="manage-lineup" data-id="${m.id}">Lineup</button><button class="btn outline" data-action="manage-stats" data-id="${m.id}">Stats</button><button class="btn danger" data-action="delete-match" data-id="${m.id}">Delete</button></div></td></tr>`).join('')||`<tr><td colspan="7"><div class="empty">No matches yet.</div></td></tr>`}</tbody></table></div></div>`,count)}
async function ownerLineups(count){const rows=await api('/api/owner/matches');await ownerLayout('/lineups','Lineup Centre',`<div class="notice">Every match has its own lineup workspace. Pick a match below, then set starters, substitutes, positions and shirt numbers.</div><div class="grid grid-2" style="margin-top:16px">${rows.map(m=>`<div class="card pad"><div class="eyebrow">${fmtDate(m.match_date)}</div><h2>Los Blancos FC vs ${esc(m.opponent_name||'TBC')}</h2><div class="muted">${esc(m.venue||'Venue TBC')} • ${esc(m.status)}</div><button class="btn primary" style="margin-top:14px" data-action="manage-lineup" data-id="${m.id}">Open Lineup Workspace</button></div>`).join('')||`<div class="empty">Create a match first.</div>`}</div>`,count)}
async function ownerStatistics(count){const rows=await api('/api/public/stats');await ownerLayout('/statistics','Statistics',`<div class="card pad"><div class="split"><div><div class="eyebrow">SEASON PERFORMANCE</div><h2>Squad Statistics</h2></div><button class="btn outline" data-route="#/owner/matches">Open Match Stats</button></div><div class="table-wrap" style="margin-top:14px"><table class="table"><thead><tr><th>Player</th><th>Apps</th><th>Goals</th><th>Assists</th><th>YC</th><th>RC</th></tr></thead><tbody>${rows.map(r=>`<tr><td>#${esc(r.jersey_number||'—')} ${esc(r.full_name)}</td><td>${r.appearances}</td><td class="gold">${r.goals}</td><td>${r.assists}</td><td>${r.yellow_cards}</td><td>${r.red_cards}</td></tr>`).join('')||`<tr><td colspan="6" class="muted">No statistics yet.</td></tr>`}</tbody></table></div></div>`,count)}
async function ownerTeams(count){const rows=await api('/api/owner/teams');await ownerLayout('/teams','Teams',`<div class="split" style="margin-bottom:15px"><div class="muted">Manage opponent clubs used across fixtures and match centres.</div><button class="btn gold-btn" data-action="add-team">+ Add Team</button></div><div class="card pad"><div class="table-wrap"><table class="table"><thead><tr><th>Team</th><th>Short</th><th>City</th><th>Actions</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.team_name)}</td><td>${esc(t.short_name||'')}</td><td>${esc(t.home_city||'')}</td><td><div class="action-row"><button class="btn outline" data-action="edit-team" data-id="${t.id}">Edit</button><button class="btn danger" data-action="delete-team" data-id="${t.id}">Delete</button></div></td></tr>`).join('')||`<tr><td colspan="4"><div class="empty">No teams yet.</div></td></tr>`}</tbody></table></div></div>`,count)}
async function ownerNews(count){const rows=await api('/api/owner/news');await ownerLayout('/news','News Manager',`<div class="split" style="margin-bottom:15px"><div class="muted">Publish club stories, match reports and announcements.</div><button class="btn gold-btn" data-action="add-news">+ Create Story</button></div><div class="grid grid-2">${rows.map(n=>`<div class="card pad"><div class="split"><span class="pill">${esc(n.status)}</span><span class="small muted">${fmtDate(n.published_at||n.created_at)}</span></div><h2>${esc(n.title)}</h2><p class="muted">${esc(n.excerpt||'')}</p><div class="action-row"><button class="btn outline" data-action="edit-news" data-id="${n.id}">Edit</button><button class="btn danger" data-action="delete-news" data-id="${n.id}">Delete</button></div></div>`).join('')||`<div class="empty">No stories yet.</div>`}</div>`,count)}
async function ownerMedia(count){const rows=await api('/api/owner/media');await ownerLayout('/media','Media Library',`<div class="grid grid-3"><div class="card pad"><div class="eyebrow">BRANDING</div><h2>Club Logo</h2><p class="muted">Upload a new badge and activate it. The public header and homepage will use it automatically.</p><button class="btn gold-btn" data-action="upload-media" data-type="logo">+ Upload Logo</button></div><div class="card pad"><div class="eyebrow">HOMEPAGE</div><h2>Hero Background</h2><p class="muted">Change the cinematic homepage atmosphere whenever you want.</p><button class="btn gold-btn" data-action="upload-media" data-type="background">+ Upload Background</button></div><div class="card pad"><div class="eyebrow">GALLERY</div><h2>Club Media</h2><p class="muted">Keep photos and matchday media ready for the public media experience.</p><button class="btn primary" data-action="upload-media" data-type="gallery">+ Upload Gallery Media</button></div></div><div class="grid grid-3" style="margin-top:18px">${rows.map(m=>`<div class="card pad media-card"><img src="${esc(m.file_path)}" alt="${esc(m.title)}" style="width:100%;height:210px;object-fit:cover;border-radius:14px;margin-bottom:14px"><div class="split"><strong>${esc(m.title)}</strong>${m.is_active?'<span class="pill">Active</span>':''}</div><div class="small muted">${esc(m.media_type)}${m.team_name?` • ${esc(m.team_name)}`:''}</div><div class="action-row" style="margin-top:10px">${(['background','logo'].includes(m.media_type)&&!m.is_active)?`<button class="btn success" data-action="activate-media" data-id="${m.id}">Set Active</button>`:''}<button class="btn danger" data-action="delete-media" data-id="${m.id}">Delete</button></div></div>`).join('')||`<div class="empty">No media uploaded yet.</div>`}</div>`,count)}
async function ownerSettings(count){const s=await api('/api/owner/settings');await ownerLayout('/settings','Website Settings',`<div class="grid grid-2"><div class="card pad"><div class="eyebrow">IDENTITY</div><h2>Club Branding</h2><p class="muted">Change the public identity without touching the code. Upload backgrounds and logos from Media Library, then activate them.</p><form id="settings-form" class="form-grid"><div class="field full"><label>Club name</label><input class="input" name="club_name" value="${esc(s.club_name||'Los Blancos FC')}"></div><div class="field full"><label>Tagline</label><input class="input" name="tagline" value="${esc(s.tagline||'Dream • Play • Conquer')}"></div><div class="field full"><label>Hero background URL</label><input class="input" name="hero_background" value="${esc(s.hero_background||'')}" placeholder="Optional external image URL"></div><div class="field full"><label>Logo URL</label><input class="input" name="logo_url" value="${esc(s.logo_url||'')}" placeholder="Activate a logo from Media Library or paste an image URL"></div><div class="field full"><button class="btn primary" type="submit">Save Website Settings</button></div></form></div><div class="card pad"><div class="eyebrow">CONTROL CENTRE</div><h2>Visual Control</h2><div class="mini-list"><button class="quick-btn" data-route="#/owner/media"><strong>Media Library</strong><div class="quick-note">Upload and activate logos, hero backgrounds and gallery media.</div></button><button class="quick-btn" data-route="#/owner/news"><strong>Newsroom</strong><div class="quick-note">Publish stories and match reports.</div></button><button class="quick-btn" data-route="#/owner/audit"><strong>Activity Log</strong><div class="quick-note">Review important owner actions.</div></button></div></div></div>`,count);const form=document.getElementById('settings-form');if(form)form.addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(form).entries());const r=await api('/api/owner/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});notify(r.message);await renderOwner('/settings')}catch(err){notify(err.message,'error')}})}
async function ownerAudit(count){const rows=await api('/api/owner/audit');await ownerLayout('/audit','Activity Log',`<div class="card pad"><div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Area</th><th>Details</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.email||'')}</td><td>${esc(r.action)}</td><td>${esc(r.entity_type||'')}</td><td>${esc(r.details||'')}</td></tr>`).join('')||`<tr><td colspan="5" class="muted">No audit entries yet.</td></tr>`}</tbody></table></div></div>`,count)}
async function ownerNotifications(count){const rows=await api('/api/notifications');await ownerLayout('/notifications','Notifications',`<div class="split" style="margin-bottom:14px"><div class="muted">New registration requests and club alerts appear here.</div><button class="btn outline" data-action="read-all">Mark all read</button></div><div>${rows.map(n=>`<div class="notification-item ${n.is_read?'':'unread'}"><div class="split"><strong>${esc(n.title)}</strong><span class="small muted">${fmtDate(n.created_at)}</span></div><p class="muted">${esc(n.message)}</p><div class="notification-actions">${n.link?`<button class="btn primary" data-route="${esc(n.link)}">Open</button>`:''}${!n.is_read?`<button class="btn outline" data-action="read-notification" data-id="${n.id}">Mark read</button>`:''}</div></div>`).join('')||`<div class="empty">No notifications.</div>`}</div>`,count)}

async function renderPlayer(sub='/'){
  if(!state.user) return nav('/login'); if(state.user.role!=='player')return nav('/owner');
  if(sub==='/')return playerDashboard(); if(sub==='/profile')return playerProfile(); if(sub==='/matches')return playerMatches(); if(sub==='/stats')return playerStats(); if(sub==='/lineup')return playerLineup(); if(sub==='/notifications')return playerNotifications(); return nav('/player');
}
async function playerLayout(sub,title,body){const notes=await api('/api/notifications');const unread=notes.filter(n=>!n.is_read).length;app.innerHTML=`${publicHeader('',true)}<div class="app-shell">${sidebar('player',sub,unread)}<main class="portal-main">${portalHeader('player',title)}${body}</main></div>`}
async function playerDashboard(){const d=await api('/api/player/me');const n=await api('/api/notifications');await playerLayout('/', 'Player Dashboard', `<div class="profile-grid"><div class="card pad"><div class="profile-header"><div class="profile-avatar">${imageOrPlaceholder(d.player?.photo||d.application?.photo,d.player?.full_name||d.application?.full_name||'Player')}</div><div><div class="eyebrow">MY PROFILE</div><h2>${esc(d.player?.full_name||d.application?.full_name||'Your profile')}</h2><p class="muted">${d.player?.approval_status==='approved'?'<span class="pill">Approved</span>':'<span class="pill">Pending approval</span>'}</p></div></div><div class="action-row" style="margin-top:18px"><button class="btn primary" data-route="#/player/profile">Edit Profile</button><button class="btn outline" data-route="#/player/stats">View Stats</button><button class="btn outline" data-route="#/player/lineup">View Lineup</button></div></div><div class="card pad"><div class="eyebrow">RECENT NOTIFICATIONS</div><h2>Stay updated</h2>${n.slice(0,4).map(x=>`<div class="notification-item ${x.is_read?'':'unread'}"><strong>${esc(x.title)}</strong><p class="muted">${esc(x.message)}</p></div>`).join('')||`<div class="empty">No notifications yet.</div>`}</div></div><div class="dashboard-actions" style="margin-top:18px"><button class="quick-btn" data-route="#/player/matches"><div class="quick-icon">\u{1F464}</div><div class="quick-title">My Matches</div><div class="quick-note">See all scheduled matches and your lineup status</div></button><button class="quick-btn" data-route="#/player/stats"><div class="quick-icon">\u{1F464}</div><div class="quick-title">My Stats</div><div class="quick-note">Goals, assists and appearances</div></button><button class="quick-btn" data-route="#/player/lineup"><div class="quick-icon">\u{1F464}</div><div class="quick-title">Lineup</div><div class="quick-note">Check published match lineups</div></button><button class="quick-btn" data-route="#/player/notifications"><div class="quick-icon">\u{1F464}</div><div class="quick-title">Notifications</div><div class="quick-note">Approval and club updates</div></button></div>`)}
async function playerProfile(){const d=await api('/api/player/me');const p=d.player||d.application||{};await playerLayout('/profile','My Profile',`<div class="card pad"><div class="notice">Profile changes are sent back to the owner for approval before they become official.</div><form id="player-profile-form" class="form-grid" enctype="multipart/form-data" style="margin-top:16px"><div class="field"><label>Full name</label><input class="input" name="full_name" value="${esc(p.full_name||'')}" required></div><div class="field"><label>New photo</label><input class="input" name="photo" type="file" accept="image/*"></div><div class="field"><label>Jersey number</label><input class="input" name="jersey_number" type="number" value="${esc(p.jersey_number||'')}"></div><div class="field"><label>Position</label><select class="select" name="position"><option ${p.position?'':'selected'} value="">Select</option>${['Goalkeeper','Defender','Midfielder','Forward'].map(x=>`<option ${p.position===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Date of birth</label><input class="input" name="date_of_birth" type="date" value="${esc(p.date_of_birth||'')}"></div><div class="field"><label>Preferred foot</label><select class="select" name="preferred_foot"><option value="">Select</option>${['Right','Left','Both'].map(x=>`<option ${p.preferred_foot===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(p.phone||'')}"></div><div class="field full"><label>Bio</label><textarea class="textarea" name="bio">${esc(p.bio||'')}</textarea></div><div class="field full"><button class="btn primary" type="submit">Submit Changes for Approval</button></div></form></div>`) }
async function playerMatches(){
  const rows=await api('/api/player/matches');

  await playerLayout(
    '/matches',
    'My Matches',
    `<div class="notice">
      Scheduled club matches are shown here automatically.
      You do not need to be selected in the starting XI.
    </div>

    <div class="grid grid-2" style="margin-top:16px">
      ${rows.map(r=>`
        <div class="card pad">
          <div class="eyebrow">${fmtDate(r.match_date)}</div>
          <h2>vs ${esc(r.opponent_name||'Opponent')}</h2>
          <div class="muted">
            ${esc(r.competition||'Match')}
            • ${esc(r.venue||'Venue TBC')}
          </div>
          <div class="action-row" style="margin-top:14px">
            <span class="pill">${esc(r.status||'scheduled')}</span>
            <button class="btn outline" data-route="#/match/${r.id}">
              Open Match Centre
            </button>
          </div>
        </div>
      `).join('') || `<div class="empty">No matches available yet.</div>`}
    </div>`
  );
}async function playerStats(){const d=await api('/api/player/stats');await playerLayout('/stats','My Stats',`<div class="grid grid-4">${statQuick('Appearances',d.stats.appearances,'')}${statQuick('Goals',d.stats.goals,'')}${statQuick('Assists',d.stats.assists,'')}${statQuick('Cards',`${d.stats.yellow_cards}/${d.stats.red_cards}`,'')}</div><div class="card pad" style="margin-top:18px"><div class="eyebrow">MATCH LOG</div><h2>Your match-by-match stats</h2><div class="table-wrap"><table class="table"><thead><tr><th>Match</th><th>Apps</th><th>Min</th><th>Goals</th><th>Assists</th></tr></thead><tbody>${d.matches.map(m=>`<tr><td>${fmtDate(m.match_date)} vs ${esc(m.opponent_name||'Opponent')}</td><td>${m.appearances}</td><td>${m.minutes}</td><td>${m.goals}</td><td>${m.assists}</td></tr>`).join('')||`<tr><td colspan="5" class="muted">No statistics yet.</td></tr>`}</tbody></table></div></div>`)}
async function playerLineup(){const rows=await api('/api/player/lineup');await playerLayout('/lineup','My Lineup',`<div class="notice">This page shows lineup selections published by the owner. Your owner controls the formation and selection.</div><div class="grid grid-2" style="margin-top:16px">${rows.map(r=>`<div class="card pad"><div class="eyebrow">${fmtDate(r.match_date)}</div><h2>vs ${esc(r.opponent_name||'Opponent')}</h2><div class="muted">${esc(r.position||'Position TBC')} • #${esc(r.shirt_number||'—')} • ${r.is_starter?'Starter':'Substitute'}</div><button class="btn outline" style="margin-top:13px" data-route="#/match/${r.match_id}">Open Match Centre</button></div>`).join('')||`<div class="empty">You have not been placed in a published lineup yet.</div>`}</div>`)}
async function playerNotifications(){const rows=await api('/api/notifications');await playerLayout('/notifications','Notifications',`<div class="split" style="margin-bottom:14px"><div class="muted">Approval messages, match updates and club alerts.</div><button class="btn outline" data-action="read-all">Mark all read</button></div>${rows.map(n=>`<div class="notification-item ${n.is_read?'':'unread'}"><div class="split"><strong>${esc(n.title)}</strong><span class="small muted">${fmtDate(n.created_at)}</span></div><p class="muted">${esc(n.message)}</p><div class="notification-actions">${n.link?`<button class="btn primary" data-route="${esc(n.link)}">Open</button>`:''}${!n.is_read?`<button class="btn outline" data-action="read-notification" data-id="${n.id}">Mark read</button>`:''}</div></div>`).join('')||`<div class="empty">No notifications yet.</div>`}`)}

function modal(title,content){modalRoot.innerHTML=`<div class="modal-backdrop" data-modal-backdrop><div class="modal" data-stop><div class="modal-head"><strong>${title}</strong><button class="close" data-action="close-modal">×</button></div><div class="modal-body">${content}</div></div></div>`}

function playerForm(p={}){return `<form id="player-modal-form" class="form-grid" enctype="multipart/form-data"><div class="field"><label>Full name</label><input class="input" name="full_name" value="${esc(p.full_name||'')}" required></div><div class="field"><label>Photo</label><input class="input" name="photo" type="file" accept="image/*"></div><div class="field"><label>Jersey number</label><input class="input" name="jersey_number" type="number" value="${esc(p.jersey_number||'')}"></div><div class="field"><label>Position</label><select class="select" name="position"><option value="">Select</option>${['Goalkeeper','Defender','Midfielder','Forward'].map(x=>`<option ${p.position===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Date of birth</label><input class="input" name="date_of_birth" type="date" value="${esc(p.date_of_birth||'')}"></div><div class="field"><label>Preferred foot</label><select class="select" name="preferred_foot"><option value="">Select</option>${['Right','Left','Both'].map(x=>`<option ${p.preferred_foot===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(p.phone||'')}"></div><div class="field"><label>Team</label><input class="input" name="team" value="${esc(p.team||'Los Blancos FC')}"></div><div class="field full"><label>Bio</label><textarea class="textarea" name="bio">${esc(p.bio||'')}</textarea></div><div class="form-actions field full"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Player</button></div></form>`}
function matchForm(m={},teams=[]){return `<form id="match-modal-form" class="form-grid" enctype="multipart/form-data"><div class="field"><label>Opponent</label><select class="select" name="opponent_id"><option value="">Select opponent</option>${teams.map(t=>`<option value="${t.id}" ${String(t.id)===String(m.opponent_id)?'selected':''}>${esc(t.team_name)}</option>`).join('')}</select></div><div class="field"><label>Competition</label><input class="input" name="competition" value="${esc(m.competition||'')}" placeholder="League / Friendly / Cup"></div><div class="field"><label>Date</label><input class="input" name="match_date" type="date" value="${esc(m.match_date||'')}" required></div><div class="field"><label>Time</label><input class="input" name="match_time" type="time" value="${esc(m.match_time||'')}"></div><div class="field"><label>Venue</label><input class="input" name="venue" value="${esc(m.venue||'')}"></div><div class="field"><label>Status</label><select class="select" name="status">${['scheduled','live','finished','postponed','cancelled'].map(x=>`<option ${m.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Los Blancos score</label><input class="input" type="number" min="0" name="home_score" value="${m.home_score??''}"></div><div class="field"><label>Opponent score</label><input class="input" type="number" min="0" name="away_score" value="${m.away_score??''}"></div><div class="field full"><label>Headline</label><input class="input" name="headline" value="${esc(m.headline||'')}" placeholder="e.g. Los Blancos FC Secure Three Points"></div><div class="field full"><label>Notes</label><textarea class="textarea" name="notes">${esc(m.notes||'')}</textarea></div><div class="field full"><label>Match background</label><input class="input" type="file" name="background" accept="image/*"></div><div class="form-actions field full"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Match</button></div></form>`}

async function openPlayerModal(id){let p={};if(id){const rows=await api('/api/owner/players');p=rows.find(x=>String(x.id)===String(id))||{}}modal(id?'Edit Player':'Add Player',playerForm(p));const form=document.getElementById('player-modal-form');form.addEventListener('submit',async e=>{e.preventDefault();try{const fd=new FormData(form);const res=await api(id?`/api/owner/players/${id}`:'/api/owner/players',{method:id?'PUT':'POST',body:fd});notify(res.message);modalRoot.innerHTML='';await renderOwner('/players')}catch(err){notify(err.message,'error')}})}
async function openMatchModal(id){const teams=await api('/api/owner/teams');let m={};if(id){const rows=await api('/api/owner/matches');m=rows.find(x=>String(x.id)===String(id))||{}}modal(id?'Edit Match':'Add Match',matchForm(m,teams));const form=document.getElementById('match-modal-form');form.addEventListener('submit',async e=>{e.preventDefault();try{const fd=new FormData(form);const res=await api(id?`/api/owner/matches/${id}`:'/api/owner/matches',{method:id?'PUT':'POST',body:fd});notify(res.message);modalRoot.innerHTML='';await renderOwner('/matches')}catch(err){notify(err.message,'error')}})}
async function openTeamModal(id){let t={};if(id){const rows=await api('/api/owner/teams');t=rows.find(x=>String(x.id)===String(id))||{}}modal(id?'Edit Team':'Add Team',`<form id="team-form" class="form-grid" enctype="multipart/form-data"><div class="field full"><label>Team name</label><input class="input" name="team_name" value="${esc(t.team_name||'')}" required></div><div class="field"><label>Short name</label><input class="input" name="short_name" value="${esc(t.short_name||'')}"></div><div class="field"><label>Home city</label><input class="input" name="home_city" value="${esc(t.home_city||'')}"></div><div class="field full"><label>Logo</label><input class="input" type="file" name="logo" accept="image/*"></div><div class="form-actions field full"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Team</button></div></form>`);document.getElementById('team-form').addEventListener('submit',async e=>{e.preventDefault();try{const res=await api(id?`/api/owner/teams/${id}`:'/api/owner/teams',{method:id?'PUT':'POST',body:new FormData(e.target)});notify(res.message);modalRoot.innerHTML='';await renderOwner('/teams')}catch(err){notify(err.message,'error')}})}
function uploadMediaModal(type='background'){modal('Upload Media',`<form id="media-form" class="form-grid" enctype="multipart/form-data"><div class="field full"><label>Title</label><input class="input" name="title" placeholder="Matchday background / stadium photo" required></div><div class="field"><label>Type</label><select class="select" name="media_type"><option ${type==='background'?'selected':''}>background</option><option ${type==='match'?'selected':''}>match</option><option>gallery</option><option>logo</option></select></div><div class="field"><label>Match (optional)</label><select class="select" name="match_id"><option value="">No match</option></select></div><div class="field full"><label>Image</label><input class="input" name="file" type="file" accept="image/*" required></div><div class="form-actions field full"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Upload</button></div></form>`);api('/api/owner/matches').then(rows=>{const s=document.querySelector('#media-form select[name=match_id]');if(s)s.innerHTML='<option value="">No match</option>'+rows.map(m=>`<option value="${m.id}">${fmtDate(m.match_date)} vs ${esc(m.opponent_name||'TBC')}</option>`).join('')});document.getElementById('media-form').addEventListener('submit',async e=>{e.preventDefault();try{const res=await api('/api/owner/media',{method:'POST',body:new FormData(e.target)});notify(res.message);modalRoot.innerHTML='';await renderOwner('/media')}catch(err){notify(err.message,'error')}})}
async function openNewsModal(id){let n={};if(id){const rows=await api('/api/owner/news');n=rows.find(x=>String(x.id)===String(id))||{}}modal(id?'Edit Story':'Create Story',`<form id="news-form" class="form-grid" enctype="multipart/form-data"><div class="field full"><label>Title</label><input class="input" name="title" value="${esc(n.title||'')}" required></div><div class="field full"><label>Excerpt</label><input class="input" name="excerpt" value="${esc(n.excerpt||'')}"></div><div class="field full"><label>Story</label><textarea class="textarea" name="body" required>${esc(n.body||'')}</textarea></div><div class="field"><label>Status</label><select class="select" name="status"><option ${n.status==='draft'?'selected':''}>draft</option><option ${n.status==='published'?'selected':''}>published</option></select></div><div class="field"><label>Cover image</label><input class="input" type="file" name="image" accept="image/*"></div><div class="form-actions field full"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Story</button></div></form>`);document.getElementById('news-form').addEventListener('submit',async e=>{e.preventDefault();try{const res=await api(id?`/api/owner/news/${id}`:'/api/owner/news',{method:id?'PUT':'POST',body:new FormData(e.target)});notify(res.message);modalRoot.innerHTML='';await renderOwner('/news')}catch(err){notify(err.message,'error')}})}

async function openLineupModal(matchId){
  const d=await api(`/api/owner/matches/${matchId}/lineup`);
  const current=d.lineup.filter(x=>x.is_starter!==0);
  const assignments={};
  const roles={};

  current.forEach(x=>{
    if(x.position) assignments[x.position]=String(x.player_id);
    if(x.leadership_role) roles[String(x.player_id)]=x.leadership_role;
  });

  const positions=[
    ['GK','Goalkeeper'],
    ['LB','Left Back'],
    ['LCB','Left Centre Back'],
    ['RCB','Right Centre Back'],
    ['RB','Right Back'],
    ['LCM','Left Midfield'],
    ['CM','Centre Midfield'],
    ['RCM','Right Midfield'],
    ['LW','Left Wing'],
    ['ST','Striker'],
    ['RW','Right Wing']
  ];

  const escPhoto=p=>p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.full_name)}">`:'<span class="lineup-photo-empty"></span>';

  const playerById=id=>d.players.find(p=>String(p.id)===String(id));

  const renderSlot=(pos,label)=>{ const coords={GK:[50,88],LB:[16,70],LCB:[38,73],RCB:[62,73],RB:[84,70],LCM:[27,52],CM:[50,55],RCM:[73,52],LW:[17,29],ST:[50,24],RW:[83,29]}; const [slotX,slotY]=coords[pos]||[50,50];
    const id=assignments[pos];
    const p=playerById(id);
    if(!p){
      return `<div class="lineup-slot empty-slot" data-position="${pos}" style="left:${slotX}%;top:${slotY}%;">
        <div class="slot-position">${label}</div>
        <div class="slot-placeholder">+</div>
        <div class="slot-hint">Tap or drop player</div>
      </div>`;
    }
    const role=roles[String(p.id)];
    return `<div class="lineup-slot filled-slot" data-position="${pos}" style="left:${slotX}%;top:${slotY}%;">
      <div class="slot-position">${label}</div>
      <div class="lineup-player-photo">${escPhoto(p)}</div>
      <div class="lineup-number">#${esc(p.jersey_number||'')}</div>
      <div class="lineup-player-name">${esc(p.full_name)}</div>
      ${role==='captain'?'<span class="leadership-badge captain-badge">C</span>':''}
      ${role==='vice_captain'?'<span class="leadership-badge vice-badge">VC</span>':''}
    </div>`;
  };

  const renderPitch=()=>{
    const pitch=document.getElementById('lineup-pitch');
    if(!pitch)return;
    pitch.querySelectorAll('.lineup-slot').forEach(x=>x.remove());

    const coords={
      GK:[50,89],
      LB:[18,72],LCB:[39,75],RCB:[61,75],RB:[82,72],
      LCM:[28,55],CM:[50,57],RCM:[72,55],
      LW:[18,30],ST:[50,24],RW:[82,30]
    };

    positions.forEach(([pos,label])=>{
      const slot=document.createElement('div');
      slot.outerHTML=renderSlot(pos,label);
      pitch.insertAdjacentHTML('beforeend',renderSlot(pos,label));
    });
  };

  const renderRoster=()=>{
    const roster=document.getElementById('lineup-roster');
    if(!roster)return;

    roster.innerHTML=d.players.map(p=>{
      const assigned=Object.values(assignments).includes(String(p.id));
      const role=roles[String(p.id)]||'';
      return `<div class="lineup-roster-player ${assigned?'assigned':''}" draggable="true" data-player-id="${p.id}">
        <div class="roster-photo">${escPhoto(p)}</div>
        <div class="roster-info">
          <strong>${esc(p.full_name)}</strong>
          <span>#${esc(p.jersey_number||'')}  ${esc(p.position||'Player')}</span>
        </div>
        <select class="select lineup-role" data-role-player="${p.id}">
          <option value="">No role</option>
          <option value="captain" ${role==='captain'?'selected':''}>Captain</option>
          <option value="vice_captain" ${role==='vice_captain'?'selected':''}>Vice Captain</option>
        </select>
      </div>`;
    }).join('');
  };

  const choosePlayer=(position,playerId)=>{
    if(playerId){
      Object.keys(assignments).forEach(k=>{
        if(assignments[k]===String(playerId)&&k!==position)delete assignments[k];
      });
      assignments[position]=String(playerId);
    }else{
      delete assignments[position];
    }
    renderPitch();
    renderRoster();
    bindLineupEvents();
  };

  const openSlotPicker=(position)=>{
    const existing=assignments[position]||'';
    const options=d.players.map(p=>{
      const used=Object.entries(assignments).some(([k,v])=>k!==position&&v===String(p.id));
      return `<option value="${p.id}" ${existing===String(p.id)?'selected':''} ${used?'disabled':''}>#${esc(p.jersey_number||'')} ${esc(p.full_name)}</option>`;
    }).join('');

    const slot=document.querySelector(`.lineup-slot[data-position="${position}"]`);
    if(!slot)return;

    slot.classList.add('picker-open');
    const old=slot.querySelector('.slot-picker');
    if(old)old.remove();

    slot.insertAdjacentHTML('beforeend',`<select class="slot-picker" data-slot-picker="${position}">
      <option value="">Select player...</option>${options}
    </select>`);

    const select=slot.querySelector('.slot-picker');
    select.focus();
    select.addEventListener('change',()=>{
      choosePlayer(position,select.value);
    });
  };

  const bindLineupEvents=()=>{
    document.querySelectorAll('.lineup-slot').forEach(slot=>{
      slot.onclick=e=>{
        if(e.target.closest('.slot-picker'))return;
        openSlotPicker(slot.dataset.position);
      };
      slot.ondragover=e=>e.preventDefault();
      slot.ondrop=e=>{
        e.preventDefault();
        const id=e.dataTransfer.getData('text/plain');
        choosePlayer(slot.dataset.position,id);
      };
    });

    document.querySelectorAll('.lineup-roster-player').forEach(card=>{
      card.ondragstart=e=>{
        e.dataTransfer.setData('text/plain',card.dataset.playerId);
      };
    });

    document.querySelectorAll('.lineup-role').forEach(select=>{
      select.onchange=()=>{
        const id=String(select.dataset.rolePlayer);
        const role=select.value;

        Object.keys(roles).forEach(k=>{
          if(k===id)delete roles[k];
        });

        if(role){
          Object.keys(roles).forEach(k=>{
            if(roles[k]===role)delete roles[k];
          });
          roles[id]=role;
        }

        renderPitch();
        renderRoster();
        bindLineupEvents();
      };
    });
  };

  modal('Lineup Studio',`
    <div class="lineup-editor">
      <div class="lineup-stadium">
        <div class="stadium-lights"></div>
        <div class="stadium-stand stand-top">LOS BLANCOS FC  LINEUP STUDIO</div>
        <div class="lineup-pitch" id="lineup-pitch">
          <div class="pitch-markings"></div>
        </div>
        <div class="stadium-stand stand-bottom">DISCIPLINE  UNITY  VICTORY</div>
      </div>

      <div class="card pad lineup-control-panel">
        <div class="split">
          <div>
            <div class="eyebrow">MATCH LINEUP</div>
            <h2>Starting XI</h2>
          </div>
          <span class="pill">11 Positions</span>
        </div>

        <p class="muted small">Drag a player onto the pitch, or tap a position to choose a player.</p>

        <div class="leadership-help">
          <span><b class="captain-text">C</b> Captain</span>
          <span><b class="vice-text">VC</b> Vice Captain</span>
        </div>

        <div id="lineup-roster" class="lineup-roster"></div>

        <div class="form-actions">
          <button class="btn outline" data-action="close-modal">Cancel</button>
          <button class="btn gold-btn" data-action="save-lineup" data-id="${matchId}">Save Starting XI</button>
        </div>
      </div>
    </div>
  `);

  renderPitch();
  renderRoster();
  bindLineupEvents();

  window.__activeLineup={
    players:d.players,
    assignments,
    roles
  };
}

async function saveLineup(id){
  const editor=window.__activeLineup;

  if(!editor){
    notify('Lineup editor is not ready.','error');
    return;
  }

  const positions=Object.entries(editor.assignments);
  const roles=editor.roles||{};

  if(positions.length!==11){
    notify(`Please assign all 11 positions. ${positions.length}/11 selected.`,'error');
    return;
  }

  const used=new Set();

  for(const [,playerId] of positions){
    if(used.has(String(playerId))){
      notify('A player cannot occupy two positions.','error');
      return;
    }
    used.add(String(playerId));
  }

  const captainIds=Object.keys(roles).filter(id=>roles[id]==='captain');
  const viceIds=Object.keys(roles).filter(id=>roles[id]==='vice_captain');

  if(captainIds.length>1){
    notify('Only one Captain is allowed.','error');
    return;
  }

  if(viceIds.length>1){
    notify('Only one Vice Captain is allowed.','error');
    return;
  }

  const players=positions.map(([position,playerId])=>({
    player_id:Number(playerId),
    position:position,
    is_starter:true,
    shirt_number:null,
    leadership_role:roles[playerId]||null
  }));

  try{
    const r=await api(`/api/owner/matches/${id}/lineup`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({players})
    });

    notify(r.message||'Starting XI saved successfully.');

    window.__activeLineup=null;
    modalRoot.innerHTML='';

    await renderOwner('/lineups');

  }catch(e){
    console.error('LINEUP SAVE ERROR:',e);
    notify(e.message||'Could not save lineup.','error');
  }
}async function openStatsModal(matchId){const d=await api(`/api/owner/matches/${matchId}/stats`);const byId=new Map(d.stats.map(x=>[String(x.player_id),x]));modal('Match Statistics',`<form id="stats-form"><div class="table-wrap"><table class="table"><thead><tr><th>Player</th><th>Apps</th><th>Min</th><th>Goals</th><th>Assists</th><th>YC</th><th>RC</th></tr></thead><tbody>${d.players.map(p=>{const s=byId.get(String(p.id))||{};return `<tr><td><strong>${esc(p.full_name)}</strong><div class="small muted">#${esc(p.jersey_number||'—')}</div><input type="hidden" data-stat-player="${p.id}"></td><td><input class="input" style="width:70px" type="number" min="0" data-stat="appearances" data-p="${p.id}" value="${s.appearances||0}"></td><td><input class="input" style="width:80px" type="number" min="0" data-stat="minutes" data-p="${p.id}" value="${s.minutes||0}"></td><td><input class="input" style="width:70px" type="number" min="0" data-stat="goals" data-p="${p.id}" value="${s.goals||0}"></td><td><input class="input" style="width:70px" type="number" min="0" data-stat="assists" data-p="${p.id}" value="${s.assists||0}"></td><td><input class="input" style="width:60px" type="number" min="0" data-stat="yellow_cards" data-p="${p.id}" value="${s.yellow_cards||0}"></td><td><input class="input" style="width:60px" type="number" min="0" data-stat="red_cards" data-p="${p.id}" value="${s.red_cards||0}"></td></tr>`}).join('')}</tbody></table></div><div class="form-actions"><button class="btn outline" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save Statistics</button></div></form>`);document.getElementById('stats-form').addEventListener('submit',async e=>{e.preventDefault();const ids=[...document.querySelectorAll('[data-stat-player]')].map(x=>Number(x.dataset.statPlayer));const players=ids.map(id=>{const v=k=>Number(document.querySelector(`[data-stat="${k}"][data-p="${id}"]`)?.value||0);return{player_id:id,appearances:v('appearances'),minutes:v('minutes'),goals:v('goals'),assists:v('assists'),yellow_cards:v('yellow_cards'),red_cards:v('red_cards')}});try{const r=await api(`/api/owner/matches/${matchId}/stats`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({players})});notify(r.message);modalRoot.innerHTML='';await renderOwner('/statistics')}catch(err){notify(err.message,'error')}})}

async function approveRequest(id){try{const r=await api(`/api/owner/applications/${id}/approve`,{method:'POST'});notify(r.message);await renderOwner('/requests')}catch(e){notify(e.message,'error')}}
async function rejectRequest(id){if(!confirm('Reject this player request?'))return;try{const r=await api(`/api/owner/applications/${id}/reject`,{method:'POST'});notify(r.message);await renderOwner('/requests')}catch(e){notify(e.message,'error')}}

async function handleAction(action,el){
  if(action==='enter-club'){document.getElementById('lb-intro')?.classList.add('intro-leave');setTimeout(()=>document.getElementById('lb-intro')?.remove(),900);sessionStorage.setItem('lb_intro_seen','1');return;}
  if(action==='logout'){await api('/api/auth/logout',{method:'POST'});state.user=null;notify('Logged out.');return nav('/')}
  if(action==='close-modal'){modalRoot.innerHTML='';return}
  if(action==='refresh')return route();
  if(action==='approve-request')return approveRequest(el.dataset.id);
  if(action==='reject-request')return rejectRequest(el.dataset.id);
  if(action==='view-request'){try{const rows=await api('/api/owner/applications');const r=rows.find(x=>String(x.id)===String(el.dataset.id));if(!r)return;modal('Player Request',`<div class="grid grid-2"><div class="card pad"><div class="eyebrow">PLAYER</div><h2>${esc(r.full_name)}</h2><p class="muted">${esc(r.email)}<br>${esc(r.phone||'')}<br>${esc(r.position||'Position not supplied')}</p></div><div class="card pad"><div class="eyebrow">APPLICATION</div><p class="muted">Jersey: ${esc(r.jersey_number||'—')}<br>Foot: ${esc(r.preferred_foot||'—')}<br>Submitted: ${fmtDate(r.created_at)}<br>Status: ${esc(r.status)}</p></div></div><div class="card pad" style="margin-top:14px"><h3>Bio</h3><p class="muted">${esc(r.bio||'No bio supplied.')}</p></div>${r.photo?`<img src="${esc(r.photo)}" style="width:180px;height:220px;object-fit:cover;border-radius:14px;margin-top:14px" alt="">`:''}`)}catch(e){notify(e.message,'error')}return}
  if(action==='add-player')return openPlayerModal();
  if(action==='edit-player')return openPlayerModal(el.dataset.id);
  if(action==='delete-player'){if(!confirm('Delete this player?'))return;try{const r=await api(`/api/owner/players/${el.dataset.id}`,{method:'DELETE'});notify(r.message);await renderOwner('/players')}catch(e){notify(e.message,'error')}return}
  if(action==='add-match')return openMatchModal();
  if(action==='edit-match')return openMatchModal(el.dataset.id);
  if(action==='delete-match'){if(!confirm('Delete this match and its lineup/statistics?'))return;try{const r=await api(`/api/owner/matches/${el.dataset.id}`,{method:'DELETE'});notify(r.message);await renderOwner('/matches')}catch(e){notify(e.message,'error')}return}
  if(action==='manage-lineup')return openLineupModal(el.dataset.id);
  if(action==='manage-stats')return openStatsModal(el.dataset.id);
  if(action==='select-all-lineup'){document.querySelectorAll('#lineup-form input[name=pid]').forEach(x=>x.checked=true);return}
  if(action==='save-lineup')return saveLineup(el.dataset.id);
  if(action==='add-team')return openTeamModal();
  if(action==='edit-team')return openTeamModal(el.dataset.id);
  if(action==='delete-team'){if(!confirm('Delete this team?'))return;try{const r=await api(`/api/owner/teams/${el.dataset.id}`,{method:'DELETE'});notify(r.message);await renderOwner('/teams')}catch(e){notify(e.message,'error')}return}
  if(action==='add-news')return openNewsModal();
  if(action==='edit-news')return openNewsModal(el.dataset.id);
  if(action==='delete-news'){if(!confirm('Delete this story?'))return;try{const r=await api(`/api/owner/news/${el.dataset.id}`,{method:'DELETE'});notify(r.message);await renderOwner('/news')}catch(e){notify(e.message,'error')}return}
  if(action==='upload-media')return uploadMediaModal(el.dataset.type);
  if(action==='activate-media'){try{const r=await api(`/api/owner/media/${el.dataset.id}/activate`,{method:'POST'});notify(r.message);await renderOwner('/media')}catch(e){notify(e.message,'error')}return}
  if(action==='delete-media'){if(!confirm('Delete this media item?'))return;try{const r=await api(`/api/owner/media/${el.dataset.id}`,{method:'DELETE'});notify(r.message);await renderOwner('/media')}catch(e){notify(e.message,'error')}return}
  if(action==='read-notification'){try{const r=await api(`/api/notifications/${el.dataset.id}/read`,{method:'POST'});notify(r.message);return route()}catch(e){notify(e.message,'error')} }
  if(action==='read-all'){try{const r=await api('/api/notifications/read-all',{method:'POST'});notify(r.message);return route()}catch(e){notify(e.message,'error')} }
}

async function route(){const r=getRoute();try{const me=await api('/api/auth/me').catch(()=>null);state.user=me?.user||null;await publicPage(r)}catch(e){console.error(e);app.innerHTML=`${publicHeader()}<section class="login-screen"><div class="card auth-card"><div class="eyebrow">SYSTEM ERROR</div><h1 class="page-title">Something went wrong</h1><p class="muted">${esc(e.message)}</p><button class="btn primary" data-route="#/">Return Home</button></div></section>`}}

document.addEventListener('click', e => {
  const target = e.target;

  const closeEl = target.closest('[data-action="close-modal"]');
  if (closeEl) {
    e.preventDefault();
    e.stopPropagation();
    modalRoot.innerHTML = '';
    return;
  }

  // IMPORTANT: actions inside modals must work.
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    e.preventDefault();
    e.stopPropagation();
    handleAction(actionEl.dataset.action, actionEl);
    return;
  }

  // Other clicks inside a modal do not trigger navigation.
  const modal = target.closest('.modal');
  if (modal) {
    e.stopPropagation();
    return;
  }

  const routeEl = target.closest('[data-route]');
  if (routeEl) {
    e.preventDefault();
    nav(routeEl.dataset.route.replace(/^#/, '') || '/');
    return;
  }
});



/* Router bootstrap — every navigation button/hash route is handled here. */
window.addEventListener('hashchange', route);
route();
