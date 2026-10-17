export const CONTROL_PAGE = String.raw`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Teoleevo Control</title>
  <style>
    :root{color-scheme:dark;--bg:#080b12;--panel:#111827;--line:#27344b;--text:#e8eefb;--muted:#8997af;--cyan:#3ce7e7;--magenta:#ff4fd8;--green:#52ed9b;--yellow:#ffd166;--red:#ff6078}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#14203a 0,#080b12 42%);color:var(--text);font:14px Inter,ui-sans-serif,system-ui,sans-serif;min-height:100vh}
    button,select,input{font:inherit;color:inherit;background:#0b1220;border:1px solid var(--line);border-radius:8px;padding:8px 10px}button{cursor:pointer}button:hover{border-color:var(--cyan)}button.primary{background:#17334b;border-color:#29749b}.active{color:var(--green)!important;border-color:var(--green)!important}.danger{color:var(--red)}
    header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;background:#080b12e8;border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}h1{font-size:17px;letter-spacing:.08em;margin:0;color:var(--cyan)}.status{display:flex;align-items:center;gap:8px;color:var(--muted)}.dot{width:9px;height:9px;border-radius:50%;background:var(--yellow)}.dot.ok{background:var(--green);box-shadow:0 0 12px var(--green)}
    main{max-width:1500px;margin:auto;padding:16px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr);gap:14px}.stack{display:grid;gap:14px;align-content:start}.card{background:linear-gradient(145deg,#131d2f,#0e1522);border:1px solid var(--line);border-radius:13px;padding:14px;box-shadow:0 12px 30px #0004}.card h2{font-size:12px;letter-spacing:.12em;color:var(--muted);margin:0 0 12px;text-transform:uppercase}.toolbar{display:flex;flex-wrap:wrap;gap:8px}.hero{display:flex;justify-content:space-between;gap:12px;align-items:center}.preset-title{font-size:20px;font-weight:700;color:var(--magenta);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.small{font-size:12px;color:var(--muted)}
    .meters{display:grid;gap:10px;margin-top:14px}.meter{display:grid;grid-template-columns:65px 1fr 72px;gap:8px;align-items:center}.track{height:12px;border-radius:99px;background:#070a10;overflow:hidden}.fill{height:100%;width:0;transition:width 80ms linear;border-radius:inherit}.bass{background:linear-gradient(90deg,#a943ff,var(--magenta))}.mids{background:linear-gradient(90deg,#258cff,var(--cyan))}.treble{background:linear-gradient(90deg,#ff9d3c,var(--yellow))}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.field{display:grid;gap:5px}.field label{font-size:11px;color:var(--muted)}.wide{grid-column:1/-1}.queue{display:grid;gap:7px}.queue-row{display:grid;grid-template-columns:85px 1fr;gap:8px;padding:7px 8px;border-radius:7px;background:#0a101c}.queue-row.current{border-left:3px solid var(--green)}
    .search{display:grid;grid-template-columns:1fr 130px;gap:8px;margin-bottom:9px}.preset-list{height:430px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:#080d17}.preset-row{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;padding:7px 8px;border-bottom:1px solid #1a2538}.preset-row:hover{background:#162238}.preset-row.playing{background:#192b28}.play{padding:4px 8px}.tags{font-size:10px;color:var(--yellow)}
    .playlist-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.playlist-actions button{padding:6px 8px}.merge{width:100%;min-height:100px}.notice{padding:10px;border-radius:8px;background:#1b2638;color:var(--muted)}.error{color:var(--red)}footer{padding:10px 20px 22px;color:var(--muted);text-align:center;font-size:12px}
    @media(max-width:900px){main{grid-template-columns:1fr}.preset-list{height:360px}}@media(max-width:520px){header{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:1fr}.search{grid-template-columns:1fr}.meter{grid-template-columns:55px 1fr 58px}}
  </style>
</head>
<body>
  <header><h1>TEOLEEVO // LOCAL CONTROL</h1><div class="status"><span id="connection-dot" class="dot"></span><span id="connection">Connexion…</span></div></header>
  <main>
    <section class="stack">
      <div class="card">
        <div class="hero"><div style="min-width:0"><div class="small">PRESET ACTUEL</div><div id="current-preset" class="preset-title">Aucun preset</div><div id="engine-status" class="small">Moteur arrêté</div></div><div id="signal" class="small">SILENCE</div></div>
        <div class="meters">
          <div class="meter"><b>BASS</b><div class="track"><div id="bass-fill" class="fill bass"></div></div><span id="bass-value">0%</span></div>
          <div class="meter"><b>MIDS</b><div class="track"><div id="mids-fill" class="fill mids"></div></div><span id="mids-value">0%</span></div>
          <div class="meter"><b>TREBLE</b><div class="track"><div id="treble-fill" class="fill treble"></div></div><span id="treble-value">0%</span></div>
        </div>
        <div class="toolbar" style="margin-top:14px">
          <button id="previous">◀ Précédent</button><button id="next" class="primary">Suivant ▶</button><button id="pause">Pause</button><button id="engine">Démarrer moteur</button><button id="fullscreen">Plein écran</button><button id="auto">Auto-switch</button>
        </div>
      </div>

      <div class="card">
        <h2>Presets</h2>
        <div class="search"><input id="preset-search" placeholder="Rechercher un preset…"><select id="tag-filter"><option value="all">Tous les tags</option><option value="build-up">Build-up</option><option value="drop">Drop</option><option value="verse">Verse</option><option value="other">Other</option></select></div>
        <div id="preset-count" class="small"></div>
        <div id="preset-list" class="preset-list"></div>
      </div>
    </section>

    <aside class="stack">
      <div class="card"><h2>File de lecture</h2><div id="queue" class="queue"></div></div>

      <div class="card">
        <h2>Playlist active</h2>
        <select id="playlist" style="width:100%"></select>
        <div class="grid" style="margin-top:9px"><div class="field"><label>Intervalle auto</label><select id="auto-seconds"></select></div><div class="field"><label>Ordre</label><select id="shuffle"><option value="false">Séquentiel</option><option value="true">Aléatoire sans répétition</option></select></div></div>
        <div class="playlist-actions"><button id="new-playlist">Nouvelle</button><button id="copy-playlist">Copier</button><button id="rename-playlist">Renommer</button><button id="delete-playlist" class="danger">Supprimer</button></div>
        <div class="field" style="margin-top:10px"><label>Fusionner plusieurs playlists (Ctrl+clic)</label><select id="merge-sources" class="merge" multiple></select><button id="merge-playlists">Créer la fusion</button></div>
        <div id="playlist-note" class="small" style="margin-top:8px"></div>
      </div>

      <div class="card">
        <h2>Audio et affichage</h2>
        <div class="grid">
          <div class="field wide"><label>Sortie audio Windows</label><select id="device"></select></div>
          <div class="field wide"><label>Écran de sortie</label><select id="display"></select></div>
          <div class="field"><label>Réactivité</label><select id="smoothing"><option value="fast">Rapide</option><option value="balanced">Équilibré</option><option value="smooth">Fluide</option></select></div>
          <div class="field"><label>Plancher vumètre</label><select id="meter-floor"><option>-80</option><option>-70</option><option>-60</option><option>-50</option></select></div>
          <div class="field"><label>FPS terminal</label><select id="ui-fps"></select></div>
          <div class="field"><label>Historique terminal</label><select id="history"><option value="true">Visible</option><option value="false">Masqué</option></select></div>
        </div>
      </div>

      <div class="card">
        <h2>MilkDrop</h2>
        <div class="grid">
          <div class="field"><label>FPS MilkDrop</label><select id="visual-fps"></select></div>
          <div class="field"><label>Vitesse globale</label><select id="visual-speed"></select></div>
          <div class="field wide"><label>Volume visuel</label><select id="visual-volume"></select></div>
        </div>
      </div>

      <div class="card"><h2>Application</h2><button id="quit" class="danger">Arrêter Teoleevo</button><div id="error" class="error" style="margin-top:8px"></div></div>
    </aside>
  </main>
  <footer>Contrôle local uniquement · 127.0.0.1 · Ink et Chrome utilisent le même moteur</footer>
  <script>
    'use strict';
    let catalog={devices:[],displays:[],presets:[],playlists:[]},state=null,lastActive='',lastCurrent='';
    const $=id=>document.getElementById(id), esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const values=(id,list)=>{$(id).innerHTML=list.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')};
    values('auto-seconds',[1,2,3,4,5,8,10,15,20,30,45,60]);values('ui-fps',[5,8,10,12,15,20,30]);values('visual-fps',[10,15,20,24,30,45,60,90,120]);values('visual-speed',[0,.001,.0025,.005,.0075,.01,.025,.05,.075,.1,.25,.5,.75,1,1.05,1.07175,1.1,1.25,1.5,2]);values('visual-volume',[0,.1,.25,.5,.75,1]);
    async function command(type,payload={}){try{const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Teoleevo-Control':'1'},body:JSON.stringify({type,...payload})});if(!response.ok)throw new Error((await response.json()).error||response.statusText);$('error').textContent=''}catch(error){$('error').textContent=error.message}}
    function optionList(items,value,label){return items.map(item=>'<option value="'+esc(item.id)+'" '+(item.id===value?'selected':'')+'>'+esc(label(item))+'</option>').join('')}
    function renderCatalog(){
      $('device').innerHTML=optionList(catalog.devices,state?.audio.deviceId,d=>(d.isDefault?'★ ':'')+d.name);
      $('display').innerHTML=optionList(catalog.displays,state?.visualizer.selectedDisplayId,d=>(d.isPrimary?'★ ':'')+d.name+' · '+d.width+'×'+d.height);
      $('playlist').innerHTML=optionList(catalog.playlists,state?.activePlaylistId,p=>p.name+' · '+p.presetIds.length+(p.readonly?' · système':''));
      $('merge-sources').innerHTML=optionList(catalog.playlists,'',p=>p.name+' · '+p.presetIds.length);
      renderPresets();renderQueue();renderPlaylistButtons();
    }
    function preset(id){return catalog.presets.find(item=>item.id===id)}function playlist(id){return catalog.playlists.find(item=>item.id===id)}
    function renderState(){if(!state)return;
      $('connection').textContent='Connecté';$('connection-dot').className='dot ok';
      const current=preset(state.currentPresetId);$('current-preset').textContent=current?.name||'Aucun preset';$('engine-status').textContent=state.visualizer.message;$('signal').textContent=state.audio.paused?'PAUSE':state.audio.hasSignal?'● SIGNAL':'○ SILENCE';
      for(const band of ['bass','mids','treble']){const level=Math.max(0,Math.min(1,state.audio.levels[band]||0));$(band+'-fill').style.width=(level*100).toFixed(0)+'%';const db=state.audio.db[band];$(band+'-value').textContent=(level*100).toFixed(0)+'% · '+(db===null?'−∞':db.toFixed(1))+' dB'}
      $('pause').textContent=state.audio.paused?'Reprendre':'Pause';$('pause').classList.toggle('active',state.audio.paused);$('engine').textContent=state.visualizer.running?'Arrêter moteur':'Démarrer moteur';$('engine').classList.toggle('active',state.visualizer.running);$('fullscreen').classList.toggle('active',state.visualizer.fullscreen);$('auto').classList.toggle('active',state.settings.autoSwitchEnabled);
      const controls={'device':state.audio.deviceId,'display':state.visualizer.selectedDisplayId,'playlist':state.activePlaylistId,'smoothing':state.settings.smoothing,'meter-floor':state.settings.meterFloor,'ui-fps':state.settings.uiFps,'history':String(state.settings.showHistory),'visual-fps':state.settings.visualizer.frameRate,'visual-speed':state.settings.visualizer.speed,'visual-volume':state.settings.visualizer.audioGain,'auto-seconds':state.settings.autoSwitchSeconds,'shuffle':String(state.settings.shuffleEnabled),'tag-filter':state.settings.presetTagFilter};for(const [id,value] of Object.entries(controls)){if($(id)&&value!==undefined)$(id).value=String(value)}
      renderQueue();renderPlaylistButtons();if(lastActive!==state.activePlaylistId||lastCurrent!==state.currentPresetId){lastActive=state.activePlaylistId||'';lastCurrent=state.currentPresetId||'';renderPresets()}
    }
    function renderQueue(){if(!state)return;const entries=[],head=state.queue.priorityId||state.queue.currentId;if(head)entries.push({id:head,label:state.queue.priorityId?'PRIORITAIRE':'EN COURS',current:true});state.queue.upcomingIds.forEach((id,index)=>entries.push({id,label:index===0?'À SUIVRE':String(index+1),current:false}));const auto=state.settings.autoSwitchEnabled?'<div class="small">AUTO · '+(state.audio.paused||!state.audio.hasSignal?'pause':'actif')+' · '+state.settings.autoSwitchRemaining.toFixed(1)+' s · '+(state.settings.shuffleEnabled?'aléatoire':'séquentiel')+'</div>':'<div class="small">AUTO · désactivé</div>';$('queue').innerHTML=auto+(entries.length?entries.map(entry=>{const item=preset(entry.id);return '<div class="queue-row '+(entry.current?'current':'')+'"><b>'+entry.label+'</b><span>'+esc(item?.name||entry.id)+'</span></div>'}).join(''):'<div class="notice">Playlist vide</div>')}
    function renderPlaylistButtons(){const active=playlist(state?.activePlaylistId),editable=active&&!active.readonly;$('rename-playlist').disabled=!editable;$('delete-playlist').disabled=!editable;$('playlist-note').textContent=active?(editable?'Playlist personnalisée : cochez les presets pour la modifier.':'Playlist système en lecture seule.'):'Aucune playlist'}
    function renderPresets(){const list=$('preset-list'),query=$('preset-search').value.trim().toLocaleLowerCase(),tag=$('tag-filter').value,active=playlist(state?.activePlaylistId),members=new Set(active?.presetIds||[]),editable=active&&!active.readonly;const filtered=catalog.presets.filter(p=>(tag==='all'||p.tags.includes(tag))&&(!query||p.relativePath.toLocaleLowerCase().includes(query)));$('preset-count').textContent=filtered.length+' résultat(s)'+(filtered.length>120?' · 120 affichés':'');list.innerHTML=filtered.slice(0,120).map(p=>'<div class="preset-row '+(p.id===state?.currentPresetId?'playing':'')+'"><button class="play" data-play="'+esc(p.id)+'">▶</button><div><div>'+esc(p.name)+'</div><div class="small">'+esc(p.relativePath)+'</div></div><div>'+(editable?'<label><input type="checkbox" data-member="'+esc(p.id)+'" '+(members.has(p.id)?'checked':'')+'> playlist</label>':'<span class="tags">'+esc(p.tags.join(' · '))+'</span>')+'</div></div>').join('')||'<div class="notice">Aucun preset</div>'}
    $('preset-list').addEventListener('click',event=>{const play=event.target.closest('[data-play]');if(play)command('show-preset',{presetId:play.dataset.play})});$('preset-list').addEventListener('change',event=>{const input=event.target.closest('[data-member]');if(input)command('set-playlist-preset',{playlistId:state.activePlaylistId,presetId:input.dataset.member,included:input.checked})});
    $('preset-search').addEventListener('input',renderPresets);$('tag-filter').onchange=event=>{renderPresets();command('set-preset-tag-filter',{value:event.target.value})};
    $('previous').onclick=()=>command('cycle-preset',{direction:-1});$('next').onclick=()=>command('cycle-preset',{direction:1});$('pause').onclick=()=>command('set-paused',{enabled:!state.audio.paused});$('engine').onclick=()=>command('set-renderer-running',{enabled:!state.visualizer.running});$('fullscreen').onclick=()=>command('set-fullscreen',{enabled:!state.visualizer.fullscreen});$('auto').onclick=()=>command('set-auto-switch',{enabled:!state.settings.autoSwitchEnabled});
    $('device').onchange=e=>command('set-device',{deviceId:e.target.value});$('display').onchange=e=>command('set-display',{displayId:e.target.value});$('playlist').onchange=e=>command('set-active-playlist',{playlistId:e.target.value});$('smoothing').onchange=e=>command('set-smoothing',{value:e.target.value});$('meter-floor').onchange=e=>command('set-meter-floor',{value:Number(e.target.value)});$('ui-fps').onchange=e=>command('set-ui-fps',{value:Number(e.target.value)});$('history').onchange=e=>command('set-show-history',{enabled:e.target.value==='true'});$('auto-seconds').onchange=e=>command('set-auto-seconds',{value:Number(e.target.value)});$('shuffle').onchange=e=>command('set-shuffle',{enabled:e.target.value==='true'});
    $('visual-fps').onchange=e=>command('set-visualizer-settings',{value:{frameRate:Number(e.target.value)}});$('visual-speed').onchange=e=>command('set-visualizer-settings',{value:{speed:Number(e.target.value)}});$('visual-volume').onchange=e=>command('set-visualizer-settings',{value:{audioGain:Number(e.target.value)}});
    $('new-playlist').onclick=()=>{const name=prompt('Nom de la nouvelle playlist');if(name)command('create-playlist',{name})};$('copy-playlist').onclick=()=>{const source=playlist(state.activePlaylistId),name=prompt('Nom de la copie',(source?.name||'Playlist')+' (copie)');if(name)command('copy-playlist',{sourceId:state.activePlaylistId,name})};$('rename-playlist').onclick=()=>{const active=playlist(state.activePlaylistId),name=prompt('Nouveau nom',active?.name||'');if(name)command('rename-playlist',{playlistId:active.id,name})};$('delete-playlist').onclick=()=>{const active=playlist(state.activePlaylistId);if(active&&!active.readonly&&confirm('Supprimer « '+active.name+' » ?'))command('delete-playlist',{playlistId:active.id})};$('merge-playlists').onclick=()=>{const sourceIds=Array.from($('merge-sources').selectedOptions).map(o=>o.value);if(sourceIds.length<2)return alert('Sélectionnez au moins deux playlists.');const name=prompt('Nom de la fusion','Fusion '+sourceIds.length+' playlists');if(name)command('merge-playlists',{sourceIds,name})};$('quit').onclick=()=>{if(confirm('Arrêter Teoleevo et le moteur visuel ?'))command('quit')};
    async function boot(){try{const data=await fetch('/api/snapshot').then(r=>r.json());catalog=data.catalog;state=data.state;renderCatalog();renderState();const events=new EventSource('/api/events');events.addEventListener('catalog',event=>{catalog=JSON.parse(event.data);renderCatalog()});events.addEventListener('state',event=>{state=JSON.parse(event.data);renderState()});events.onerror=()=>{$('connection').textContent='Reconnexion…';$('connection-dot').className='dot'}}catch(error){$('connection').textContent='Erreur';$('error').textContent=error.message}}
    boot();
  </script>
</body>
</html>`;
