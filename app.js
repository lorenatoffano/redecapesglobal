// ============================================================
// Formatters
// ============================================================
const fmtBRL = (v) => Number(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2});
const fmtBRLk = (v) => { // usado só nos eixos dos gráficos, por legibilidade
  v = Number(v||0);
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1}) + 'M';
  if (Math.abs(v) >= 1e3) return 'R$ ' + (v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:0}) + 'k';
  return fmtBRL(v);
};
const fmtPct = (v) => (Number(v||0)*100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%';
const fmtNum = (v) => Number(v||0).toLocaleString('pt-BR');

const CURRENT_YEAR = new Date().getFullYear();

function statusForYear(ano, pct) {
  const anoNum = parseInt(ano, 10);
  if (!isNaN(anoNum) && anoNum > CURRENT_YEAR) return 'AINDA NÃO INICIADO';
  if (pct >= 1) return 'CONCLUÍDO';
  if (pct > 0) return 'EM ANDAMENTO';
  return 'NÃO INICIADO';
}
function statusClass(status) {
  if (status === 'CONCLUÍDO') return 'status-con';
  if (status === 'EM ANDAMENTO') return 'status-and';
  if (status === 'AINDA NÃO INICIADO') return 'status-futuro';
  return 'status-nao';
}

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
    ${kpiCard('Previsto', fmtBRL(k.previsto))}
    ${kpiCard('Executado', fmtBRL(k.executado))}
    ${kpiCard('Saldo', fmtBRL(k.saldo))}
    ${kpiCard('% Executado', fmtPct(k.pct))}
    ${kpiCard('Status', `<span class="value status ${statusClass(k.status)}">${k.status}</span>`)}
  </div>`;
}

function entityCard(name, status, stats) {
  const statusHtml = status ? `<div class="status ${statusClass(status)}">${status}</div>` : '';
  return `<div class="entity-card">
    <div class="left"><div class="name">${name}</div>${statusHtml}</div>
    <div class="stats">${stats.map(s => `<div class="stat"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>`).join('')}</div>
  </div>`;
}

function baseBarOpts() {
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{position:'bottom', labels:{font:{size:11}}}, tooltip:{callbacks:{label: ctx => ctx.dataset.label + ': ' + fmtBRL(ctx.raw)}} },
    scales:{ y:{ ticks:{ callback:v=>fmtBRLk(v), font:{size:10.5} }, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } };
}
function countBarOpts() {
  return { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11}}}},
    scales:{ y:{ ticks:{font:{size:10.5}, precision:0}, grid:{color:'#eef1f5'} }, x:{ ticks:{font:{size:11}}, grid:{display:false} } } };
}

// ============================================================
// Heatmap genérico (reutilizado em várias páginas)
// ============================================================
function heatmapBlock(paisesObj, opts) {
  opts = opts || {};
  const hasData = paisesObj && paisesObj.por_pais && paisesObj.por_pais.length > 0;
  return `
    <div class="grid-2">
      <div class="panel">
        <h3>${opts.title || 'Mapa de calor - países envolvidos'}</h3>
        <div id="mapBox" style="position:relative;height:300px;">
          <svg id="worldMap" viewBox="0 0 960 500" style="width:100%;height:100%;"></svg>
          <div id="mapTooltip" style="position:absolute;pointer-events:none;background:var(--navy);color:#fff;font-size:11.5px;padding:6px 10px;border-radius:6px;opacity:0;transition:opacity .1s;white-space:nowrap;"></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:var(--muted);">
          <span>Menos atividade</span>
          <div style="flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,#eaf1f9,#2563a8,#0f2a4a);"></div>
          <span>Mais atividade</span>
        </div>
      </div>
      <div class="panel"><h3>Detalhamento por país</h3>
        ${hasData ? `<table id="tblPaises"></table>` : `<div class="empty-state">Ainda não há registros com país preenchido nesta aba.<br>O mapa vai se preenchendo automaticamente conforme novos registros forem cadastrados na planilha.</div>`}
      </div>
    </div>
  `;
}
function afterHeatmap(paisesObj, opts) {
  opts = opts || {};
  const P = paisesObj || {por_pais: [], registros: []};
  const tblEl = document.getElementById('tblPaises');
  if (tblEl) {
    tblEl.innerHTML = `
      <tr><th>País</th><th>Registros</th><th>Origem</th>${opts.showIesDestino ? '<th>IES Destino</th>' : ''}<th>Valor</th></tr>
      ${P.por_pais.map(p => {
        let iesCol = '';
        if (opts.showIesDestino) {
          const iesSet = new Set((P.registros||[]).filter(r => r.pais_en === p.pais_en && r.extra).map(r => r.extra));
          iesCol = `<td>${[...iesSet].join(', ') || '—'}</td>`;
        }
        return `<tr><td>${p.pais}</td><td class="num">${p.total_registros}</td>
          <td>${Object.entries(p.por_origem).map(([k,v])=>`${k} (${v})`).join(', ')}</td>${iesCol}<td class="num">${fmtBRL(p.valor_total)}</td></tr>`;
      }).join('')}`;
  }

  const svgEl = document.getElementById('worldMap');
  if (!svgEl) return;
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
        const box = document.getElementById('mapBox');
        if (!box) return;
        const bx = box.getBoundingClientRect();
        tooltip.style.left = (event.clientX - bx.left + 12) + 'px';
        tooltip.style.top = (event.clientY - bx.top + 8) + 'px';
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
  { id:'metas', label:'Metas', icon:'🎯' },
];

const TITLES = { dashboard:['Dashboard','Visão geral da execução orçamentária da rede.'],
  cg:['Comitê Gestor','Orçamento por ano e instituição, consolidado do Comitê Gestor.'],
  bolsas:['Bolsas','Bolsas por modalidade, instituição, tema e produção científica associada.'],
  missoes:['Missões','Missões programadas e realizadas - Comitê Gestor e Temas.'],
  ri:['Relações Internacionais','Parcerias, acordos e interações internacionais da rede.'],
  eventos:['Eventos','Controle de eventos institucionais da rede.'],
  comunicacao:['Comunicação','Publicações e alcance da comunicação institucional.'],
  metas:['Metas','Painel de metas da rede.'],
  tema_overview:['Temas - Visão Geral','Distribuição orçamentária por tema, missões e bolsas.'],
};

// ============================================================
// Sidebar
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
function navigate(route) { location.hash = route; }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => { buildNav(); render(); });

function render() {
  const route = (location.hash || '#dashboard').slice(1);
  setActiveNav(route);
  const root = document.getElementById('contentRoot');

  if (route === 'dashboard') { setTitle(...TITLES.dashboard); root.innerHTML = pageDashboard(); afterDashboard(); }
  else if (route === 'cg') { setTitle(...TITLES.cg); root.innerHTML = pageCG(); afterCG(); }
  else if (route.startsWith('inst_')) { const nome = route.slice(5); setTitle('Instituições — '+nome,'Orçamento e execução por ano - '+nome+'.'); root.innerHTML = pageInstituicao(nome); afterInstituicao(nome); }
  else if (route === 'tema_overview') { setTitle(...TITLES.tema_overview); root.innerHTML = pageTemasOverview(); afterTemasOverview(); }
  else if (route.startsWith('tema_')) { const key = findTemaKey(route); setTitle('Temas — '+key,'Orçamento e execução - '+key+'.'); root.innerHTML = pageTema(key); afterTema(key); }
  else if (route === 'bolsas') { setTitle(...TITLES.bolsas); root.innerHTML = pageBolsas(); afterBolsas(); }
  else if (route === 'missoes') { setTitle(...TITLES.missoes); root.innerHTML = pageMissoes(); afterMissoes(); }
  else if (route === 'ri') { setTitle(...TITLES.ri); root.innerHTML = pageRI(); afterRI(); }
  else if (route === 'eventos') { setTitle(...TITLES.eventos); root.innerHTML = pageEventos(); afterEventos(); }
  else if (route === 'comunicacao') { setTitle(...TITLES.comunicacao); root.innerHTML = pageComunicacao(); afterComunicacao(); }
  else if (route === 'metas') { setTitle(...TITLES.metas); root.innerHTML = pageMetas(); }
  else { setTitle(...TITLES.dashboard); root.innerHTML = pageDashboard(); afterDashboard(); }
}
function setTitle(t, s) { document.getElementById('pageTitle').textContent = t; document.getElementById('pageSubtitle').textContent = s || ''; }
function findTemaKey(route) {
  const item = NAV.find(n => n.id === 'temas').children.find(c => c.id === route);
  return item ? item.key : route;
}

// ============================================================
// PAGE: Dashboard
// ============================================================
function pageDashboard() {
  const r = DATA.resumo;
  return `
    <div class="kpi-row">
      ${kpiCard('Total Rede — Aprovado', fmtBRL(r.total_rede.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.total_rede.executado)}</div>`)}
      ${kpiCard('Bolsas CG', fmtBRL(r.bolsas_cg.previsto), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.bolsas_cg.executado)}</div>`)}
      ${kpiCard('Missões CG', fmtBRL(r.missoes_cg.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.missoes_cg.executado)}</div>`)}
      ${kpiCard('Ações Institucionais', fmtBRL(r.acoes_inst.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.acoes_inst.executado)}</div>`)}
      ${kpiCard('Bolsas Temas', fmtBRL(r.bolsas_temas.planejado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.bolsas_temas.executado)}</div>`)}
    </div>
    <div class="section-title">Execução geral <span class="tag">2026–2030</span></div>
    <div class="grid-2">
      <div class="panel"><h3>Previsto vs. Executado por ano</h3><div class="chart-box"><canvas id="chAno"></canvas></div></div>
      <div class="panel"><h3>Distribuição por modalidade</h3><div class="chart-box"><canvas id="chModalidade"></canvas></div></div>
    </div>
    <div class="section-title">Execução por instituição</div>
    <div class="panel"><div class="chart-box"><canvas id="chIES"></canvas></div></div>
    <div class="section-title">Presença internacional <span class="tag">Bolsas + Missões + Eventos + RI</span></div>
    ${heatmapBlock(DATA.paises.geral, {title:'Mapa de calor consolidado'})}
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
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:10.5},boxWidth:10,padding:10}},
      tooltip:{callbacks:{label: ctx => ctx.label + ': ' + fmtBRL(ctx.raw)}}}} });
  safeChart('chIES', { type:'bar', data:{ labels: DATA.cg.por_ies.map(i=>i.ies),
    datasets:[{label:'Previsto', data:DATA.cg.por_ies.map(i=>i.previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:DATA.cg.por_ies.map(i=>i.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
  afterHeatmap(DATA.paises.geral, {});
}

// ============================================================
// PAGE: Comitê Gestor
// ============================================================
function pageCG() {
  const c = DATA.cg;
  const years = c.por_ano.map(a => {
    return entityCard(a.ano, null, [
      {k:'Previsto', v:fmtBRL(a.previsto)}, {k:'Executado', v:fmtBRL(a.executado)},
      {k:'Saldo', v:fmtBRL(a.saldo)}, {k:'Qtd. Missões CG', v:fmtNum(a.qtd_missoes)}
    ]);
  }).join('');
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
    ${c.por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${fmtBRL(i.previsto)}</td><td class="num">${fmtBRL(i.executado)}</td>
      <td class="num"><span class="pct-pill ${i.pct>0.02?'status-con':'status-nao'}">${fmtPct(i.pct)}</span></td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Instituição
// ============================================================
function pageInstituicao(nome) {
  const inst = DATA.instituicoes[nome];
  const years = inst.por_ano.map(a => {
    return entityCard(a.ano, null, [
      {k:'Previsto', v:fmtBRL(a.previsto)}, {k:'Executado', v:fmtBRL(a.executado)},
      {k:'Saldo', v:fmtBRL(a.saldo)}, {k:'Qtd. Missões', v:fmtNum(a.qtd_missoes)}
    ]);
  }).join('');
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
    options: baseBarOpts() });
  document.getElementById('tblInstMod').innerHTML = `
    <tr><th>Modalidade</th><th>Previsto</th><th>Executado</th><th>% Exec.</th></tr>
    ${inst.modalidades.map(m => `<tr><td>${m.modalidade}</td><td class="num">${fmtBRL(m.total_previsto)}</td><td class="num">${fmtBRL(m.total_executado)}</td>
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
      {k:'Saldo', v:fmtBRL(t.kpis.saldo)}, {k:'Qtd. Missões', v:fmtNum(t.qtd_missoes)}
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
// PAGE: Tema individual (agora com detalhamento por ano)
// ============================================================
function pageTema(nome) {
  const t = DATA.temas[nome];
  const years = (t.por_ano||[]).map(a => {
    return entityCard(a.ano, null, [
      {k:'Previsto', v:fmtBRL(a.previsto)}, {k:'Executado', v:fmtBRL(a.executado)}, {k:'Saldo', v:fmtBRL(a.saldo)}, {k:'% Exec.', v:fmtPct(a.pct)}
    ]);
  }).join('');
  return `
    ${kpiRowStandard(t.kpis)}
    <div class="section-title">Detalhamento por ano</div>
    ${years}
    <div class="section-title">Missões por instituição <span class="tag">${fmtNum(t.qtd_missoes)} missões registradas</span></div>
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
    ${t.missoes_por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${fmtBRL(i.total_previsto)}</td><td class="num">${fmtBRL(i.total_executado)}</td></tr>`).join('')}`;
}

// ============================================================
// PAGE: Bolsas (reestruturada)
// ============================================================
function pageBolsas() {
  const b = DATA.bolsas;
  const iesEntries = Object.entries(b.qtd_por_ies);
  const temaEntries = Object.entries(b.qtd_por_tema);
  const totalBolsas = iesEntries.reduce((s,[,v])=>s+v, 0);
  const totalValorExec = b.modalidade_totais.reduce((s,m)=>s+m.valor_executado, 0);
  return `
    <div class="kpi-row">
      ${kpiCard('Total de bolsas', fmtNum(totalBolsas))}
      ${kpiCard('Valor executado', fmtBRL(totalValorExec))}
      ${kpiCard('Artigos científicos publicados', fmtNum(b.total_publicacoes))}
    </div>
    <div class="section-title">Quantidade de bolsas</div>
    <div class="grid-3">
      <div class="panel"><h3>Por instituição</h3><div class="chart-box sm"><canvas id="chBolsasIES"></canvas></div></div>
      <div class="panel"><h3>Por tema</h3><div class="chart-box sm"><canvas id="chBolsasTema"></canvas></div></div>
      <div class="panel"><h3>Por modalidade</h3><div class="chart-box sm"><canvas id="chBolsasModalQtd"></canvas></div></div>
    </div>
    <div class="section-title">Execução financeira por modalidade</div>
    <div class="panel"><table id="tblModalidade"></table></div>
    <div class="section-title">Produção científica <span class="tag">${fmtNum(b.total_publicacoes)} artigos</span></div>
    <div class="panel"><div class="chart-box sm"><canvas id="chPublicacoes"></canvas></div></div>
    <div class="section-title">Presença internacional das bolsas</div>
    ${heatmapBlock(DATA.paises.bolsas, {title:'Mapa de calor — país de destino', showIesDestino:true})}
  `;
}
function afterBolsas() {
  const b = DATA.bolsas;
  const iesEntries = Object.entries(b.qtd_por_ies);
  const temaEntries = Object.entries(b.qtd_por_tema);
  safeChart('chBolsasIES', { type:'bar', data:{ labels:iesEntries.map(e=>e[0]),
    datasets:[{label:'Bolsas', data:iesEntries.map(e=>e[1]), backgroundColor:'#2563a8', borderRadius:4}]}, options: countBarOpts() });
  safeChart('chBolsasTema', { type:'bar', data:{ labels:temaEntries.map(e=>e[0]),
    datasets:[{label:'Bolsas', data:temaEntries.map(e=>e[1]), backgroundColor:'#c98a2a', borderRadius:4}]}, options: countBarOpts() });
  safeChart('chBolsasModalQtd', { type:'bar', data:{ labels:b.modalidade_totais.map(m=>m.modalidade),
    datasets:[{label:'Qtd. total', data:b.modalidade_totais.map(m=>m.qtd_total), backgroundColor:'#0f2a4a', borderRadius:4}]}, options: countBarOpts() });
  document.getElementById('tblModalidade').innerHTML = `
    <tr><th>Modalidade</th><th>Qtd. Total</th><th>Qtd. Ativa</th><th>Qtd. Encerrada</th><th>Valor Executado</th></tr>
    ${b.modalidade_totais.map(m => `<tr><td>${m.modalidade}</td><td class="num">${fmtNum(m.qtd_total)}</td><td class="num">${fmtNum(m.qtd_ativa)}</td>
      <td class="num">${fmtNum(m.qtd_encerrada)}</td><td class="num">${fmtBRL(m.valor_executado)}</td></tr>`).join('')}`;
  safeChart('chPublicacoes', { type:'bar', data:{ labels:b.publicacoes_por_modalidade.map(p=>p.modalidade),
    datasets:[{label:'Artigos', data:b.publicacoes_por_modalidade.map(p=>p.qtd_publicacoes), backgroundColor:'#2f8f6e', borderRadius:4}]}, options: countBarOpts() });
  afterHeatmap(DATA.paises.bolsas, {showIesDestino:true});
}

// ============================================================
// PAGE: Missões
// ============================================================
function pageMissoes() {
  const m = DATA.missoes;
  return `
    <div class="kpi-row">
      ${kpiCard('Total de missões', fmtNum(m.registros.length))}
      ${kpiCard('Realizadas', fmtNum(m.registros.filter(r=>r.status==='Realizada').length))}
      ${kpiCard('Pendentes', fmtNum(m.registros.filter(r=>r.status==='Pendente').length))}
    </div>
    <div class="section-title">Programadas vs. realizadas por ano</div>
    <div class="grid-2">
      <div class="panel"><h3>Comitê Gestor</h3><div class="chart-box"><canvas id="chMissCG"></canvas></div></div>
      <div class="panel"><h3>Temas</h3><div class="chart-box"><canvas id="chMissTemas"></canvas></div></div>
    </div>
    <div class="section-title">Lista de missões <span class="tag">${fmtNum(m.registros.length)} registros</span></div>
    <div class="panel" style="max-height:420px;overflow-y:auto;"><table id="tblMissoes"></table></div>
    <div class="section-title">Presença internacional das missões</div>
    ${heatmapBlock(DATA.paises.missoes, {title:'Mapa de calor — destino das missões'})}
  `;
}
function afterMissoes() {
  const m = DATA.missoes;
  safeChart('chMissCG', { type:'bar', data:{ labels:m.cg_por_ano.map(a=>a.ano),
    datasets:[{label:'Programada', data:m.cg_por_ano.map(a=>a.programada), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Realizada', data:m.cg_por_ano.map(a=>a.realizada), backgroundColor:'#2f8f6e', borderRadius:4}]}, options: countBarOpts() });
  safeChart('chMissTemas', { type:'bar', data:{ labels:m.temas_por_ano.map(a=>a.ano),
    datasets:[{label:'Programada', data:m.temas_por_ano.map(a=>a.programada), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Realizada', data:m.temas_por_ano.map(a=>a.realizada), backgroundColor:'#2f8f6e', borderRadius:4}]}, options: countBarOpts() });
  document.getElementById('tblMissoes').innerHTML = `
    <tr><th>Tipo</th><th>Tema</th><th>IES</th><th>Ano</th><th>Destino</th><th>Valor</th><th>Status</th></tr>
    ${m.registros.map(r => `<tr><td>${r.tipo||'—'}</td><td>${r.tema||'—'}</td><td>${r.ies||'—'}</td><td>${r.ano||'—'}</td>
      <td>${r.destino||'—'}</td><td class="num">${r.valor_total?fmtBRL(r.valor_total):'—'}</td><td>${r.status||'—'}</td></tr>`).join('')}`;
  afterHeatmap(DATA.paises.missoes, {});
}

// ============================================================
// PAGE: Relações Internacionais
// ============================================================
function pageRI() {
  const ri = DATA.ri.resumo;
  return `
    <div class="kpi-row">
      ${kpiCard('Total de registros', fmtNum(ri.total_registros))}
      ${kpiCard('Instituições parceiras', fmtNum(ri.instituicoes_parceiras))}
      ${kpiCard('Países alcançados', fmtNum(ri.paises_alcancados))}
    </div>
    <div class="section-title">Parcerias e interações</div>
    <div class="grid-3">
      <div class="panel"><h3>Por tipo de interação</h3><table>
        <tr><th>Tipo</th><th>Qtd.</th></tr>
        ${ri.por_tipo_interacao.map(x=>`<tr><td>${x.tipo}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
      <div class="panel"><h3>Por tipo de acordo</h3><table>
        <tr><th>Tipo</th><th>Qtd.</th></tr>
        ${ri.por_tipo_acordo.map(x=>`<tr><td>${x.tipo}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
      <div class="panel"><h3>Por situação</h3><table>
        <tr><th>Situação</th><th>Qtd.</th></tr>
        ${ri.por_situacao.map(x=>`<tr><td>${x.situacao}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
    </div>
    <div class="section-title">Por continente</div>
    <div class="panel"><div class="chart-box sm"><canvas id="chContinente"></canvas></div></div>
    <div class="section-title">Mapa de parcerias e interações internacionais</div>
    ${heatmapBlock(DATA.paises.ri, {title:'Mapa de calor — parcerias e interações'})}
    <div class="section-title">Registro de parcerias e interações <span class="tag">${fmtNum(DATA.ri.registros.length)} registros</span></div>
    ${DATA.ri.registros.length ? `<div class="panel" style="max-height:420px;overflow-y:auto;"><table id="tblRI"></table></div>` :
      `<div class="panel"><div class="empty-state">Ainda não há parcerias/interações cadastradas na aba RI da planilha.</div></div>`}
  `;
}
function afterRI() {
  const ri = DATA.ri.resumo;
  safeChart('chContinente', { type:'bar', data:{ labels:ri.por_continente.map(c=>c.continente),
    datasets:[{label:'Registros', data:ri.por_continente.map(c=>c.qtd), backgroundColor:'#2563a8', borderRadius:4}]}, options: countBarOpts() });
  afterHeatmap(DATA.paises.ri, {});
  const tbl = document.getElementById('tblRI');
  if (tbl) {
    tbl.innerHTML = `
      <tr><th>Instituição</th><th>País</th><th>Continente</th><th>Tipo Interação</th><th>Tipo Acordo</th><th>IES da Rede</th><th>Situação</th></tr>
      ${DATA.ri.registros.map(r => `<tr><td>${r.instituicao||'—'}</td><td>${r.pais||'—'}</td><td>${r.continente||'—'}</td>
        <td>${r.tipo_interacao||'—'}</td><td>${r.tipo_acordo||'—'}</td><td>${r.ies_rede||'—'}</td><td>${r.situacao||'—'}</td></tr>`).join('')}`;
  }
}

// ============================================================
// PAGE: Eventos (com resumo)
// ============================================================
function pageEventos() {
  const e = DATA.eventos;
  const r = e.resumo;
  return `
    <div class="kpi-row">
      ${kpiCard('Total de eventos', fmtNum(r.total))}
    </div>
    <div class="section-title">Resumo dos eventos cadastrados</div>
    <div class="grid-3">
      <div class="panel"><h3>Por situação</h3><table>
        <tr><th>Situação</th><th>Qtd.</th></tr>
        ${r.por_situacao.map(x=>`<tr><td>${x.situacao}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
      <div class="panel"><h3>Por abrangência</h3><table>
        <tr><th>Abrangência</th><th>Qtd.</th></tr>
        ${r.por_abrangencia.map(x=>`<tr><td>${x.abrangencia}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
      <div class="panel"><h3>Por modalidade</h3><table>
        <tr><th>Modalidade</th><th>Qtd.</th></tr>
        ${r.por_modalidade.map(x=>`<tr><td>${x.modalidade}</td><td class="num">${fmtNum(x.qtd)}</td></tr>`).join('')}
      </table></div>
    </div>
    <div class="section-title">Lista de eventos <span class="tag">${fmtNum(e.registros.length)} registros</span></div>
    ${e.registros.length ? `<div class="panel"><table>
      <tr><th>Ano</th><th>Título</th><th>Tipo</th><th>Abrangência</th><th>País</th><th>Responsável</th><th>Situação</th></tr>
      ${e.registros.map(reg => `<tr><td>${reg.ano||'—'}</td><td>${reg.titulo||'—'}</td><td>${reg.tipo||'—'}</td>
        <td>${reg.abrangencia||'—'}</td><td>${reg.pais||'—'}</td><td>${reg.responsavel||'—'}</td><td>${reg.situacao||'—'}</td></tr>`).join('')}
    </table></div>` : `<div class="panel"><div class="empty-state">Ainda não há eventos cadastrados na planilha.</div></div>`}
    <div class="section-title">Presença internacional dos eventos</div>
    ${heatmapBlock(DATA.paises.eventos, {title:'Mapa de calor — país dos eventos'})}
  `;
}
function afterEventos() { afterHeatmap(DATA.paises.eventos, {}); }

// ============================================================
// PAGE: Comunicação
// ============================================================
function pageComunicacao() {
  const c = DATA.comunicacao;
  const totalPub = c.publicacoes_por_tipo.reduce((s,p)=>s+p.qtd,0);
  return `
    <div class="kpi-row">
      ${kpiCard('Total de publicações', fmtNum(totalPub))}
      ${kpiCard('Visualizações totais', fmtNum(c.visualizacoes_total))}
    </div>
    <div class="section-title">Quantidade de publicações por tipo</div>
    <div class="grid-2">
      <div class="panel"><div class="chart-box sm"><canvas id="chComunicacao"></canvas></div></div>
      <div class="panel"><table>
        <tr><th>Tipo</th><th>Qtd. Publicações</th></tr>
        ${c.publicacoes_por_tipo.map(p=>`<tr><td>${p.tipo}</td><td class="num">${fmtNum(p.qtd)}</td></tr>`).join('')}
      </table></div>
    </div>
  `;
}
function afterComunicacao() {
  const c = DATA.comunicacao;
  safeChart('chComunicacao', { type:'bar', data:{ labels:c.publicacoes_por_tipo.map(p=>p.tipo),
    datasets:[{label:'Publicações', data:c.publicacoes_por_tipo.map(p=>p.qtd), backgroundColor:'#2563a8', borderRadius:4}]},
    options: { ...countBarOpts(), plugins:{legend:{display:false}} } });
}

// ============================================================
// PAGE: Metas (placeholder — aba ainda em elaboração na planilha)
// ============================================================
function pageMetas() {
  return `
    <div class="panel">
      <div class="empty-state" style="padding:60px 20px;">
        <div style="font-size:32px;margin-bottom:12px;">🎯</div>
        <div style="font-size:14px;font-weight:600;color:var(--navy);margin-bottom:6px;">Aba em elaboração</div>
        A aba de Metas ainda está sendo estruturada na planilha. Assim que os indicadores forem definidos,
        esta página passa a exibir o acompanhamento automaticamente — não é necessário nenhum ajuste aqui no painel.
      </div>
    </div>
  `;
}
