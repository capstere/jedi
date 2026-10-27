from pathlib import Path
base=Path('games/hissrum-strike')
p=base/'index.html';s=p.read_text()
s=s.replace('style.css?v=hissrum-flybots-effects-v4','style.css?v=arsenal-v7').replace('src/main.mjs?v=hissrum-viewmodels-v6','src/main.mjs?v=arsenal-v7')
a='      <label>Fantasidvärgar';assert a in s
s=s.replace(a,'''      <label class="mobile-setting">Mobil: avfyrning
        <select id="auto-fire-mode"><option value="auto">Automatisk — sikta på fiende</option><option value="manual">Manuell — skjutknapp</option></select>
      </label>
      <label>Granatbana
        <select id="trajectory-mode"><option value="on">Visa kastbana</option><option value="off">Dölj kastbana</option></select>
      </label>
'''+a,1)
s=s.replace('    <button class="sound-button" id="sound-button"', '    <button class="sound-button" id="shop-button" aria-label="Öppna vapenbutik">KÖP</button>\n    <button class="sound-button" id="sound-button"',1)
s=s.replace('<div id="hit" aria-hidden="true">', '<div id="auto-status" aria-live="off" hidden>AUTO</div>\n  <div id="grenade-status" hidden>G / GRANAT · välj · KASTA · B / KÖP fyller på</div>\n  <div id="hit" aria-hidden="true">',1)
s=s.replace('    <button id="resume" class="primary">','''    <label class="pause-setting mobile-setting">Mobil: avfyrning
      <select id="auto-fire-pause"><option value="auto">Automatisk</option><option value="manual">Manuell skjutknapp</option></select>
    </label>
    <label class="pause-setting">Granatbana
      <select id="trajectory-pause"><option value="on">Visa kastbana</option><option value="off">Dölj kastbana</option></select>
    </label>
    <button id="resume" class="primary">''',1)
s=s.replace('<div id="touch-controls" hidden>', '''<section id="shop" class="screen screen-pause" hidden aria-labelledby="shop-title">
  <div class="shop-card" role="dialog" aria-modal="true">
    <p class="eyebrow">FÄLTARSENAL · MATCHEN PAUSAS UNDER KÖPET</p>
    <h2 id="shop-title">NY UTRUSTNING</h2>
    <p class="shop-balance">Krediter: <strong id="shop-money">0</strong></p>
    <div id="shop-items" class="shop-grid"></div>
    <p id="shop-message" role="status">Välj vapen, rustning eller granater.</p>
    <button id="shop-close" class="primary">TILLBAKA TILL STRIDEN</button>
  </div>
</section>
<div id="touch-controls" hidden>''',1)
s=s.replace('data-touch="fire" class="fire-button">SKJUT','data-touch="fire" class="fire-button" hidden>SKJUT',1)
s=s.replace('    <button data-touch="fly"', '    <button data-touch="grenade" id="grenade-toggle" aria-label="Välj granat">GRANAT</button>\n    <button data-touch="fly"',1)
s=s.replace(' · E interagera · Esc pausa.', ' · B köp vapen när som helst · G granat · E interagera · Esc pausa.')
s=s.replace('SIKTE zoomar med Sniper Scope 5.', 'Automatisk eld är standard: sikta på en synlig fiende. Snipern låser på efter 0,32 s. SIKTE zoomar, KÖP öppnar arsenalen och GRANAT väljer granat. Manuell eld finns i pausmenyn.')
s=s.replace('<span>NYA 3D-VAPEN</span>','<span>AUTOELD · FÄLTARSENAL</span>')
p.write_text(s)
p=base/'style.css';s=p.read_text();s+='''
/* v7: auto-fire frees the thumb; explosives always require explicit input. */
#auto-status{position:absolute;left:50%;top:calc(50% + 24px);transform:translateX(-50%);font:800 10px/1.3 Inter,sans-serif;letter-spacing:.10em;color:#deeee9;text-shadow:0 1px 3px #000}
#auto-status.locking{color:#ffe3a1}
#grenade-status{position:absolute;left:50%;top:calc(50% + 45px);transform:translateX(-50%);font:700 10px/1.3 Inter,sans-serif;white-space:nowrap;background:#061924bb;padding:6px;border-radius:3px;color:#ffdda2}
.touch-actions.auto-fire .fire-button{display:none}
.touch-actions.auto-fire{grid-template-columns:repeat(2,48px)}
.pause-setting{display:block;font:600 12px/1.5 Inter,sans-serif;margin:12px 0;color:#c3e3e0}
.pause-setting select{display:block;width:100%;min-height:44px;margin-top:5px;padding:8px;background:#132c34;border:1px solid #53827d;border-radius:4px;color:#edfff6}
.shop-card{width:min(660px,100%);max-height:90dvh;overflow:auto;padding:24px;background:#09212af5;border:1px solid #537e7d;border-radius:8px;touch-action:pan-y}
.shop-card h2{margin:10px 0;font-size:40px;line-height:1}.shop-balance{font-size:14px;color:#c9e8e0}
.shop-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.shop-item{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px;min-height:64px;border:1px solid #558682;background:#12343c;color:#effff8;border-radius:4px;text-align:left}
.shop-item span{font-weight:800;font-size:13px}.shop-item small{font-size:11px;color:#9ee7d4}.shop-item:disabled{opacity:.48;cursor:default}
#shop-message{min-height:2.7em;font-size:12px;color:#d8eee7}.shop-card button{touch-action:manipulation}
@media(pointer:fine){.mobile-setting{display:none!important}}
@media(pointer:coarse) and (max-width:760px){
 .hud-bottom{gap:4px}.hp-block,.weapon-block{min-width:74px;padding:5px 6px}
 #shop-button,.sound-button{min-width:42px;width:42px;height:44px}
 .shop-card{padding:17px;max-height:91dvh}.shop-card h2{font-size:33px}.shop-item{padding:9px}
 .touch-utilities{gap:6px}.touch-utilities button{width:48px}
 .touch-actions.auto-fire{bottom:calc(154px + env(safe-area-inset-bottom))}
}
''';p.write_text(s)
