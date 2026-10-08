const {_electron:electron,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {addTestSource}=require('./test-source.cjs');
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-mlb-'));let app;try{
 app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:temp}});
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({reducedMotion:'reduce'});
 // Clock starting at 17:00 Santiago (it runs, so the TV banner can settle on a new card) so the game is «Próximos de hoy» and the two 24 h channels form the «Canales» grid.
 // Fase L5: Dodgers–Padres started at 16:30 and is in play; the official schedule is a local route (linescore only with hydrate=linescore).
 const schedule=[];let mlbDown=false;
 const game=(gamePk,away,home,gameDate,detailedState,abstractGameState,linescore)=>({gamePk,officialDate:'2026-10-06',gameDate,teams:{away:{team:{id:away}},home:{team:{id:home}}},status:{detailedState,abstractGameState},...linescore&&{linescore}});
 await page.route('https://statsapi.mlb.com/**',route=>{const url=new URL(route.request().url()),hydrate=url.searchParams.get('hydrate')==='linescore';schedule.push(hydrate);if(mlbDown)return route.abort();
  return route.fulfill({contentType:'application/json',body:JSON.stringify({dates:[{date:'2026-10-06',games:[game(901,147,139,'2026-10-06T22:00:00Z','Scheduled','Preview'),game(902,119,135,'2026-10-06T19:30:00Z','In Progress','Live',hydrate&&{currentInning:7,currentInningOrdinal:'7th',inningState:'Top',teams:{away:{runs:3},home:{runs:2}}})]}]})});});
 await page.addInitScript(()=>{localStorage.setItem('rf-profiles',JSON.stringify([{id:'mlb-test',name:'Adulto',kind:'adult'}]));let now=Date.parse('2026-10-06T20:00:00Z');const start=performance.now();Date.now=()=>now+Math.round(performance.now()-start);window.richiflixAdvanceClock=ms=>{now+=ms;};});await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();
 for(const [name,eventStartsAt] of [['19:00 ◘ New York Yankees vs. Tampa Bay Rays ◘ MLB ◘ Spanish ⚾️','2026-10-06T22:00:00Z'],['16:30 ◘ Los Angeles Dodgers vs. San Diego Padres ◘ MLB ◘ Spanish','2026-10-06T19:30:00Z'],['Baltimore Orioles MLB'],['MLB Network SD']])await addTestSource(page,{name,url:'https://fixture.test/live.m3u8',live:true,category:'⚾️ MLB EVENTS \u{1F525}',eventStartsAt});
 await page.getByRole('button',{name:'MLB',exact:true}).click();
 const stage=page.locator('.focus-stage'),rail=page.locator('.cards[aria-label="Próximos de hoy"]'),grid=page.locator('.live-hub-channels .catalog-grid');
 await expect(page.locator('.live-hub-title p')).toHaveText('Hoy · 2 partidos');await expect(grid).toHaveAttribute('data-virtual-count','2');
 // Fase L5: card and banner show the score; the linescore is only requested once a game is in play.
 const liveRail=page.locator('.cards[aria-label="En juego ahora"]'),liveCard=liveRail.locator('.card[data-content-id="event:mlb:902"]'),liveScore=liveCard.locator('.mlb-score'),nextOpen=rail.locator('.card[data-content-id="event:mlb:901"] .card-open');
 await expect(liveScore.locator('.mlb-runs')).toHaveText('3 – 2');await expect(liveScore.locator('.mlb-inning')).toHaveText('7.ª ▲');
 await expect(liveCard.locator('.mlb-artwork')).toHaveAttribute('data-live','');await expect(liveScore.locator('.is-ahead')).toHaveText('3');await expect(liveScore.locator('.mlb-runs')).toHaveCSS('font-size','30px');
 assert.equal(schedule[0],false);assert.ok(schedule.includes(true),'hydrate=linescore once a game is in play');
 const box=selector=>page.locator(selector).first().evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:el.offsetHeight};});
 const [liveBox,posterBox,scoreBox,nameBox]=await Promise.all([box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"]'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .poster'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .mlb-score'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .mlb-team-name')]);
 assert.ok(scoreBox.bottom<=posterBox.bottom&&nameBox.bottom<=scoreBox.top+1,`score inside the poster, under the names ${JSON.stringify({posterBox,scoreBox,nameBox})}`);
 await liveCard.locator('.card-open').focus();
 await expect(stage.locator('.focus-stage-visual .mlb-score .mlb-runs')).toHaveText('3 – 2');await expect(stage.locator('.focus-description')).toHaveText('En juego · 7.ª ▲ · 3 – 2');
 await expect(stage.locator('.focus-stage-visual .mlb-runs')).toHaveCSS('font-size','56px');await expect(stage.locator('.focus-stage-visual .mlb-inning')).toHaveCSS('font-size','26px');
 await page.screenshot({path:path.join(__dirname,'../artifacts/liveL5-mlb-marcador.png')});
 await liveCard.locator('.card-open').focus();await page.keyboard.press('ArrowDown');await expect(nextOpen).toBeFocused();
 assert.equal(liveBox.height,(await box('[aria-label="Próximos de hoy"] .card[data-content-id="event:mlb:901"]')).height,'the score never changes the card height');
 // Fase L3 fix: the banner draws the game's crests again inside its art layer. In TV it stays on the page's first event (the game in play).
 await expect(stage.locator('.focus-stage-visual .mlb-artwork')).toHaveAttribute('data-mlb-teams','119,135');
 assert.doesNotMatch(await page.locator('body').innerText(),/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u);
 await expect(stage.locator('[data-category-mark="baseball"]')).toHaveCount(1);
 const marks=stage.locator('.mlb-mark');await expect(marks).toHaveCount(2);for(const mark of await marks.all())await expect(mark).toHaveAttribute('data-image-state','ready');
 for(const img of await marks.locator('img').all()){assert.match(await img.getAttribute('src'),/artwork\/mlb\/\d+\.svg$/);assert.ok(await img.evaluate(el=>el.getBoundingClientRect().width>100));}
 await page.screenshot({path:path.join(__dirname,'../mlb-duel-preview.png')});
 // Provider categories live in «Más categorías…», after the fixed chips.
 await page.getByRole('button',{name:'Categorías de MLB · Béisbol en vivo',exact:true}).click();await expect(page.getByRole('dialog').getByRole('button',{name:'MLB EVENTS',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 // Remote: rail -> channel grid -> next channel -> back up to the rail. A team channel shows its crest; an unknown one does not.
 await liveCard.locator('.card-open').focus();await page.keyboard.press('ArrowDown');await expect(nextOpen).toBeFocused();await page.keyboard.press('ArrowDown');await expect(grid.locator('[data-virtual-index="0"] .card-open')).toBeFocused();
 await expect(grid.locator('[data-virtual-index="0"] .mlb-artwork')).toHaveAttribute('data-mlb-teams','110');await expect(grid.locator('[data-virtual-index="0"] .mlb-team-name')).toHaveText('Orioles');
 await page.keyboard.press('ArrowRight');await expect(grid.locator('[data-virtual-index="1"] .card-open')).toBeFocused();await expect(grid.locator('[data-virtual-index="1"] .mlb-artwork')).toHaveCount(0);
 await page.keyboard.press('ArrowUp');await expect(nextOpen).toBeFocused();
 // Fase L5: the API goes down; the next refresh keeps the last score, marked stale, and the phase stays «En juego».
 mlbDown=true;const asked=schedule.length;await page.evaluate(()=>{window.richiflixAdvanceClock(61000);document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>schedule.length).toBeGreaterThan(asked);await expect(liveScore).toHaveAttribute('data-stale','');await expect(liveScore.locator('.mlb-runs')).toHaveText('3 – 2');
 await expect(liveCard.locator('.live-label')).toHaveText('En juego');
 await page.setViewportSize({width:3840,height:2160});await expect(stage.locator('.mlb-mark').first()).toHaveAttribute('data-image-state','ready');
 // The app starts in TV mode (30 px score); the PC layout at 1080p uses 26 px, same card height as the upcoming game.
 await page.setViewportSize({width:1920,height:1080});await page.getByRole('button',{name:'Modo TV',exact:true}).click();await expect(page.locator('.tv-mode')).toHaveCount(0);
 await expect(liveCard.locator('.mlb-runs')).toHaveCSS('font-size','26px');
 const [tvLive,tvPoster,tvScore,tvName]=await Promise.all([box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"]'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .poster'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .mlb-score'),box('[aria-label="En juego ahora"] .card[data-content-id="event:mlb:902"] .mlb-team-name')]);
 assert.ok(tvScore.bottom<=tvPoster.bottom&&tvName.bottom<=tvScore.top+1,JSON.stringify({tvPoster,tvScore,tvName}));
 await liveCard.locator('.card-open').focus();await page.screenshot({path:path.join(__dirname,'../artifacts/liveL5-mlb-marcador-pc.png')});
 await page.keyboard.press('ArrowDown');await expect(nextOpen).toBeFocused();assert.equal(tvLive.height,(await box('[aria-label="Próximos de hoy"] .card[data-content-id="event:mlb:901"]')).height);
 // PC: the banner follows the focused card, so the upcoming game shows its readable phase and no score.
 await expect(stage.locator('.focus-stage-visual .mlb-artwork')).toHaveAttribute('data-mlb-teams','147,139');await expect(stage.locator('.focus-description')).toHaveText(/^Hoy 19:00 · Empieza en /);await expect(stage.locator('.mlb-score')).toHaveCount(0);
 assert.deepEqual(errors,[]);console.log('MLB OK: marcador en tarjeta y banner (3 – 2 · 7.ª ▲), linescore sólo con partido en juego, último marcador «stale» si la API falla; escudos SVG locales en el banner (1080p y 4K), fase legible, fila «Próximos de hoy» sobre la cuadrícula «Canales», canal de equipo, canal sin escudo y mando fila ↔ cuadrícula.');
}finally{await app?.close();assert.ok(temp.startsWith(os.tmpdir()+path.sep)&&path.basename(temp).startsWith('richiflix-mlb-'));await fs.rm(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
