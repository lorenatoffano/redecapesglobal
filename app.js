// ============================================================
// Formatters
// ============================================================
const fmtBRL = (v) => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {maximumFractionDigits:0});
const fmtBRLk = (v) => {
  v = Number(v||0);
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1}) + 'M';
  if (Math.abs(v) >= 1e3) return 'R$ ' + (v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0}) + 'k';
  return fmtBRL(v);
};
const fmtPct = (v) => (Number(v||0)*100).toLocaleString('pt-BR',{maximumFractionDigits:1}) + '%';
const statusClass = (status) => status === 'CONCLUÍDO' ? 'status-con' : (status === 'EM ANDAMENTO' ? 'status-and' : 'status-nao');

function safeChart(id, config) {
  try {
    const el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    new Chart(el, config);
  } catch (e) { console.error('Erro no gráfico', id, e); }
}

function kpiCard(label, value, extra) {
  return `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div>${extra||''}</div>`;
}

function kpiRowStandard(k) {
  return `<div class="kpi-row">
    ${kpiCard('Previsto', fmtBRLk(k.previsto))}
    ${kpiCard('Executado', fmtBRLk(k.executado))}
    ${kpiCard('Saldo', fmtBRLk(k.saldo))}
    ${kpiCard('% Executado', fmtPct(k.pct))}
    ${kpiCard('Status', `<span class="value status ${statusClass(k.status)}">${k.status}</span>`)}
  </div>`;
}

function entityCard(name, status, stats) {
  // stats: array of {k, v}
  return `<div class="entity-card">
    <div class="left"><div class="name">${name}</div><div class="status ${statusClass(status)}" style="color:inherit;">${status}</div></div>
    <div class="stats">${stats.map(s => `<div class="stat"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>`).join('')}</div>
  </div>`;
}

// ============================================================
// Navigation config
// ============================================================
const NAV = [
  { id:'dashboard', label:'Dashboard', icon:'📊' },
  { id:'cg', label:'Comitê Gestor', icon:'🧭' },
  { id:'instituicoes', label:'Instituições', icon:'🏛️', children: Object.keys(DATA.instituicoes).map(n => ({id:'inst_'+n, label:n})) },
  { id:'temas', label:'Temas', icon:'📚', children: [
      {id:'tema_overview', label:'Visão Geral'},
      ...Object.keys(DATA.temas).map(n => ({id:'tema_'+n.replace(' ',''), label:n, key:n}))
    ]},
  { id:'bolsas', label:'Bolsas', icon:'🎒' },
  { id:'missoes', label:'Missões', icon:'✈️' },
  { id:'ri', label:'Relações Internacionais', icon:'🌍' },
  { id:'eventos', label:'Eventos', icon:'👩‍🏫' },
  { id:'comunicacao', label:'Comunicação', icon:'📢' },
];

const TITLES = { dashboard:['Dashboard','Visão geral da execução orçamentária da rede.'],
  cg:['Comitê Gestor','Orçamento por ano e instituição, consolidado do Comitê Gestor.'],
  bolsas:['Bolsas','Controle de bolsistas por modalidade, IES e país de destino.'],
  missoes:['Missões','Missões programadas e realizadas — Comitê Gestor e Temas.'],
  ri:['Relações Internacionais','Presença internacional da rede — bolsas, missões e eventos por país.'],
  eventos:['Eventos','Controle de eventos institucionais da rede.'],
  comunicacao:['Comunicação','Publicações e alcance da comunicação institucional.'],
  tema_overview:['Temas — Visão Geral','Distribuição orçamentária por tema, missões e bolsas.'],
};

// ============================================================
// Render sidebar
// ============================================================
function buildNav() {
  const root = document.getElementById('navRoot');
  root.innerHTML = '';
  NAV.forEach(item => {
    if (item.children) {
      const wrap = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'nav-item';
      head.innerHTML = `<span class="ic">${item.icon}</span><span>${item.label}</span><span class="chev">▶</span>`;
      const sub = document.createElement('div');
      sub.className = 'submenu';
      item.children.forEach(child => {
        const cEl = document.createElement('div');
        cEl.className = 'nav-item';
        cEl.dataset.route = child.id;
        cEl.textContent = child.label;
        cEl.onclick = (e) => { e.stopPropagation(); navigate(child.id); };
        sub.appendChild(cEl);
      });
      head.onclick = () => { head.classList.toggle('expanded'); sub.classList.toggle('open'); };
      wrap.appendChild(head); wrap.appendChild(sub);
      root.appendChild(wrap);
    } else {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.route = item.id;
      el.innerHTML = `<span class="ic">${item.icon}</span><span>${item.label}</span>`;
      el.onclick = () => navigate(item.id);
      root.appendChild(el);
    }
  });
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`.nav-item[data-route="${route}"]`);
  if (el) {
    el.classList.add('active');
    const sub = el.closest('.submenu');
    if (sub) { sub.classList.add('open'); sub.previousElementSibling?.classList.add('expanded'); }
  }
}

// ============================================================
// Router
// ============================================================
function navigate(route) {
  location.hash = route;
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => { buildNav(); render(); });

function render() {
  const route = (location.hash || '#dashboard').slice(1);
  setActiveNav(route);
  const [title, subtitle] = TITLES[route] || [route, ''];
  const root = document.getElementById('contentRoot');

  if (route === 'dashboard') { setTitle('Dashboard','Visão geral da execução orçamentária da rede.'); root.innerHTML = pageDashboard(); afterDashboard(); }
  else if (route === 'cg') { setTitle(...TITLES.cg); root.innerHTML = pageCG(); afterCG(); }
  else if (route.startsWith('inst_')) { const nome = route.slice(5); setTitle('Instituições — '+nome,'Orçamento e execução por ano — '+nome+'.'); root.innerHTML = pageInstituicao(nome); afterInstituicao(nome); }
  else if (route === 'tema_overview') { setTitle(...TITLES.tema_overview); root.innerHTML = pageTemasOverview(); afterTemasOverview(); }
  else if (route.startsWith('tema_')) { const key = findTemaKey(route); setTitle('Temas — '+key,'Orçamento e execução — '+key+'.'); root.innerHTML = pageTema(key); afterTema(key); }
  else if (route === 'bolsas') { setTitle(...TITLES.bolsas); root.innerHTML = pageBolsas(); afterBolsas(); }
  else if (route === 'missoes') { setTitle(...TITLES.missoes); root.innerHTML = pageMissoes(); afterMissoes(); }
  else if (route === 'ri') { setTitle(...TITLES.ri); root.innerHTML = pageRI(); afterRI(); }
  else if (route === 'eventos') { setTitle(...TITLES.eventos); root.innerHTML = pageEventos(); }
  else if (route === 'comunicacao') { setTitle(...TITLES.comunicacao); root.innerHTML = pageComunicacao(); afterComunicacao(); }
  else { setTitle('Dashboard',''); root.innerHTML = pageDashboard(); afterDashboard(); }
}

function setTitle(t, s) { document.getElementById('pageTitle').textContent = t; document.getElementById('pageSubtitle').textContent = s || ''; }
function findTemaKey(route) {
  const item = NAV.find(n => n.id === 'temas').children.find(c => c.id === route);
  return item ? item.key : route;
}

// ============================================================
// PAGE: Dashboard (overview)
// ============================================================
function pageDashboard() {
  const r = DATA.resumo;
  return `
    <div class="kpi-row">
      ${kpiCard('Total Rede — Aprovado', fmtBRLk(r.total_rede.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRLk(r.total_rede.executado)}</div>`)}
      ${kpiCard('Bolsas CG', fmtBRLk(r.bolsas_cg.previsto), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRLk(r.bolsas_cg.executado)}</div>`)}
      ${kpiCard('Missões CG', fmtBRLk(r.missoes_cg.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRLk(r.missoes_cg.executado)}</div>`)}
      ${kpiCard('Ações Institucionais', fmtBRLk(r.acoes_inst.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRLk(r.acoes_inst.executado)}</div>`)}
      ${kpiCard('Bolsas Temas', fmtBRLk(r.bolsas_temas.planejado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRLk(r.bolsas_temas.executado)}</div>`)}
    </div>
    <div class="section-title">Execução geral <span class="tag">2026–2030</span></div>
    <div class="grid-2">
      <div class="panel"><h3>Previsto vs. Executado por ano</h3><div class="chart-box"><canvas id="chAno"></canvas></div></div>
      <div class="panel"><h3>Distribuição por modalidade</h3><div class="chart-box"><canvas id="chModalidade"></canvas></div></div>
    </div>
    <div class="section-title">Execução por instituição</div>
    <div class="panel"><div class="chart-box"><canvas id="chIES"></canvas></div></div>
  `;
}
function afterDashboard() {
  const r = DATA.resumo;
  safeChart('chAno', { type:'bar', data:{ labels: r.por_ano.map(a=>a.ano),
    datasets:[{label:'Previsto', data:r.por_ano.map(a=>a.previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:r.por_ano.map(a=>a.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
  safeChart('chModalidade', { type:'doughnut', data:{ labels:['Bolsas CG','Missões CG','Ações Inst.','Missões Temas','Bolsas Temas'],
    datasets:[{data:[r.bolsas_cg.previsto,r.missoes_cg.aprovado,r.acoes_inst.aprovado,r.missoes_temas.aprovado,r.bolsas_temas.planejado],
      backgroundColor:['#2563a8','#5b8fc9','#c98a2a','#8aa9c4','#0f2a4a'], borderWidth:2, borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:10.5},boxWidth:10,padding:10}}}} });
  safeChart('chIES', { type:'bar', data:{ labels: DATA.cg.por_ies.map(i=>i.ies),
    datasets:[{label:'Previsto', data:DATA.cg.por_ies.map(i=>i.previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:DATA.cg.por_ies.map(i=>i.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
}

function baseBarOpts() {
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{position:'bottom', labels:{font:{size:11}}}, tooltip:{callbacks:{label: ctx => ctx.dataset.label + ': ' + fmtBRL(ctx.raw)}} },
    scales:{ y:{ ticks:{ callback:v=>fmtBRLk(v), font:{size:10.5} }, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } };
}

// ============================================================
// PAGE: Comitê Gestor
// ============================================================
function pageCG() {
  const c = DATA.cg;
  const years = c.por_ano.map(a => entityCard(a.ano, a.pct>=1?'CONCLUÍDO':(a.pct>0?'EM ANDAMENTO':'INICIADO'), [
    {k:'Previsto', v:fmtBRL(a.previsto)}, {k:'Executado', v:fmtBRL(a.executado)},
    {k:'Saldo', v:fmtBRL(a.saldo)}, {k:'Qtd. Missões CG', v:a.qtd_missoes}
  ])).join('');
  return `
    ${kpiRowStandard(c.kpis)}
    <div class="section-title">Anos</div>
    ${years}
    <div class="section-title">Consolidado por instituição e modalidade</div>
    <div class="grid-2">
      <div class="panel"><h3>Previsto vs. Executado por IES</h3><div class="chart-box"><canvas id="chCGIES"></canvas></div></div>
      <div class="panel"><h3>Detalhamento por IES</h3><table id="tblCGIES"></table></div>
    </div>
  `;
}
function afterCG() {
  const c = DATA.cg;
  safeChart('chCGIES', { type:'bar', data:{ labels:c.por_ies.map(i=>i.ies),
    datasets:[{label:'Previsto', data:c.por_ies.map(i=>i.previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:c.por_ies.map(i=>i.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
  document.getElementById('tblCGIES').innerHTML = `
    <tr><th>IES</th><th>Previsto</th><th>Executado</th><th>% Exec.</th></tr>
    ${c.por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${fmtBRLk(i.previsto)}</td><td class="num">${fmtBRLk(i.executado)}</td>
      <td class="num"><span class="pct-pill ${i.pct>0.02?'status-con':'status-nao'}">${fmtPct(i.pct)}</span></td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Instituição
// ============================================================
function pageInstituicao(nome) {
  const inst = DATA.instituicoes[nome];
  const years = inst.por_ano.map(a => entityCard(a.ano, a.pct>=1?'CONCLUÍDO':(a.pct>0?'EM ANDAMENTO':'INICIADO'), [
    {k:'Previsto', v:fmtBRL(a.previsto)}, {k:'Executado', v:fmtBRL(a.executado)},
    {k:'Saldo', v:fmtBRL(a.saldo)}, {k:'Qtd. Missões', v:a.qtd_missoes}
  ])).join('');
  return `
    ${kpiRowStandard(inst.kpis)}
    <div class="section-title">Anos</div>
    ${years}
    <div class="section-title">Por modalidade</div>
    <div class="grid-2">
      <div class="panel"><h3>Previsto por modalidade × ano</h3><div class="chart-box"><canvas id="chInstMod"></canvas></div></div>
      <div class="panel"><h3>Detalhamento</h3><table id="tblInstMod"></table></div>
    </div>
  `;
}
function afterInstituicao(nome) {
  const inst = DATA.instituicoes[nome];
  const anos5 = ['2026','2027','2028','2029','2030'];
  const palette = ['#2563a8','#5b8fc9','#c98a2a','#0f2a4a'];
  safeChart('chInstMod', { type:'bar', data:{ labels: anos5,
    datasets: inst.modalidades.map((m,i) => ({ label:m.modalidade, data:anos5.map(a=>m[a]), backgroundColor:palette[i%palette.length], borderRadius:4 })) },
    options: { ...baseBarOpts(), scales:{ ...baseBarOpts().scales, x:{...baseBarOpts().scales.x, stacked:false} } } });
  document.getElementById('tblInstMod').innerHTML = `
    <tr><th>Modalidade</th><th>Previsto</th><th>Executado</th><th>% Exec.</th></tr>
    ${inst.modalidades.map(m => `<tr><td>${m.modalidade}</td><td class="num">${fmtBRLk(m.total_previsto)}</td><td class="num">${fmtBRLk(m.total_executado)}</td>
      <td class="num"><span class="pct-pill ${m.pct>0.02?'status-con':'status-nao'}">${fmtPct(m.pct)}</span></td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Temas — visão geral
// ============================================================
function pageTemasOverview() {
  const temaNames = Object.keys(DATA.temas);
  const cards = temaNames.map(nome => {
    const t = DATA.temas[nome];
    return entityCard(nome, t.kpis.status, [
      {k:'Previsto', v:fmtBRL(t.kpis.previsto)}, {k:'Executado', v:fmtBRL(t.kpis.executado)},
      {k:'Saldo', v:fmtBRL(t.kpis.saldo)}, {k:'Qtd. Missões', v:t.qtd_missoes}
    ]);
  }).join('');
  return `
    <div class="section-title">Temas da rede</div>
    ${cards}
    <div class="section-title">Comparativo entre temas</div>
    <div class="panel"><div class="chart-box"><canvas id="chTemasOverview"></canvas></div></div>
  `;
}
function afterTemasOverview() {
  const temaNames = Object.keys(DATA.temas);
  safeChart('chTemasOverview', { type:'bar', data:{ labels: temaNames,
    datasets:[{label:'Previsto', data:temaNames.map(n=>DATA.temas[n].kpis.previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:temaNames.map(n=>DATA.temas[n].kpis.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
}

// ============================================================
// PAGE: Tema individual
// ============================================================
function pageTema(nome) {
  const t = DATA.temas[nome];
  return `
    ${kpiRowStandard(t.kpis)}
    <div class="section-title">Missões por instituição <span class="tag">${t.qtd_missoes} missões registradas</span></div>
    <div class="grid-2">
      <div class="panel"><h3>Previsto por IES</h3><div class="chart-box"><canvas id="chTemaIES"></canvas></div></div>
      <div class="panel"><h3>Detalhamento</h3><table id="tblTemaIES"></table></div>
    </div>
  `;
}
function afterTema(nome) {
  const t = DATA.temas[nome];
  safeChart('chTemaIES', { type:'bar', data:{ labels: t.missoes_por_ies.map(i=>i.ies),
    datasets:[{label:'Previsto', data:t.missoes_por_ies.map(i=>i.total_previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:t.missoes_por_ies.map(i=>i.total_executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
  document.getElementById('tblTemaIES').innerHTML = `
    <tr><th>IES</th><th>Previsto</th><th>Executado</th></tr>
    ${t.missoes_por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${fmtBRLk(i.total_previsto)}</td><td class="num">${fmtBRLk(i.total_executado)}</td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Bolsas
// ============================================================
function pageBolsas() {
  const b = DATA.bolsas;
  const totalValor = b.registros.reduce((s,r)=>s+r.valor_total,0);
  return `
    <div class="kpi-row">
      ${kpiCard('Total de bolsistas', b.registros.length)}
      ${kpiCard('Valor total executado', fmtBRLk(totalValor))}
      ${kpiCard('Modalidades ativas', b.modalidade_totais.filter(m=>m.total>0).length)}
    </div>
    <div class="section-title">Por modalidade</div>
    <div class="panel"><div class="chart-box"><canvas id="chBolsasModal"></canvas></div></div>
    <div class="section-title">Registro de bolsistas</div>
    <div class="panel"><table id="tblBolsas"></table></div>
  `;
}
function afterBolsas() {
  const b = DATA.bolsas;
  safeChart('chBolsasModal', { type:'bar', data:{ labels:b.modalidade_totais.map(m=>m.modalidade),
    datasets:[{label:'Valor executado', data:b.modalidade_totais.map(m=>m.total), backgroundColor:'#2563a8', borderRadius:4}]},
    options: baseBarOpts() });
  document.getElementById('tblBolsas').innerHTML = `
    <tr><th>Modalidade</th><th>IES Sede</th><th>IES Destino</th><th>País</th><th>Tema</th><th>Valor</th><th>Status</th></tr>
    ${b.registros.map(r => `<tr><td>${r.modalidade||'—'}</td><td>${r.ies_sede||'—'}</td><td>${r.ies_destino||'—'}</td>
      <td>${r.pais_destino||'—'}</td><td>${r.tema||'—'}</td><td class="num">${fmtBRL(r.valor_total)}</td><td>${r.status||'—'}</td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Missões
// ============================================================
function pageMissoes() {
  const m = DATA.missoes;
  return `
    <div class="kpi-row">
      ${kpiCard('Total de missões', m.registros.length)}
      ${kpiCard('Realizadas', m.registros.filter(r=>r.status==='Realizada').length)}
      ${kpiCard('Pendentes', m.registros.filter(r=>r.status==='Pendente').length)}
    </div>
    <div class="section-title">Programadas vs. realizadas por ano</div>
    <div class="grid-2">
      <div class="panel"><h3>Comitê Gestor</h3><div class="chart-box"><canvas id="chMissCG"></canvas></div></div>
      <div class="panel"><h3>Temas</h3><div class="chart-box"><canvas id="chMissTemas"></canvas></div></div>
    </div>
    <div class="section-title">Lista de missões <span class="tag">${m.registros.length} registros</span></div>
    <div class="panel" style="max-height:420px;overflow-y:auto;"><table id="tblMissoes"></table></div>
  `;
}
function afterMissoes() {
  const m = DATA.missoes;
  safeChart('chMissCG', { type:'bar', data:{ labels:m.cg_por_ano.map(a=>a.ano),
    datasets:[{label:'Programada', data:m.cg_por_ano.map(a=>a.programada), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Realizada', data:m.cg_por_ano.map(a=>a.realizada), backgroundColor:'#2f8f6e', borderRadius:4}]},
    options: { responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11}}}},
      scales:{ y:{ ticks:{font:{size:10.5}}, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } } });
  safeChart('chMissTemas', { type:'bar', data:{ labels:m.temas_por_ano.map(a=>a.ano),
    datasets:[{label:'Programada', data:m.temas_por_ano.map(a=>a.programada), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Realizada', data:m.temas_por_ano.map(a=>a.realizada), backgroundColor:'#2f8f6e', borderRadius:4}]},
    options: { responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11}}}},
      scales:{ y:{ ticks:{font:{size:10.5}}, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } } });
  document.getElementById('tblMissoes').innerHTML = `
    <tr><th>Tipo</th><th>Tema</th><th>IES</th><th>Ano</th><th>Destino</th><th>Valor</th><th>Status</th></tr>
    ${m.registros.map(r => `<tr><td>${r.tipo||'—'}</td><td>${r.tema||'—'}</td><td>${r.ies||'—'}</td><td>${r.ano||'—'}</td>
      <td>${r.destino||'—'}</td><td class="num">${r.valor_total?fmtBRL(r.valor_total):'—'}</td><td>${r.status||'—'}</td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Relações Internacionais (mapa de calor)
// ============================================================
function pageRI() {
  return `
    <div class="grid-2">
      <div class="panel">
        <h3>Mapa de calor — países envolvidos</h3>
        <div id="mapBox" style="position:relative;height:320px;">
          <svg id="worldMap" viewBox="0 0 960 500" style="width:100%;height:100%;"></svg>
          <div id="mapTooltip" style="position:absolute;pointer-events:none;background:var(--navy);color:#fff;font-size:11.5px;padding:6px 10px;border-radius:6px;opacity:0;transition:opacity .1s;white-space:nowrap;"></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:var(--muted);">
          <span>Menos atividade</span>
          <div style="flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,#eaf1f9,#2563a8,#0f2a4a);"></div>
          <span>Mais atividade</span>
        </div>
      </div>
      <div class="panel"><h3>Detalhamento por país</h3><table id="tblPaises"></table></div>
    </div>
  `;
}
function afterRI() {
  const P = DATA.paises;
  document.getElementById('tblPaises').innerHTML = `
    <tr><th>País</th><th>Registros</th><th>Origem</th><th>Valor</th></tr>
    ${P.por_pais.map(p => `<tr><td>${p.pais}</td><td class="num">${p.total_registros}</td>
      <td>${Object.entries(p.por_origem).map(([k,v])=>`${k} (${v})`).join(', ')}</td><td class="num">${fmtBRL(p.valor_total)}</td></tr>`).join('')}`;

  const svg = d3.select('#worldMap');
  const tooltip = document.getElementById('mapTooltip');
  const countryData = {};
  P.por_pais.forEach(p => countryData[p.pais_en] = p);
  const maxReg = Math.max(1, ...P.por_pais.map(p => p.total_registros));
  const color = d3.scaleLinear().domain([0, maxReg]).range(['#eaf1f9', '#0f2a4a']);
  const projection = d3.geoNaturalEarth1().scale(155).translate([480, 260]);
  const path = d3.geoPath().projection(projection);

  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(topo => {
    const countries = topojson.feature(topo, topo.objects.countries).features;
    svg.selectAll('path').data(countries).join('path').attr('d', path)
      .attr('fill', d => { const m = countryData[d.properties.name]; return m ? color(m.total_registros) : '#eef2f7'; })
      .attr('stroke', '#fff').attr('stroke-width', 0.6)
      .on('mousemove', (event, d) => {
        const m = countryData[d.properties.name];
        const box = document.getElementById('mapBox').getBoundingClientRect();
        tooltip.style.left = (event.clientX - box.left + 12) + 'px';
        tooltip.style.top = (event.clientY - box.top + 8) + 'px';
        if (m) { tooltip.innerHTML = `<b>${m.pais}</b><br>${m.total_registros} registro(s) — ${fmtBRL(m.valor_total)}`; tooltip.style.opacity = 1; }
        else tooltip.style.opacity = 0;
      })
      .on('mouseleave', () => { tooltip.style.opacity = 0; });
  }).catch(() => {
    const box = document.getElementById('mapBox');
    if (box) box.innerHTML = '<p style="color:var(--muted);font-size:12.5px;padding:20px;">Não foi possível carregar o mapa (verifique a conexão). Os dados por país continuam na tabela ao lado.</p>';
  });
}

// ============================================================
// PAGE: Eventos
// ============================================================
function pageEventos() {
  const e = DATA.eventos;
  return `
    <div class="kpi-row">
      ${kpiCard('Total de eventos', e.total)}
      ${kpiCard('Em organização', e.registros.filter(r=>r.situacao==='Em organização').length)}
      ${kpiCard('Finalizados', e.registros.filter(r=>r.situacao==='Finalizado').length)}
    </div>
    <div class="section-title">Lista de eventos</div>
    <div class="panel"><table>
      <tr><th>Ano</th><th>Título</th><th>Tipo</th><th>Abrangência</th><th>País</th><th>Responsável</th><th>Situação</th></tr>
      ${e.registros.map(r => `<tr><td>${r.ano||'—'}</td><td>${r.titulo||'—'}</td><td>${r.tipo||'—'}</td>
        <td>${r.abrangencia||'—'}</td><td>${r.pais||'—'}</td><td>${r.responsavel||'—'}</td><td>${r.situacao||'—'}</td></tr>`).join('')}
    </table></div>
  `;
}

// ============================================================
// PAGE: Comunicação
// ============================================================
function pageComunicacao() {
  const c = DATA.comunicacao;
  const totalPub = c.publicacoes_por_tipo.reduce((s,p)=>s+p.qtd,0);
  return `
    <div class="kpi-row">
      ${kpiCard('Total de publicações', totalPub)}
      ${kpiCard('Visualizações totais', Number(c.visualizacoes_total).toLocaleString('pt-BR'))}
    </div>
    <div class="section-title">Publicações por canal</div>
    <div class="panel"><div class="chart-box sm"><canvas id="chComunicacao"></canvas></div></div>
  `;
}
function afterComunicacao() {
  const c = DATA.comunicacao;
  safeChart('chComunicacao', { type:'bar', data:{ labels:c.publicacoes_por_tipo.map(p=>p.tipo),
    datasets:[{label:'Publicações', data:c.publicacoes_por_tipo.map(p=>p.qtd), backgroundColor:'#2563a8', borderRadius:4}]},
    options: { responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ y:{ ticks:{font:{size:10.5}}, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } } });
}
