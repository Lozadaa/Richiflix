const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {addTestSource}=require('./test-source.cjs');
(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-events-'));let app;try{
 app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env:{...process.env,RICHIFLIX_TEST_EMPTY_SOURCE:'1',RICHIFLIX_USER_DATA:temp}});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false)));
 const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{localStorage.setItem('rf-profiles',JSON.stringify([{id:'events',name:'Adulto',kind:'adult'}]));window.__eventNow=Date.parse('2026-10-06T20:29:45Z');Date.now=()=>window.__eventNow;});
 await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();
 await addTestSource(page,{name:'19:00 New York Yankees vs. Tampa Bay Rays · MLB',category:'MLB EVENTS',live:true,url:'https://fixture.test/live.m3u8',eventStartsAt:'2026-10-06T22:00:00Z'});
 // Fase L7: two more games in «Próximos de hoy» so following a team visibly moves its game to first place.
 await addTestSource(page,{name:'19:20 Los Angeles Dodgers vs. San Diego Padres · MLB',category:'MLB EVENTS',live:true,url:'https://fixture.test/dodgers.m3u8',eventStartsAt:'2026-10-06T22:20:00Z'});
 await addTestSource(page,{name:'19:30 Boston Red Sox vs. Toronto Blue Jays · MLB',category:'MLB EVENTS',live:true,url:'https://fixture.test/boston.m3u8',eventStartsAt:'2026-10-06T22:30:00Z'});
 await addTestSource(page,{name:'MLB Network',category:'MLB EVENTS',live:true,url:'https://fixture.test/network.m3u8'});
 await page.getByRole('button',{name:'MLB',exact:true}).click();await page.locator('.card-open').first().focus();
 const badge=page.locator('.virtual-rail-cell .card').first().locator('.live-label'),stage=page.locator('.focus-stage');
 await expect(badge).toHaveAttribute('data-event-state','upcoming');await expect(badge).toHaveText('Hoy 19:00');await expect(badge.locator('small')).toHaveCount(0);
 assert.equal(await stage.locator('.focus-eyebrow').innerText(),'HOY 19:00 · Empieza en 1 h 31 min');
 await expect(page.locator('.live-hub-channels .card')).toHaveCount(1);await expect(page.locator('.live-hub-channels .card .live-label')).toHaveCount(0);await page.screenshot({path:path.join(__dirname,'../events-countdown-preview.png')});
 await page.evaluate(()=>window.__eventNow=Date.parse('2026-10-06T21:59:55Z'));await expect(badge).toHaveAttribute('data-event-state','soon');await expect(badge).toHaveText('Empieza en 5 s');
 await page.evaluate(()=>window.__eventNow=Date.parse('2026-10-06T22:00:00Z'));await expect(badge).toHaveAttribute('data-event-state','live');await expect(badge).toHaveText('En juego');await expect(stage.locator('.focus-eyebrow')).toHaveText('EN JUEGO · 19:00 · MLB EVENTS');
 await expect(stage.locator('.focus-countdown')).toHaveCount(0);
 // Fase L7: follow Boston from the event panel (Tab → Reproducir, Right → Mi lista, Right → BOS, OK).
 const row=title=>page.locator('.catalog-row').filter({has:page.getByRole('heading',{name:title,exact:true})}).locator('.card-open'),toast=page.locator('.toast');
 await expect(row('Próximos de hoy').first()).toHaveAttribute('aria-label',/Dodgers/);
 await row('Próximos de hoy').nth(1).focus();const panel=page.locator('.card-expansion');await expect(panel).toBeVisible();
 await page.keyboard.press('Tab');await expect(panel.locator('.expansion-play')).toBeFocused();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 const follow=panel.locator('.expansion-follow').first();await expect(follow).toBeFocused();await expect(follow).toHaveText('BOS');await expect(panel.locator('.expansion-follow')).toHaveText(['BOS','TOR']);
 await page.keyboard.press('Enter');await expect(follow).toHaveAttribute('aria-pressed','true');await expect(toast).toContainText('Red Sox · Siguiendo');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await expect(follow).toBeFocused();
 await expect(row('Próximos de hoy').first()).toHaveAttribute('aria-label',/Boston/);await expect(row('En juego ahora').first()).toHaveAttribute('aria-label',/Yankees/);
 await page.keyboard.press('Escape');await expect(row('Próximos de hoy').first()).toBeFocused();
 // ≤10 min before the start, focus on a card: the toast does not steal it («Arriba para ver»); Up reaches «Ver»; Back returns to the card.
 const before=await page.evaluate(()=>document.activeElement.getAttribute('aria-label'));
 await page.evaluate(()=>window.__eventNow=Date.parse('2026-10-06T22:22:58Z'));await expect(toast).toContainText('Red Sox vs. Blue Jays empieza en 8 min · Arriba para ver',{timeout:8000});
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),before,'the alert keeps the card focus');
 await page.keyboard.press('ArrowUp');await expect(toast.locator('.toast-action')).toBeFocused();await page.keyboard.press('Escape');await expect(toast).toHaveCount(0);
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),before);
 // Live, focus outside the catalogue: «Ver» takes focus; OK opens the player. Boston leads «En juego ahora» while followed.
 await page.evaluate(()=>document.querySelector('.topbar nav button.active').focus());
 await page.evaluate(()=>window.__eventNow=Date.parse('2026-10-06T22:30:58Z'));await expect(toast).toContainText('Red Sox vs. Blue Jays está en juego · OK para ver',{timeout:8000});
 await expect(row('En juego ahora').first()).toHaveAttribute('aria-label',/Boston/);
 await expect(toast.locator('.toast-action')).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('Red Sox');
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 // Ajustes: «Equipos seguidos» → «Dejar de seguir» removes the team and the ordering returns to start time.
 await page.getByRole('button',{name:'Ajustes',exact:true}).click();const section=page.getByRole('region',{name:'Equipos seguidos'});await expect(section).toContainText('BOS · Red Sox · Dejar de seguir');
 await section.getByRole('button',{name:'Dejar de seguir a Red Sox'}).click();await expect(section).toHaveCount(0);await expect(toast).toContainText('Dejaste de seguir a Red Sox');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await expect(row('En juego ahora').first()).toHaveAttribute('aria-label',/Yankees/);
 assert.deepEqual(errors,[]);
 console.log('Eventos OK: cuenta atrás en cards y banner, minutos y segundos, actualización automática, fases Hoy → Empieza en → En juego, sin «Santiago» y canales 24 h sin badge en la tarjeta. L7: seguir equipo desde el panel (BOS) sube su partido al primer lugar, aviso a ≤10 min con «Ver» enfocado (Volver devuelve el foco), aviso «en juego» abre el reproductor y «Dejar de seguir» en Ajustes lo quita.');
}finally{await app?.close();assert.ok(temp.startsWith(os.tmpdir()+path.sep)&&path.basename(temp).startsWith('richiflix-events-'));await fs.rm(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
