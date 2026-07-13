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
    if (config.type === 'bar') {
      // Valores muito pequenos (ex: R$ 20 mil sobre eixo de milhões) viram barras invisíveis.
      // minBarLength garante ao menos 3px para qualquer valor > 0; zeros viram null (sem barra, sem enganar).
      (config.data.datasets || []).forEach(ds => {
        ds.minBarLength = 3;
        ds.data = ds.data.map(v => (v === 0 ? null : v));
      });
      // Tooltip da coluna inteira: passar o mouse em qualquer ponto do ano mostra todas as séries,
      // sem precisar acertar a barra minúscula.
      config.options = config.options || {};
      config.options.interaction = { mode: 'index', intersect: false };
    }
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
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
    const box = document.getElementById('mapBox');
    if (box) box.innerHTML = '<p style="color:var(--muted);font-size:12.5px;padding:20px;">Não foi possível carregar o mapa (verifique a conexão). Os dados por país continuam na tabela ao lado.</p>';
    return;
  }
  const svg = d3.select('#worldMap');
  const tooltip = document.getElementById('mapTooltip');
  const countryData = {};
  P.por_pais.forEach(p => countryData[p.pais_en] = p);
  const maxReg = Math.max(1, ...P.por_pais.map(p => p.total_registros));
  const color = d3.scaleLinear().domain([0, maxReg]).range(['#eaf1f9', '#0f2a4a']);
  const projection = d3.geoNaturalEarth1().scale(155).translate([480, 260]);
  const path = d3.geoPath().projection(projection);

  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json').then(topo => {
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
const ICONS = {
  quemsomos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="6.2"/><ellipse cx="12" cy="12" rx="6.2" ry="2.4"/><path d="M12 5.8v12.4"/><path d="M12 12L18.6 5.4M12 12L5.2 7.6M12 12l6 5.6M12 12l-6.4 5" stroke-dasharray="1.6 1.7" stroke-width="1.3"/><circle cx="18.6" cy="5.4" r="2.3" fill="currentColor" stroke="none"/><circle cx="5.2" cy="7.6" r="2.3" fill="currentColor" stroke="none"/><circle cx="18" cy="17.6" r="2.3" fill="currentColor" stroke="none"/><circle cx="5.6" cy="17" r="2.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="16" y="3" width="4" height="17" rx="1"/></svg>',
  cg: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 19c0-3 2.7-5 6-5s6 2 6 5v1H2zM13.5 14.6c.8-.4 1.7-.6 2.5-.6 3.3 0 6 2 6 5v1h-7v-1c0-1.7-.6-3.2-1.5-4.4z"/></svg>',
  instituicoes: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 8v2h20V8L12 2zM4 11v7H2v2h20v-2h-2v-7h-3v7h-3v-7h-4v7H7v-7H4z"/></svg>',
  temas: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L2 8l10 5 10-5-10-5zM4.5 11.3L2 12.5l10 5 10-5-2.5-1.2L12 15 4.5 11.3zM4.5 15.8L2 17l10 5 10-5-2.5-1.2L12 19.5l-7.5-3.7z"/></svg>',
  bolsas: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.9V17h2V9L12 3zM5 13.2V17c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5v-3.8l-7 3.8-7-3.8z"/></svg>',
  missoes: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L2 10.5l6.5 2.2L11 20l3-5 6 3L22 2zM9.5 13.5L19 5l-8 9.5-1.5-1z"/></svg>',
  ri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  eventos: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v3M17 2v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="4" width="18" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/><rect x="7" y="12" width="3" height="3" rx=".5"/><rect x="14" y="12" width="3" height="3" rx=".5"/></svg>',
  comunicacao: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4c0 .6.4 1 1 1h2l4 4c.6.6 1.7.2 1.7-.7V5.7c0-.9-1.1-1.3-1.7-.7L6 9H4c-.6 0-1 .4-1 1zM14 8.5c1.2.8 2 2 2 3.5s-.8 2.7-2 3.5v-7zM14 4.6c3 1.1 5 3.9 5 7.4s-2 6.3-5 7.4v-2.1c1.8-1 3-2.9 3-5.3s-1.2-4.3-3-5.3V4.6z"/></svg>',
  metas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  ppgs: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5c-2-1.5-4.5-2-7-2-.6 0-1 .4-1 1v14c0 .6.4 1 1 1 2.5 0 5 .5 7 2 2-1.5 4.5-2 7-2 .6 0 1-.4 1-1V4c0-.6-.4-1-1-1-2.5 0-5 .5-7 2zm0 2.2c1.6-1 3.6-1.6 6-1.7v11.1c-2.2.1-4.3.6-6 1.6V7.2zM6 5.5c2.4.1 4.4.7 6 1.7v11c-1.7-1-3.8-1.5-6-1.6V5.5z" fill-rule="evenodd"/></svg>',
};

const NAV = [
  { id:'quemsomos', label:'Sobre a Rede', icon:ICONS.quemsomos },
  { id:'dashboard', label:'Dashboard', icon:ICONS.dashboard },
  { id:'cg', label:'Comitê Gestor', icon:ICONS.cg },
  { id:'instituicoes', label:'Instituições', icon:ICONS.instituicoes, children: Object.keys(DATA.instituicoes).map(n => ({id:'inst_'+n, label:n})) },
  { id:'temas', label:'Temas', icon:ICONS.temas, children: [
      {id:'tema_overview', label:'Visão Geral'},
      ...Object.keys(DATA.temas).map(n => ({id:'tema_'+n.replace(' ',''), label:n, key:n}))
    ]},
  { id:'bolsas', label:'Bolsas', icon:ICONS.bolsas },
  { id:'missoes', label:'Missões', icon:ICONS.missoes },
  { id:'ri', label:'Relações Internacionais', icon:ICONS.ri },
  { id:'eventos', label:'Eventos', icon:ICONS.eventos },
  { id:'comunicacao', label:'Comunicação', icon:ICONS.comunicacao },
  { id:'metas', label:'Metas', icon:ICONS.metas },
  { id:'ppgs', label:'PPG\'s', icon:ICONS.ppgs },
];

const TITLES = { quemsomos:['Sobre a Rede','Rede CAPES Global para o Desenvolvimento Sustentável, Ciência e Saúde.'],
  dashboard:['Dashboard','Visão geral da execução orçamentária da rede.'],
  cg:['Comitê Gestor','Orçamento por ano e instituição, consolidado do Comitê Gestor.'],
  bolsas:['Bolsas','Bolsas por modalidade, instituição, tema e produção científica associada.'],
  missoes:['Missões','Missões programadas e realizadas - Comitê Gestor e Temas.'],
  ri:['Relações Internacionais','Parcerias, acordos e interações internacionais da rede.'],
  eventos:['Eventos','Controle de eventos institucionais da rede.'],
  comunicacao:['Comunicação','Publicações e alcance da comunicação institucional.'],
  metas:['Metas','Painel de metas da rede.'],
  tema_overview:['Temas - Visão Geral','Distribuição orçamentária por tema, missões e bolsas.'],
  ppgs:['PPG\'s','Programas de Pós-Graduação da rede — notas CAPES, corpo docente e discente.'],
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
      head.className = 'nav-item lvl0';
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
      el.className = 'nav-item lvl0';
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
function navigate(route) { location.hash = route; closeSidebar(); }
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('backdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.classList.remove('show');
}
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  buildNav(); render();
  const mt = document.getElementById('menuToggle');
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('backdrop');
  if (mt && sb && bd) {
    mt.onclick = () => { sb.classList.add('open'); bd.classList.add('show'); };
    bd.onclick = closeSidebar;
  }
});

function render() {
  const route = (location.hash || '#quemsomos').slice(1);
  setActiveNav(route);
  const root = document.getElementById('contentRoot');

  try {
    if (route === 'quemsomos') { setTitle(...TITLES.quemsomos); root.innerHTML = pageQuemSomos(); }
    else if (route === 'dashboard') { setTitle(...TITLES.dashboard); root.innerHTML = pageDashboard(); afterDashboard(); }
    else if (route === 'cg') { setTitle(...TITLES.cg); root.innerHTML = pageCG(); afterCG(); }
    else if (route.startsWith('inst_')) { const nome = route.slice(5); setTitle('Instituições - '+nome,'Orçamento e execução por ano - '+nome+'.'); root.innerHTML = pageInstituicao(nome); afterInstituicao(nome); }
    else if (route === 'tema_overview') { setTitle(...TITLES.tema_overview); root.innerHTML = pageTemasOverview(); afterTemasOverview(); }
    else if (route.startsWith('tema_')) { const key = findTemaKey(route); setTitle('Temas - '+key,'Orçamento e execução - '+key+'.'); root.innerHTML = pageTema(key); afterTema(key); }
    else if (route === 'ppgs') { setTitle(...TITLES.ppgs); root.innerHTML = pagePPGs(); afterPPGs(); }
    else if (route === 'bolsas') { setTitle(...TITLES.bolsas); root.innerHTML = pageBolsas(); afterBolsas(); }
    else if (route === 'missoes') { setTitle(...TITLES.missoes); root.innerHTML = pageMissoes(); afterMissoes(); }
    else if (route === 'ri') { setTitle(...TITLES.ri); root.innerHTML = pageRI(); afterRI(); }
    else if (route === 'eventos') { setTitle(...TITLES.eventos); root.innerHTML = pageEventos(); afterEventos(); }
    else if (route === 'comunicacao') { setTitle(...TITLES.comunicacao); root.innerHTML = pageComunicacao(); afterComunicacao(); }
    else if (route === 'metas') { setTitle(...TITLES.metas); root.innerHTML = pageMetas(); }
    else { setTitle(...TITLES.quemsomos); root.innerHTML = pageQuemSomos(); }
  } finally {
    syncHeaderAlignment();
  }
}
function setTitle(t, s) { document.getElementById('pageTitle').textContent = t; document.getElementById('pageSubtitle').textContent = s || ''; }
function syncHeaderAlignment() {
  // Alinha o título de cada coluna com o alinhamento dos dados dela (colunas numéricas ficam à direita)
  document.querySelectorAll('#contentRoot table').forEach(t => {
    const dataRows = [...t.querySelectorAll('tr')].slice(1);
    if (!dataRows.length) return;
    [...t.querySelectorAll('th')].forEach((th, i) => {
      const isNum = dataRows.some(r => { const td = r.querySelectorAll('td')[i]; return td && td.classList.contains('num'); });
      th.classList.toggle('num', isNum);
    });
  });
}
function findTemaKey(route) {
  const item = NAV.find(n => n.id === 'temas').children.find(c => c.id === route);
  return item ? item.key : route;
}

// ============================================================
// PAGE: Quem Somos
// ============================================================
const BR_STATES = [
  {d:"M 122.2,266.3 C 129.9,271.6 145.9,276.7 149.6,279.7 C 153.2,282.8 146.1,283.5 144.3,284.6 C 142.5,285.7 140.6,285.2 139.0,286.3 C 137.4,287.5 136.4,290.7 134.9,291.4 C 133.5,292.1 132.4,289.6 130.5,290.6 C 128.6,291.6 126.8,296.8 123.6,297.5 C 120.5,298.2 116.4,295.0 111.7,294.7 C 107.1,294.4 97.9,299.6 95.5,295.8 C 93.1,292.0 98.6,274.6 97.2,272.0 C 95.9,269.4 91.4,278.7 87.5,280.2 C 83.7,281.6 76.6,281.8 74.2,280.7 C 71.7,279.6 75.3,275.2 73.0,273.7 C 70.7,272.2 61.9,273.2 60.4,271.8 C 59.0,270.4 64.8,268.0 64.1,265.4 C 63.4,262.7 57.9,258.4 56.0,255.7 C 54.2,252.9 53.2,250.4 52.9,248.9 C 52.5,247.5 54.5,247.9 54.1,247.0 C 53.6,246.2 50.6,244.9 50.0,243.9 C 49.4,242.8 49.6,241.3 50.2,240.6 C 50.9,240.0 53.5,240.5 53.8,239.9 C 54.2,239.3 50.0,236.4 52.5,237.0 C 55.0,237.6 60.5,241.8 68.9,243.6 C 77.4,245.5 94.3,244.3 103.2,248.1 C 112.1,251.9 114.5,261.0 122.2,266.3 Z"},
  {d:"M 575.5,264.2 C 574.4,268.4 563.0,285.6 558.8,288.2 C 554.7,290.9 554.7,283.3 550.6,280.3 C 546.4,277.4 535.5,273.4 533.7,270.5 C 532.0,267.7 537.3,263.2 540.2,263.4 C 543.1,263.5 547.7,270.5 551.1,271.3 C 554.6,272.1 558.6,269.5 561.0,268.1 C 563.4,266.8 563.0,264.0 565.4,263.3 C 567.8,262.7 576.6,260.1 575.5,264.2 Z"},
  {d:"M 139.0,95.4 C 140.9,95.7 142.5,100.5 143.2,103.2 C 143.9,105.9 142.8,110.5 143.3,111.7 C 143.9,113.0 144.7,109.7 146.5,110.8 C 148.2,111.9 150.9,117.7 153.8,118.3 C 156.6,118.8 161.9,113.9 163.7,114.1 C 165.4,114.4 163.2,120.0 164.3,119.6 C 165.4,119.2 168.4,113.4 170.2,111.9 C 172.0,110.4 173.4,111.8 175.0,110.9 C 176.6,109.9 178.8,106.6 179.7,106.3 C 180.7,105.9 179.6,109.9 180.5,108.8 C 181.4,107.6 182.5,101.5 185.2,99.4 C 187.9,97.4 193.8,96.4 196.7,96.5 C 199.6,96.6 201.9,98.6 202.6,100.1 C 203.4,101.6 200.7,102.9 201.3,105.3 C 201.9,107.8 205.6,112.0 206.2,114.7 C 206.8,117.5 204.4,118.4 205.0,121.7 C 205.5,125.0 209.1,131.5 209.6,134.4 C 210.2,137.3 208.9,138.2 208.2,139.3 C 207.4,140.3 204.4,139.0 205.3,140.9 C 206.2,142.8 211.2,148.4 213.6,150.5 C 215.9,152.6 218.7,153.3 219.3,153.3 C 219.9,153.3 217.6,152.1 217.3,150.5 C 217.1,148.9 216.9,145.8 217.8,143.6 C 218.7,141.3 221.3,137.9 222.8,137.0 C 224.3,136.0 225.5,136.8 226.8,137.8 C 228.0,138.8 228.8,142.5 230.2,142.9 C 231.6,143.4 234.4,141.3 235.1,140.4 C 235.7,139.4 233.2,139.6 233.8,137.1 C 234.4,134.6 235.3,127.4 238.7,125.4 C 242.1,123.5 251.6,123.9 254.2,125.4 C 256.8,126.9 253.2,131.0 254.5,134.6 C 255.8,138.1 260.3,144.5 261.9,146.7 C 263.5,148.9 263.4,148.1 264.1,148.0 C 264.8,147.9 265.6,145.7 266.1,146.1 C 266.5,146.6 264.9,149.0 266.8,150.6 C 268.8,152.1 274.7,153.4 277.6,155.4 C 280.5,157.5 281.8,162.1 284.2,162.9 C 286.6,163.6 291.6,159.5 292.0,160.1 C 292.5,160.6 292.4,154.3 287.1,166.1 C 281.7,177.8 263.6,218.3 259.8,230.7 C 256.1,243.2 264.2,237.8 264.5,240.7 C 264.7,243.6 261.7,244.5 261.1,248.1 C 260.5,251.6 268.3,259.7 261.1,262.1 C 253.8,264.5 225.3,262.7 217.8,262.5 C 210.3,262.3 217.0,260.6 216.1,260.8 C 215.2,261.0 214.9,265.5 212.4,263.7 C 209.8,261.9 204.4,252.5 200.7,250.2 C 197.1,247.9 192.4,249.1 190.2,250.0 C 188.1,250.8 188.8,254.5 188.1,255.4 C 187.3,256.3 186.7,253.8 185.9,255.4 C 185.0,257.0 185.1,263.3 183.1,264.9 C 181.1,266.6 175.9,264.3 173.8,265.5 C 171.6,266.7 171.2,271.4 170.3,272.1 C 169.3,272.8 169.8,269.1 168.2,269.4 C 166.7,269.8 162.5,274.0 160.9,274.4 C 159.2,274.8 159.8,272.2 158.5,271.8 C 157.1,271.3 154.4,270.7 152.5,271.7 C 150.6,272.7 152.1,278.8 147.1,277.9 C 142.0,277.0 129.5,271.3 122.2,266.3 C 114.9,261.3 112.1,251.9 103.2,248.1 C 94.3,244.3 77.4,245.5 68.9,243.6 C 60.5,241.8 54.9,239.0 52.5,237.0 C 50.1,235.0 53.1,233.2 54.6,231.7 C 56.1,230.1 60.5,229.5 61.4,227.7 C 62.4,225.9 59.4,224.2 60.1,220.7 C 60.8,217.2 62.8,210.5 65.8,206.7 C 68.9,202.9 74.2,199.5 78.4,197.7 C 82.7,195.9 88.4,196.7 91.2,195.7 C 93.9,194.8 93.7,192.4 95.1,191.8 C 96.5,191.2 98.5,191.5 99.5,192.1 C 100.5,192.7 100.4,195.1 101.2,195.5 C 102.0,195.8 102.6,202.6 104.4,194.5 C 106.2,186.3 111.3,156.1 112.1,146.5 C 112.9,137.0 110.6,139.4 109.1,137.1 C 107.6,134.7 104.1,134.9 103.1,132.2 C 102.2,129.5 102.0,123.3 103.3,120.9 C 104.6,118.6 108.8,118.5 110.9,118.3 C 113.0,118.0 115.4,120.4 115.9,119.6 C 116.4,118.7 115.5,114.4 113.9,113.3 C 112.2,112.2 107.3,114.6 106.0,113.0 C 104.7,111.3 102.2,105.0 106.1,103.4 C 109.9,101.7 125.2,103.8 128.9,103.2 C 132.5,102.6 127.7,100.0 128.2,99.7 C 128.6,99.5 130.0,102.4 131.8,101.7 C 133.6,101.0 137.1,95.2 139.0,95.4 Z"},
  {d:"M 373.3,118.8 C 372.1,120.2 370.3,118.6 369.0,120.0 C 367.7,121.3 367.2,124.8 365.4,126.7 C 363.6,128.6 360.3,128.8 358.1,131.2 C 355.9,133.6 353.1,138.5 352.0,140.9 C 350.9,143.3 352.5,144.3 351.6,145.5 C 350.6,146.7 347.8,148.0 346.1,147.9 C 344.5,147.9 342.7,146.9 341.7,145.3 C 340.8,143.7 341.6,140.6 340.4,138.3 C 339.3,136.0 336.4,134.0 334.9,131.5 C 333.4,129.1 332.0,125.8 331.6,123.7 C 331.2,121.7 333.1,120.4 332.5,119.0 C 332.0,117.6 329.1,116.7 328.4,115.3 C 327.7,113.9 329.7,112.0 328.2,110.6 C 326.7,109.2 321.3,108.1 319.3,106.9 C 317.3,105.6 317.7,103.8 316.3,103.1 C 314.8,102.3 311.6,104.3 310.4,102.5 C 309.1,100.8 307.3,93.7 308.6,92.7 C 309.8,91.7 315.4,96.3 317.9,96.4 C 320.4,96.6 320.7,93.4 323.6,93.4 C 326.5,93.4 332.5,96.7 335.2,96.3 C 338.0,96.0 338.7,93.8 340.0,91.3 C 341.3,88.9 340.9,85.3 343.0,81.4 C 345.0,77.5 350.4,71.4 352.3,68.2 C 354.1,65.0 352.8,61.9 354.1,62.3 C 355.4,62.7 358.9,67.3 360.0,70.5 C 361.1,73.8 359.7,77.5 360.6,81.9 C 361.4,86.4 363.7,94.7 365.1,97.0 C 366.4,99.4 367.5,95.3 368.5,96.1 C 369.6,97.0 370.1,100.8 371.3,102.1 C 372.5,103.4 374.9,102.2 375.7,103.7 C 376.5,105.3 376.4,108.8 376.0,111.3 C 375.6,113.9 374.5,117.3 373.3,118.8 Z"},
  {d:"M 519.2,258.9 C 521.5,259.7 526.2,264.5 528.0,265.2 C 529.7,265.9 529.2,262.8 529.6,262.9 C 530.1,263.0 530.2,265.3 530.7,265.8 C 531.3,266.3 531.3,262.6 533.0,265.9 C 534.6,269.2 539.6,282.2 540.5,285.7 C 541.5,289.3 539.0,286.3 538.9,287.2 C 538.7,288.1 540.3,290.4 539.5,291.1 C 538.7,291.9 535.0,291.0 534.1,291.5 C 533.2,292.1 533.0,292.5 533.9,294.5 C 534.8,296.6 537.5,302.3 539.5,303.6 C 541.5,304.9 546.4,299.7 545.9,302.5 C 545.3,305.3 540.0,315.9 536.3,320.5 C 532.6,325.2 526.2,325.1 523.9,330.3 C 521.6,335.5 522.3,345.4 522.5,351.9 C 522.8,358.4 525.7,363.1 525.4,369.3 C 525.0,375.5 521.2,384.5 520.5,389.1 C 519.9,393.7 522.6,394.0 521.6,397.0 C 520.6,400.0 516.8,406.3 514.4,407.0 C 511.9,407.7 508.1,403.0 506.9,401.4 C 505.6,399.9 507.8,399.1 506.9,397.7 C 506.0,396.2 502.1,394.9 501.5,392.7 C 500.9,390.6 502.5,386.1 503.2,384.8 C 504.0,383.6 505.6,385.9 506.1,385.1 C 506.6,384.3 505.2,382.1 506.2,380.1 C 507.1,378.1 511.7,375.1 511.8,373.2 C 511.9,371.2 508.9,369.7 506.8,368.5 C 504.6,367.3 501.3,366.3 498.8,366.1 C 496.4,366.0 493.1,368.0 491.9,367.6 C 490.7,367.2 492.6,365.5 491.5,363.9 C 490.5,362.2 487.2,358.6 485.5,357.8 C 483.9,357.1 484.7,360.3 481.6,359.1 C 478.5,358.0 470.2,352.0 466.9,351.0 C 463.7,350.1 463.7,353.5 462.1,353.5 C 460.5,353.5 457.9,352.3 457.3,351.1 C 456.8,349.9 459.4,347.4 458.7,346.3 C 458.0,345.3 458.0,342.4 452.9,344.7 C 447.7,347.1 431.5,360.0 427.7,360.3 C 423.8,360.6 430.4,349.5 430.0,346.5 C 429.5,343.6 425.9,345.0 425.1,342.7 C 424.3,340.3 424.9,334.6 425.4,332.6 C 425.9,330.5 428.3,330.6 428.1,330.3 C 428.0,329.9 425.1,331.1 424.4,330.7 C 423.8,330.2 423.9,328.5 424.3,327.5 C 424.8,326.6 427.1,325.2 427.2,324.8 C 427.2,324.5 424.7,326.4 424.6,325.3 C 424.5,324.2 426.7,319.8 426.6,318.2 C 426.5,316.7 424.5,317.2 423.9,316.0 C 423.4,314.9 422.9,312.7 423.3,311.5 C 423.7,310.4 426.3,309.8 426.4,309.4 C 426.4,309.0 423.9,309.6 423.6,308.9 C 423.3,308.3 423.8,305.9 424.5,305.3 C 425.1,304.7 428.0,305.7 427.6,305.4 C 427.2,305.1 423.4,304.5 422.2,303.6 C 421.0,302.7 419.7,302.4 420.4,300.2 C 421.0,298.0 423.6,293.5 425.8,290.5 C 428.1,287.5 431.9,281.9 434.0,282.3 C 436.2,282.8 437.4,291.0 438.9,293.1 C 440.4,295.2 441.7,295.2 443.2,294.7 C 444.7,294.2 446.1,290.9 447.9,290.2 C 449.8,289.4 451.9,291.9 454.0,290.3 C 456.1,288.7 459.7,283.5 460.3,280.7 C 461.0,278.0 457.4,275.7 457.8,273.8 C 458.2,272.0 460.3,269.4 462.7,269.6 C 465.2,269.7 469.8,274.8 472.5,274.9 C 475.1,275.0 476.5,271.3 478.6,270.3 C 480.7,269.4 482.9,270.8 485.0,269.2 C 487.1,267.7 489.6,262.5 491.2,261.1 C 492.8,259.8 493.2,259.9 494.8,261.1 C 496.4,262.2 500.1,266.1 500.9,268.0 C 501.6,269.8 499.3,271.6 499.4,272.4 C 499.5,273.2 500.5,273.1 501.5,272.9 C 502.5,272.6 504.5,272.0 505.4,270.9 C 506.2,269.8 505.6,267.3 506.4,266.5 C 507.3,265.7 509.2,267.3 510.5,266.3 C 511.7,265.3 512.6,261.7 514.1,260.5 C 515.5,259.2 516.9,258.1 519.2,258.9 Z"},
  {d:"M 547.1,202.5 C 549.0,205.6 543.9,201.1 541.8,203.9 C 539.8,206.7 536.8,215.9 534.7,219.4 C 532.6,222.8 530.5,221.8 529.1,224.4 C 527.8,227.0 526.5,232.6 526.6,235.2 C 526.7,237.8 530.2,237.6 529.7,239.7 C 529.3,241.9 526.6,248.0 523.9,248.1 C 521.3,248.2 517.1,241.6 513.7,240.4 C 510.4,239.2 505.5,242.2 504.0,240.8 C 502.6,239.5 505.6,234.1 504.9,232.3 C 504.2,230.5 501.2,234.1 500.0,230.1 C 498.7,226.0 498.5,212.3 497.4,207.8 C 496.2,203.3 493.4,205.6 493.0,203.1 C 492.6,200.5 495.2,194.6 495.1,192.5 C 495.1,190.4 493.6,192.5 492.9,190.4 C 492.1,188.4 490.6,182.7 490.6,180.3 C 490.6,178.0 492.7,177.2 492.9,176.1 C 493.1,175.0 489.0,174.2 492.0,173.6 C 495.0,173.0 504.3,170.7 510.7,172.6 C 517.1,174.6 524.4,180.4 530.5,185.4 C 536.6,190.4 545.2,199.4 547.1,202.5 Z"},
  {d:"M 398.9,363.9 C 401.1,362.7 408.9,363.8 410.9,365.2 C 412.9,366.6 413.2,371.0 411.0,372.2 C 408.8,373.4 399.9,373.6 397.9,372.2 C 395.8,370.8 396.8,365.1 398.9,363.9 Z"},
  {d:"M 502.9,400.1 C 505.6,401.0 512.6,403.0 514.4,406.7 C 516.3,410.5 516.9,414.9 514.0,422.4 C 511.1,429.9 501.1,447.1 496.9,451.7 C 492.7,456.2 490.8,451.2 488.7,449.9 C 486.6,448.5 485.1,445.6 484.5,443.4 C 483.8,441.3 483.8,438.4 484.9,437.0 C 486.0,435.5 489.2,437.0 491.2,434.8 C 493.2,432.7 496.2,427.1 497.0,424.0 C 497.9,420.9 496.8,418.0 496.1,416.4 C 495.5,414.9 492.8,415.0 493.1,414.6 C 493.3,414.2 497.3,415.4 497.5,414.0 C 497.7,412.7 493.9,408.0 494.2,406.4 C 494.5,404.7 498.9,404.9 499.5,404.1 C 500.0,403.3 497.9,402.0 497.7,401.5 C 497.4,401.0 497.1,401.5 498.0,401.3 C 498.8,401.0 500.1,399.2 502.9,400.1 Z"},
  {d:"M 372.4,317.2 C 372.8,317.5 368.8,321.5 370.6,323.6 C 372.4,325.8 380.5,330.3 383.1,330.2 C 385.7,330.1 385.6,323.7 386.5,322.9 C 387.4,322.1 387.8,325.4 388.4,325.4 C 389.1,325.5 389.3,322.9 390.2,323.2 C 391.0,323.4 392.9,325.7 393.5,327.0 C 394.1,328.3 393.5,330.7 393.7,330.9 C 393.9,331.0 394.4,328.1 394.8,328.0 C 395.1,327.9 394.8,330.4 395.7,330.5 C 396.5,330.5 399.0,328.3 399.7,328.4 C 400.3,328.4 398.7,330.3 399.4,330.7 C 400.1,331.1 402.9,330.4 404.0,330.8 C 405.1,331.2 405.6,333.7 406.0,333.1 C 406.4,332.6 406.0,328.1 406.6,327.6 C 407.2,327.2 406.7,330.8 409.4,330.4 C 412.1,330.1 420.3,326.8 422.5,325.6 C 424.8,324.4 422.8,323.3 423.0,323.4 C 423.3,323.4 423.1,325.7 423.8,325.9 C 424.5,326.2 427.1,324.6 427.2,324.8 C 427.3,325.1 424.7,326.5 424.3,327.5 C 424.0,328.6 424.3,330.9 424.9,331.3 C 425.6,331.8 428.1,330.1 428.1,330.3 C 428.2,330.5 425.9,330.5 425.4,332.6 C 424.9,334.6 424.3,340.3 425.1,342.7 C 425.9,345.0 429.6,344.5 430.0,346.6 C 430.4,348.7 428.9,354.5 427.5,355.4 C 426.2,356.2 422.8,351.5 421.9,351.8 C 421.0,352.1 422.9,356.2 421.9,357.1 C 420.9,358.0 416.9,355.1 416.2,357.2 C 415.5,359.3 418.6,367.3 417.7,369.7 C 416.8,372.2 412.2,373.0 410.8,372.0 C 409.5,371.0 411.5,365.2 409.5,363.9 C 407.5,362.5 400.9,362.5 398.9,363.9 C 397.0,365.3 395.8,370.8 397.9,372.2 C 399.9,373.6 409.2,371.2 411.1,372.4 C 412.9,373.5 408.5,376.8 408.9,379.1 C 409.3,381.4 413.6,383.9 413.5,386.3 C 413.3,388.7 408.2,391.9 407.8,393.4 C 407.5,395.0 411.0,394.3 411.6,395.8 C 412.2,397.3 412.9,400.3 411.3,402.6 C 409.8,404.8 404.5,408.6 402.2,409.3 C 400.0,410.0 400.3,407.2 398.1,406.7 C 395.9,406.2 391.5,405.5 389.0,406.3 C 386.4,407.1 384.2,411.0 382.8,411.5 C 381.5,412.0 382.9,409.0 380.9,409.2 C 378.8,409.3 373.4,409.7 370.4,412.2 C 367.5,414.8 368.0,424.4 363.2,424.4 C 358.3,424.4 346.1,414.3 341.4,412.2 C 336.7,410.0 335.8,412.2 335.1,411.4 C 334.4,410.5 337.6,407.8 337.2,407.0 C 336.8,406.2 333.7,408.5 332.6,406.4 C 331.5,404.3 330.4,398.2 330.6,394.5 C 330.8,390.8 332.4,386.9 333.8,384.4 C 335.2,381.9 338.3,380.9 339.0,379.5 C 339.8,378.1 337.4,377.7 338.3,376.0 C 339.1,374.4 342.3,371.0 344.1,369.8 C 345.9,368.6 347.5,370.9 349.1,368.8 C 350.8,366.7 352.0,359.7 353.8,357.4 C 355.6,355.1 358.3,357.5 359.9,355.1 C 361.5,352.6 362.8,345.5 363.3,342.5 C 363.8,339.6 362.0,340.6 362.8,337.2 C 363.6,333.7 366.5,325.0 368.1,321.7 C 369.7,318.3 372.0,316.8 372.4,317.2 Z"},
  {d:"M 430.8,145.2 C 430.9,145.2 429.8,147.8 429.9,148.1 C 430.0,148.4 431.4,146.9 431.5,147.0 C 431.7,147.1 430.9,148.4 430.9,148.8 C 430.8,149.3 431.4,149.7 431.4,149.7 C 431.4,149.7 430.7,149.4 430.9,148.8 C 431.0,148.3 431.9,146.9 432.3,146.5 C 432.6,146.2 433.0,146.0 433.1,146.7 C 433.1,147.4 431.8,150.5 432.4,150.8 C 433.0,151.2 436.1,148.9 436.7,148.9 C 437.2,148.9 435.8,150.4 435.6,151.1 C 435.4,151.7 435.5,152.3 435.6,152.5 C 435.7,152.8 435.8,153.2 436.2,152.7 C 436.7,152.3 438.0,149.2 438.2,149.7 C 438.4,150.2 437.0,155.6 437.5,155.7 C 437.9,155.7 440.3,150.6 440.9,150.0 C 441.4,149.4 440.7,151.6 440.8,152.0 C 440.8,152.4 440.3,152.5 440.9,152.3 C 441.6,152.1 444.3,150.6 444.7,150.8 C 445.2,151.1 443.2,153.3 443.6,153.8 C 444.0,154.3 447.0,153.4 447.1,154.0 C 447.2,154.5 444.3,156.8 444.3,157.1 C 444.3,157.3 446.4,155.6 446.9,155.4 C 447.5,155.2 447.0,153.8 447.7,155.8 C 448.5,157.8 450.1,165.6 451.4,167.2 C 452.6,168.9 455.0,165.7 455.5,165.7 C 455.9,165.6 454.1,166.4 454.2,166.8 C 454.3,167.2 454.9,169.0 456.0,168.3 C 457.2,167.7 457.6,162.6 461.0,163.0 C 464.4,163.3 472.3,169.2 476.3,170.4 C 480.4,171.7 483.7,169.9 485.2,170.5 C 486.8,171.2 486.4,172.4 485.6,174.2 C 484.7,176.0 481.7,180.1 480.1,181.4 C 478.5,182.6 477.8,179.7 476.0,181.7 C 474.2,183.7 470.1,189.1 469.4,193.4 C 468.8,197.8 472.3,204.3 472.0,207.8 C 471.8,211.3 468.6,212.4 468.0,214.6 C 467.3,216.8 467.7,219.2 468.3,221.0 C 468.9,222.8 471.3,223.7 471.6,225.3 C 472.0,226.8 471.7,229.0 470.4,230.3 C 469.1,231.6 465.4,232.9 463.6,232.9 C 461.8,233.0 461.0,230.9 459.6,230.7 C 458.2,230.5 457.5,229.9 455.3,231.7 C 453.1,233.4 449.7,239.0 446.5,241.3 C 443.2,243.6 439.0,241.6 436.1,245.4 C 433.1,249.3 429.5,259.9 428.8,264.4 C 428.0,269.0 431.7,269.4 431.6,272.8 C 431.6,276.2 430.0,282.9 428.6,284.6 C 427.3,286.4 425.2,284.6 423.7,283.2 C 422.3,281.9 420.4,278.4 420.0,276.6 C 419.5,274.9 422.1,274.6 421.1,272.9 C 420.2,271.2 414.8,269.3 414.2,266.5 C 413.7,263.8 416.5,258.5 417.8,256.5 C 419.0,254.5 421.1,255.6 421.8,254.5 C 422.5,253.5 422.4,251.1 422.1,250.2 C 421.7,249.2 421.0,248.7 419.8,248.9 C 418.5,249.1 416.7,252.4 414.6,251.2 C 412.5,250.1 408.2,243.9 407.2,241.9 C 406.1,240.0 408.7,240.3 408.3,239.7 C 408.0,239.1 405.1,239.0 405.0,238.2 C 405.0,237.4 407.2,237.2 408.0,234.9 C 408.9,232.6 410.0,227.9 410.1,224.2 C 410.1,220.5 410.6,215.8 408.4,213.0 C 406.2,210.2 399.5,208.0 396.7,207.6 C 393.9,207.1 389.7,211.9 391.4,210.3 C 393.1,208.8 403.1,202.1 406.9,198.3 C 410.6,194.6 411.6,192.1 414.0,187.8 C 416.3,183.5 420.0,175.3 420.9,172.4 C 421.9,169.4 419.4,170.9 419.7,170.2 C 420.1,169.4 422.5,168.8 423.0,167.6 C 423.6,166.5 422.6,164.2 422.9,163.3 C 423.2,162.3 424.5,163.1 425.0,162.1 C 425.5,161.0 426.0,158.1 425.9,157.1 C 425.8,156.1 424.2,156.5 424.3,156.1 C 424.4,155.7 426.2,156.1 426.6,154.8 C 427.0,153.4 426.3,149.6 426.7,148.0 C 427.1,146.4 428.5,145.2 428.9,145.2 C 429.4,145.2 429.1,148.1 429.4,148.1 C 429.7,148.1 430.8,145.2 430.8,145.2 Z"},
  {d:"M 452.9,344.8 C 458.1,342.4 457.9,345.2 458.7,346.3 C 459.5,347.4 457.1,350.2 457.7,351.4 C 458.2,352.6 460.6,353.6 462.1,353.5 C 463.6,353.5 463.7,350.1 466.9,351.0 C 470.2,352.0 478.5,358.0 481.6,359.1 C 484.7,360.3 483.9,357.1 485.5,357.8 C 487.2,358.6 490.5,362.2 491.5,363.9 C 492.6,365.5 490.4,367.2 491.9,367.6 C 493.4,368.0 497.1,365.5 500.4,366.4 C 503.7,367.4 510.9,370.9 511.8,373.2 C 512.8,375.5 507.1,378.1 506.2,380.1 C 505.2,382.1 506.5,384.3 506.1,385.1 C 505.6,385.8 504.1,384.3 503.4,384.7 C 502.7,385.1 502.5,386.2 502.2,387.5 C 501.8,388.9 500.7,391.0 501.5,392.7 C 502.2,394.4 506.0,396.2 506.9,397.7 C 507.8,399.1 508.4,400.8 506.9,401.4 C 505.4,402.0 499.2,400.8 498.0,401.3 C 496.7,401.7 500.1,403.2 499.5,404.1 C 498.8,404.9 494.5,404.7 494.2,406.4 C 493.9,408.0 497.7,412.7 497.5,414.0 C 497.3,415.4 493.3,414.2 493.1,414.6 C 492.8,415.0 495.4,414.9 496.1,416.4 C 496.8,418.0 497.9,420.7 497.1,423.8 C 496.3,426.9 493.2,432.6 491.2,434.8 C 489.2,437.0 485.8,435.8 484.9,437.0 C 483.9,438.1 486.1,440.1 485.4,441.7 C 484.7,443.3 482.0,444.2 480.8,446.7 C 479.5,449.2 478.1,454.6 477.8,456.5 C 477.6,458.3 480.8,456.7 479.2,457.9 C 477.6,459.1 471.7,462.7 468.3,463.6 C 464.9,464.5 464.2,461.8 458.9,463.2 C 453.7,464.6 441.2,470.8 436.8,472.1 C 432.4,473.4 433.4,470.4 432.5,471.0 C 431.7,471.5 433.1,474.3 431.7,475.2 C 430.2,476.0 425.4,476.7 424.0,475.9 C 422.6,475.1 424.0,471.9 423.2,470.4 C 422.3,468.9 419.1,469.6 418.9,466.9 C 418.7,464.2 422.5,456.4 421.8,454.2 C 421.2,452.0 416.7,454.9 415.0,453.5 C 413.4,452.0 412.1,447.3 411.9,445.4 C 411.7,443.4 414.4,444.0 413.9,441.7 C 413.3,439.4 412.7,432.6 408.8,431.4 C 404.9,430.2 393.7,433.2 390.5,434.4 C 387.2,435.6 389.8,438.6 389.5,438.6 C 389.1,438.6 388.9,434.8 388.2,434.5 C 387.5,434.1 385.6,437.0 385.0,436.5 C 384.4,436.1 385.5,432.5 384.7,431.5 C 384.0,430.5 383.4,431.0 380.6,430.5 C 377.9,430.1 371.5,428.2 368.2,428.6 C 364.9,429.1 362.1,434.0 361.0,433.2 C 359.9,432.5 361.1,425.7 361.5,424.1 C 361.9,422.6 363.0,424.7 363.4,424.2 C 363.7,423.7 362.4,423.1 363.5,421.2 C 364.7,419.2 367.5,414.2 370.4,412.2 C 373.3,410.2 378.8,409.3 380.9,409.2 C 382.9,409.0 381.5,412.0 382.8,411.5 C 384.2,411.0 386.4,407.1 389.0,406.3 C 391.5,405.5 395.9,406.2 398.1,406.7 C 400.3,407.2 400.0,410.0 402.2,409.3 C 404.5,408.6 409.8,404.8 411.3,402.6 C 412.9,400.3 412.1,397.5 411.6,395.8 C 411.0,394.1 407.6,394.0 407.9,392.5 C 408.2,390.9 413.3,388.5 413.5,386.3 C 413.6,384.1 409.3,381.5 408.9,379.1 C 408.5,376.7 409.6,373.3 411.1,371.7 C 412.6,370.1 416.9,371.9 417.8,369.5 C 418.7,367.1 415.6,359.1 416.3,357.1 C 416.9,355.0 420.8,358.1 421.7,357.2 C 422.7,356.4 421.7,352.2 422.3,351.9 C 422.8,351.5 423.8,354.7 424.8,355.2 C 425.9,355.7 428.1,354.0 428.6,354.8 C 429.2,355.7 423.9,362.0 427.9,360.3 C 432.0,358.6 447.8,347.1 452.9,344.8 Z"},
  {d:"M 292.0,389.2 C 295.6,390.1 301.8,395.7 305.2,396.4 C 308.6,397.2 310.8,393.6 312.6,393.7 C 314.4,393.7 314.8,396.2 315.9,396.6 C 317.0,397.0 317.9,397.0 319.3,395.9 C 320.7,394.8 323.6,389.9 324.4,390.0 C 325.3,390.1 324.8,395.4 324.4,396.6 C 324.1,397.8 322.9,396.5 322.4,397.2 C 321.8,397.9 319.4,399.7 321.1,400.5 C 322.9,401.4 331.0,401.2 333.0,402.2 C 335.0,403.3 332.3,406.1 333.0,406.9 C 333.7,407.7 336.9,406.3 337.2,407.0 C 337.6,407.8 334.5,410.6 335.2,411.4 C 335.9,412.3 337.0,410.1 341.4,412.2 C 345.9,414.2 358.8,419.9 361.9,423.8 C 365.0,427.7 361.7,432.5 360.2,435.5 C 358.8,438.5 355.3,438.0 353.0,441.7 C 350.7,445.4 348.5,453.9 346.5,457.9 C 344.5,461.9 344.3,462.4 340.9,465.5 C 337.4,468.6 329.8,471.9 325.8,476.6 C 321.7,481.3 318.9,491.3 316.5,493.5 C 314.1,495.7 313.1,489.8 311.4,489.6 C 309.6,489.4 307.8,492.0 306.1,492.4 C 304.4,492.7 302.5,495.2 301.2,491.9 C 300.0,488.5 299.6,476.4 298.6,472.2 C 297.6,467.9 296.7,467.4 295.4,466.5 C 294.0,465.5 291.7,466.9 290.5,466.4 C 289.3,465.9 289.5,463.3 288.1,463.3 C 286.6,463.4 285.6,466.9 282.0,466.8 C 278.3,466.7 268.4,466.4 266.2,463.0 C 264.0,459.5 269.1,451.0 268.8,446.2 C 268.4,441.5 264.1,437.0 264.0,434.6 C 264.0,432.1 268.1,432.6 268.2,431.5 C 268.3,430.5 263.6,432.7 264.5,428.3 C 265.4,423.9 272.9,410.7 273.7,405.2 C 274.5,399.7 269.1,395.9 269.1,395.0 C 269.1,394.2 272.0,399.8 273.7,400.2 C 275.4,400.7 277.6,399.1 279.2,397.6 C 280.9,396.1 281.3,392.7 283.4,391.3 C 285.6,389.9 288.4,388.3 292.0,389.2 Z"},
  {d:"M 271.8,261.1 C 273.8,264.1 266.5,268.8 283.2,271.7 C 299.8,274.6 357.7,275.1 371.5,278.3 C 385.4,281.4 367.6,286.6 366.4,290.7 C 365.2,294.7 364.8,297.5 364.6,302.4 C 364.3,307.3 364.5,316.6 365.0,320.2 C 365.6,323.9 368.2,321.5 367.8,324.3 C 367.4,327.1 363.5,334.1 362.8,337.2 C 362.0,340.2 363.8,339.6 363.3,342.5 C 362.8,345.5 361.5,352.6 359.9,355.1 C 358.3,357.5 355.6,355.1 353.8,357.4 C 352.0,359.7 350.8,366.7 349.1,368.8 C 347.5,370.9 345.9,368.6 344.1,369.8 C 342.3,371.0 339.1,374.4 338.3,376.0 C 337.4,377.7 339.6,378.4 338.9,379.8 C 338.2,381.2 335.1,382.5 333.8,384.4 C 332.5,386.3 331.5,389.0 331.0,391.1 C 330.5,393.2 330.3,395.2 330.6,397.0 C 331.0,398.9 334.6,401.6 333.0,402.2 C 331.4,402.8 322.6,401.5 321.1,400.5 C 319.7,399.6 323.9,398.4 324.4,396.6 C 325.0,394.9 325.3,390.1 324.4,390.0 C 323.6,389.9 320.7,394.8 319.3,395.9 C 317.9,397.0 317.0,397.0 315.9,396.6 C 314.8,396.2 314.4,393.7 312.6,393.7 C 310.8,393.6 308.6,397.2 305.2,396.4 C 301.7,395.7 295.5,390.0 291.8,389.1 C 288.2,388.2 285.5,389.8 283.4,391.3 C 281.3,392.7 280.9,396.1 279.2,397.6 C 277.6,399.1 275.3,400.7 273.7,400.2 C 272.2,399.7 271.3,395.6 270.0,394.6 C 268.7,393.6 267.2,394.9 265.7,394.0 C 264.2,393.1 261.9,391.3 260.9,389.3 C 260.0,387.3 259.8,384.4 259.9,382.1 C 260.1,379.8 265.8,376.6 262.0,375.5 C 258.1,374.3 241.2,377.5 236.9,375.5 C 232.6,373.5 236.9,366.4 236.0,363.5 C 235.1,360.6 231.6,358.9 231.6,358.0 C 231.6,357.0 235.8,360.1 235.9,357.8 C 236.1,355.5 232.9,346.8 232.6,344.0 C 232.3,341.2 234.6,342.3 234.1,341.0 C 233.6,339.7 229.6,337.8 229.5,336.4 C 229.5,335.1 232.5,335.6 234.0,332.9 C 235.5,330.2 236.9,323.1 238.3,320.3 C 239.7,317.4 242.4,318.0 242.3,316.1 C 242.2,314.1 238.1,311.0 237.8,308.5 C 237.5,306.0 240.1,302.7 240.4,300.9 C 240.6,299.1 240.7,298.4 239.5,297.6 C 238.2,296.7 236.6,296.0 233.0,295.7 C 229.5,295.3 220.6,299.0 218.3,295.6 C 216.0,292.2 219.4,279.4 219.3,275.1 C 219.1,270.7 217.1,271.4 217.1,269.6 C 217.2,267.8 219.3,265.5 219.4,264.3 C 219.5,263.1 210.9,262.8 217.8,262.5 C 224.7,262.2 253.2,264.1 260.7,262.4 C 268.1,260.7 262.4,254.8 262.4,252.4 C 262.5,250.0 260.8,250.0 261.1,248.1 C 261.4,246.1 262.8,239.6 264.4,240.6 C 266.1,241.5 269.9,250.2 271.1,253.6 C 272.4,257.1 269.8,258.1 271.8,261.1 Z"},
  {d:"M 307.5,90.3 C 309.0,91.9 308.9,100.4 310.4,102.5 C 311.8,104.7 314.8,102.3 316.3,103.1 C 317.7,103.8 317.3,105.6 319.3,106.9 C 321.3,108.1 326.7,109.2 328.2,110.6 C 329.7,112.0 327.7,113.9 328.4,115.3 C 329.1,116.7 332.0,117.6 332.5,119.0 C 333.1,120.4 331.2,121.7 331.6,123.7 C 332.0,125.8 333.4,129.1 334.9,131.5 C 336.4,134.0 339.3,136.0 340.4,138.3 C 341.6,140.6 340.8,143.7 341.7,145.3 C 342.7,146.9 344.5,147.9 346.1,147.9 C 347.8,148.0 350.6,146.7 351.6,145.5 C 352.5,144.3 350.9,143.3 352.0,140.9 C 353.1,138.5 354.7,134.9 358.1,131.2 C 361.5,127.5 369.8,119.9 372.4,118.7 C 375.1,117.6 372.7,123.4 373.7,124.3 C 374.8,125.1 377.4,123.0 378.9,123.9 C 380.4,124.7 381.0,127.7 382.7,129.2 C 384.4,130.6 386.8,132.1 389.0,132.8 C 391.3,133.5 395.0,132.6 396.1,133.3 C 397.1,134.0 394.3,135.8 395.2,136.9 C 396.2,138.1 400.4,139.9 401.7,140.1 C 403.0,140.2 402.7,137.8 403.0,137.8 C 403.4,137.7 403.4,139.7 403.8,139.7 C 404.2,139.6 405.2,137.4 405.6,137.5 C 406.1,137.5 405.8,139.9 406.7,140.0 C 407.6,140.2 409.8,138.2 410.8,138.4 C 411.8,138.6 412.0,140.8 412.9,141.1 C 413.7,141.4 415.2,139.9 415.7,140.2 C 416.3,140.4 415.8,142.6 416.0,142.7 C 416.3,142.7 416.8,140.5 417.1,140.5 C 417.4,140.6 417.1,142.9 417.6,143.1 C 418.1,143.2 419.7,141.1 420.1,141.3 C 420.4,141.5 419.1,144.0 419.6,144.2 C 420.0,144.3 422.4,142.1 422.9,142.4 C 423.5,142.6 422.4,145.4 422.9,145.5 C 423.4,145.6 425.6,142.5 425.9,142.8 C 426.3,143.1 424.7,146.8 425.0,147.1 C 425.3,147.5 427.4,143.5 427.7,144.8 C 428.0,146.1 427.2,152.9 426.6,154.8 C 426.1,156.7 424.4,155.7 424.3,156.1 C 424.2,156.5 425.8,156.1 425.9,157.1 C 426.0,158.1 425.5,161.0 425.0,162.1 C 424.5,163.1 423.2,162.3 422.9,163.3 C 422.6,164.2 423.6,166.5 423.0,167.6 C 422.5,168.8 420.1,169.4 419.7,170.2 C 419.4,170.9 421.9,169.4 420.9,172.4 C 420.0,175.3 416.3,183.5 414.0,187.8 C 411.6,192.1 410.6,194.6 406.9,198.3 C 403.1,202.1 392.6,207.7 391.4,210.3 C 390.2,213.0 398.7,213.1 399.8,214.2 C 400.8,215.2 397.9,215.5 397.7,216.4 C 397.5,217.3 399.3,217.1 398.5,219.3 C 397.7,221.6 394.8,227.7 392.6,230.2 C 390.4,232.7 386.4,232.7 385.3,234.2 C 384.1,235.6 386.0,237.3 385.6,238.8 C 385.2,240.4 382.8,242.1 382.9,243.6 C 383.0,245.0 385.7,245.9 386.1,247.5 C 386.5,249.1 387.3,249.3 385.3,253.1 C 383.3,256.8 376.3,265.7 374.1,269.9 C 371.8,274.1 386.7,278.0 371.5,278.3 C 356.4,278.6 298.8,274.0 283.1,271.7 C 267.3,269.4 279.0,266.0 277.1,264.4 C 275.2,262.7 272.8,263.7 271.8,261.9 C 270.8,260.1 273.1,258.5 271.1,253.6 C 269.2,248.8 257.4,247.4 260.0,232.8 C 262.7,218.2 281.7,178.2 287.1,166.1 C 292.4,154.0 292.5,160.7 292.1,160.2 C 291.6,159.7 286.6,163.7 284.2,162.9 C 281.8,162.1 280.5,157.5 277.6,155.4 C 274.7,153.4 268.8,152.1 266.8,150.6 C 264.9,149.0 266.5,146.6 266.1,146.1 C 265.6,145.7 265.0,148.2 264.1,148.0 C 263.2,147.8 262.1,147.2 260.5,144.9 C 258.9,142.7 255.6,140.3 254.5,134.6 C 253.5,128.9 253.3,114.9 254.2,110.8 C 255.0,106.7 258.7,110.8 259.6,110.2 C 260.5,109.6 259.0,108.1 259.4,107.3 C 259.8,106.4 260.8,105.3 261.9,105.2 C 263.1,105.1 265.5,106.8 266.3,106.7 C 267.0,106.5 265.4,104.8 266.4,104.3 C 267.5,103.8 270.8,104.6 272.4,103.8 C 273.9,102.9 272.1,99.6 275.7,99.2 C 279.2,98.8 290.4,101.7 293.6,101.6 C 296.8,101.5 295.0,99.6 294.7,98.5 C 294.3,97.4 291.7,96.3 291.5,95.1 C 291.3,93.9 292.0,91.5 293.7,91.2 C 295.4,90.8 299.4,93.0 301.7,92.8 C 304.0,92.7 306.1,88.7 307.5,90.3 Z"},
  {d:"M 547.4,220.6 C 548.7,220.5 548.9,220.8 548.4,222.5 C 547.8,224.2 544.1,229.2 543.9,230.9 C 543.8,232.6 545.9,232.6 547.3,232.6 C 548.8,232.7 551.6,230.8 552.7,231.2 C 553.9,231.6 553.6,234.8 554.3,235.0 C 555.0,235.2 556.8,233.7 557.2,232.4 C 557.6,231.1 556.6,228.3 556.8,227.0 C 557.1,225.7 557.4,224.5 558.7,224.6 C 559.9,224.7 561.1,227.1 564.3,227.6 C 567.5,228.0 575.3,224.8 577.9,227.5 C 580.5,230.2 580.2,241.3 579.9,243.6 C 579.7,245.9 578.0,241.5 576.5,241.3 C 575.0,241.0 572.2,241.4 571.1,242.0 C 570.1,242.7 572.5,244.3 570.3,245.2 C 568.2,246.1 561.6,246.0 558.3,247.6 C 555.0,249.3 552.3,254.6 550.6,255.0 C 548.9,255.4 548.7,250.6 547.9,249.8 C 547.1,249.0 545.2,251.3 545.7,250.1 C 546.1,248.8 550.4,244.4 550.7,242.6 C 551.0,240.8 549.8,238.6 547.3,239.4 C 544.9,240.3 538.3,246.5 535.9,247.9 C 533.5,249.3 533.7,248.2 533.1,247.9 C 532.4,247.5 532.8,245.7 532.1,245.5 C 531.4,245.3 529.7,246.9 528.9,246.7 C 528.1,246.5 527.1,245.7 527.2,244.5 C 527.4,243.3 529.8,241.4 529.7,239.7 C 529.6,238.1 526.8,236.8 526.6,234.5 C 526.5,232.2 527.4,227.1 528.8,226.1 C 530.3,225.0 533.4,228.6 535.4,228.1 C 537.3,227.6 538.5,224.3 540.4,223.0 C 542.4,221.8 546.0,220.7 547.4,220.6 Z"},
  {d:"M 502.8,240.1 C 505.1,239.8 510.8,239.1 514.0,240.5 C 517.2,241.8 520.0,247.6 522.2,248.3 C 524.4,249.0 525.0,244.8 527.3,244.7 C 529.6,244.6 532.6,248.7 535.9,247.9 C 539.3,247.0 544.9,240.3 547.3,239.4 C 549.8,238.6 551.0,240.8 550.7,242.6 C 550.4,244.4 546.1,248.8 545.7,250.1 C 545.2,251.3 547.1,249.0 547.9,249.8 C 548.7,250.6 548.9,255.4 550.6,255.0 C 552.3,254.6 555.0,249.3 558.3,247.6 C 561.6,246.0 568.3,246.1 570.3,245.2 C 572.4,244.3 570.1,242.9 570.7,242.2 C 571.4,241.5 572.7,240.7 574.2,241.0 C 575.7,241.2 578.9,242.3 579.8,243.6 C 580.8,245.0 580.7,245.7 580.0,249.2 C 579.3,252.6 577.9,261.9 575.5,264.2 C 573.1,266.6 568.7,262.3 565.4,263.3 C 562.2,264.4 558.3,269.6 556.1,270.7 C 553.9,271.7 553.1,269.5 552.2,269.6 C 551.4,269.7 553.1,272.4 551.1,271.3 C 549.1,270.3 543.1,263.5 540.2,263.4 C 537.3,263.2 535.4,270.6 533.7,270.5 C 532.1,270.5 531.4,264.1 530.5,263.3 C 529.6,262.4 530.3,266.2 528.3,265.4 C 526.2,264.6 521.0,258.9 518.2,258.5 C 515.4,258.1 512.6,261.7 511.3,263.0 C 510.1,264.3 511.3,265.7 510.5,266.3 C 509.6,266.9 507.3,265.7 506.4,266.5 C 505.5,267.3 506.2,270.3 505.1,271.3 C 503.9,272.2 500.1,273.0 499.4,272.4 C 498.7,271.9 501.6,269.8 500.9,268.0 C 500.1,266.1 496.2,262.1 494.8,261.1 C 493.4,260.0 493.1,261.5 492.6,261.6 C 492.0,261.6 490.0,262.6 491.5,261.1 C 493.1,259.6 500.4,255.7 501.9,252.5 C 503.4,249.4 500.2,244.3 500.4,242.2 C 500.5,240.2 500.5,240.4 502.8,240.1 Z"},
  {d:"M 486.2,171.8 C 488.3,170.7 492.1,173.4 492.9,174.9 C 493.6,176.3 490.6,177.7 490.6,180.3 C 490.6,182.9 492.1,188.4 492.9,190.4 C 493.6,192.5 495.1,190.4 495.1,192.5 C 495.2,194.6 492.6,200.5 493.0,203.1 C 493.4,205.6 496.2,203.3 497.4,207.8 C 498.5,212.3 498.7,226.0 500.0,230.1 C 501.2,234.1 504.5,230.4 504.9,232.3 C 505.3,234.2 503.3,239.5 502.5,241.2 C 501.7,242.9 500.2,241.4 500.2,242.6 C 500.2,243.7 502.3,246.3 502.6,248.0 C 502.8,249.6 504.8,249.0 501.9,252.5 C 499.0,256.0 488.9,266.2 485.0,269.2 C 481.1,272.2 480.7,269.4 478.6,270.3 C 476.5,271.3 475.1,275.0 472.5,274.9 C 469.8,274.8 465.2,269.7 462.7,269.6 C 460.3,269.4 458.2,272.0 457.8,273.8 C 457.4,275.7 461.0,278.0 460.3,280.7 C 459.7,283.5 456.1,288.7 454.0,290.3 C 451.9,291.9 449.8,289.4 447.9,290.2 C 446.1,290.9 444.7,294.2 443.2,294.7 C 441.7,295.2 440.3,295.2 438.9,293.1 C 437.4,291.1 435.9,284.0 434.3,282.4 C 432.7,280.9 429.8,285.6 429.3,284.0 C 428.9,282.4 431.7,276.1 431.6,272.8 C 431.5,269.6 428.1,268.9 428.8,264.4 C 429.5,260.0 432.7,250.0 435.7,246.2 C 438.6,242.3 443.2,243.7 446.5,241.3 C 449.7,238.9 452.8,233.5 455.0,231.8 C 457.2,230.0 458.2,230.5 459.6,230.7 C 461.1,230.9 461.8,233.0 463.6,232.9 C 465.4,232.9 469.1,231.6 470.4,230.3 C 471.7,229.0 472.0,226.8 471.6,225.3 C 471.3,223.7 468.9,222.8 468.3,221.0 C 467.7,219.2 467.3,216.8 468.0,214.6 C 468.6,212.4 471.8,211.3 472.0,207.8 C 472.3,204.3 468.8,197.8 469.4,193.4 C 470.1,189.1 474.2,183.7 476.0,181.7 C 477.8,179.7 478.4,183.0 480.1,181.4 C 481.8,179.7 484.1,172.9 486.2,171.8 Z"},
  {d:"M 485.2,443.9 C 486.2,444.3 484.7,447.7 486.6,449.0 C 488.6,450.3 495.5,450.7 496.9,451.7 C 498.4,452.7 495.4,453.3 495.4,455.0 C 495.3,456.7 498.7,459.2 496.7,461.7 C 494.7,464.3 485.3,468.5 483.2,470.4 C 481.2,472.4 484.8,472.5 484.7,473.6 C 484.6,474.8 485.3,476.7 482.7,477.3 C 480.0,477.9 471.0,477.9 468.6,477.1 C 466.2,476.3 468.7,472.9 468.1,472.5 C 467.6,472.0 465.6,473.5 465.4,474.3 C 465.2,475.1 467.0,476.8 466.7,477.2 C 466.5,477.6 464.1,476.9 463.8,477.0 C 463.6,477.0 465.6,477.3 465.3,477.5 C 465.0,477.8 463.4,478.3 461.8,478.5 C 460.2,478.7 456.7,479.0 455.9,478.9 C 455.1,478.7 456.5,477.8 457.0,477.6 C 457.4,477.5 457.9,478.2 458.6,478.3 C 459.2,478.3 460.5,477.8 461.0,477.8 C 461.5,477.8 461.5,478.3 461.6,478.3 C 461.7,478.4 462.4,478.5 461.8,478.1 C 461.1,477.7 459.2,475.8 457.7,475.9 C 456.2,475.9 453.7,478.2 452.6,478.2 C 451.4,478.3 451.9,476.1 450.9,476.2 C 449.9,476.2 446.9,477.5 446.4,478.6 C 445.9,479.7 448.3,482.4 447.8,482.8 C 447.4,483.2 444.4,482.1 443.9,481.1 C 443.5,480.2 443.4,478.5 445.0,477.1 C 446.7,475.6 453.2,473.4 453.6,472.5 C 453.9,471.5 448.6,472.2 447.2,471.4 C 445.7,470.7 442.9,469.5 444.9,468.2 C 446.8,466.8 455.0,463.9 458.9,463.2 C 462.8,462.4 464.9,464.5 468.3,463.6 C 471.7,462.7 477.6,459.1 479.2,457.9 C 480.8,456.7 477.6,458.3 477.8,456.5 C 478.1,454.6 479.6,448.8 480.8,446.7 C 482.0,444.6 484.2,443.5 485.2,443.9 Z"},
  {d:"M 578.0,227.6 C 576.9,230.9 567.5,228.1 564.3,227.6 C 561.1,227.1 559.9,224.7 558.7,224.6 C 557.4,224.5 557.1,225.7 556.8,227.0 C 556.6,228.3 557.6,231.1 557.2,232.4 C 556.8,233.7 555.0,235.2 554.3,235.0 C 553.6,234.8 553.9,231.6 552.7,231.2 C 551.6,230.8 548.8,232.7 547.3,232.6 C 545.9,232.6 543.8,232.9 543.9,230.9 C 544.1,228.9 548.7,222.2 548.1,220.9 C 547.6,219.6 542.6,221.8 540.4,223.0 C 538.3,224.2 537.3,227.8 535.4,228.1 C 533.5,228.4 529.2,226.4 529.1,224.9 C 529.0,223.5 532.6,222.9 534.7,219.4 C 536.9,215.9 539.8,206.7 541.8,203.9 C 543.9,201.1 544.9,202.1 547.1,202.5 C 549.2,202.9 550.7,205.6 554.7,206.4 C 558.6,207.3 567.1,203.9 571.0,207.4 C 574.8,211.0 579.1,224.2 578.0,227.6 Z"},
  {d:"M 200.5,250.1 C 203.8,252.2 208.3,260.3 210.5,262.5 C 212.7,264.8 212.5,263.9 213.5,263.7 C 214.4,263.4 215.1,260.7 216.1,260.8 C 217.0,260.9 219.2,262.8 219.4,264.3 C 219.6,265.8 217.2,267.8 217.1,269.6 C 217.1,271.4 219.1,270.7 219.3,275.1 C 219.4,279.4 214.9,291.8 218.3,295.6 C 221.6,299.4 235.9,296.6 239.6,297.7 C 243.2,298.7 240.6,300.6 240.3,301.8 C 240.0,303.0 238.1,303.6 237.7,304.8 C 237.3,305.9 237.0,306.6 237.8,308.5 C 238.5,310.4 242.2,314.1 242.3,316.1 C 242.4,318.0 239.7,317.4 238.3,320.3 C 236.9,323.1 235.4,330.2 234.0,332.9 C 232.6,335.7 231.1,336.5 229.6,336.5 C 228.2,336.6 228.1,333.8 225.5,333.4 C 223.0,333.1 216.9,335.3 214.3,334.4 C 211.7,333.4 212.0,329.1 209.9,327.8 C 207.8,326.4 203.9,327.5 201.6,326.2 C 199.4,324.9 200.2,321.7 196.5,320.2 C 192.8,318.8 182.5,318.6 179.5,317.6 C 176.4,316.6 179.6,315.4 178.2,314.3 C 176.8,313.2 172.5,312.2 171.2,310.9 C 169.9,309.6 170.9,307.3 170.4,306.5 C 169.9,305.8 168.7,307.9 168.1,306.5 C 167.4,305.1 166.6,299.9 166.7,298.0 C 166.7,296.2 168.3,297.3 168.2,295.6 C 168.0,293.9 165.9,289.9 165.8,288.0 C 165.7,286.0 167.5,285.9 167.7,284.0 C 167.8,282.1 167.3,277.3 166.7,276.3 C 166.0,275.4 164.9,278.3 164.0,278.3 C 163.1,278.4 163.1,276.5 161.2,276.7 C 159.2,276.8 154.6,279.0 152.3,279.2 C 149.9,279.4 147.1,279.1 147.1,277.9 C 147.2,276.6 150.6,272.7 152.5,271.7 C 154.4,270.7 157.1,271.3 158.5,271.8 C 159.8,272.2 159.2,274.8 160.9,274.4 C 162.5,274.0 166.7,269.8 168.2,269.4 C 169.8,269.1 169.3,272.8 170.3,272.1 C 171.2,271.4 171.6,266.7 173.8,265.5 C 175.9,264.3 181.2,266.5 183.2,264.8 C 185.2,263.2 185.1,257.0 185.9,255.4 C 186.7,253.9 187.3,256.3 188.1,255.4 C 188.8,254.5 188.2,250.8 190.2,250.0 C 192.3,249.1 197.1,248.0 200.5,250.1 Z"},
  {d:"M 254.2,110.8 C 256.1,114.8 256.8,123.0 254.2,125.4 C 251.6,127.8 242.1,123.5 238.7,125.4 C 235.3,127.4 234.4,134.6 233.8,137.1 C 233.2,139.6 235.7,139.4 235.1,140.4 C 234.4,141.3 231.6,143.4 230.2,142.9 C 228.8,142.5 228.0,138.8 226.8,137.8 C 225.5,136.8 224.3,136.0 222.8,137.0 C 221.3,137.9 218.7,141.3 217.8,143.6 C 216.9,145.8 217.1,148.9 217.3,150.5 C 217.6,152.1 219.9,153.3 219.3,153.3 C 218.7,153.3 215.9,152.6 213.6,150.5 C 211.2,148.4 206.2,142.8 205.3,140.9 C 204.4,139.0 207.4,140.3 208.2,139.3 C 208.9,138.2 210.2,137.3 209.6,134.4 C 209.1,131.5 205.6,125.3 205.0,121.7 C 204.3,118.1 206.4,115.7 205.8,113.0 C 205.2,110.2 201.8,107.5 201.3,105.3 C 200.8,103.2 203.9,101.6 202.6,100.1 C 201.4,98.6 195.4,97.4 193.8,96.2 C 192.2,94.9 194.7,93.3 193.1,92.5 C 191.6,91.8 185.7,92.4 184.4,91.6 C 183.0,90.8 185.6,89.1 185.2,87.5 C 184.8,86.0 182.4,84.3 181.9,82.3 C 181.5,80.3 183.9,78.4 182.6,75.5 C 181.3,72.7 174.8,66.3 174.0,65.0 C 173.2,63.6 176.0,67.0 177.5,67.3 C 179.0,67.7 181.5,66.4 182.9,67.0 C 184.2,67.6 184.5,70.6 185.6,70.9 C 186.7,71.2 188.4,68.5 189.5,68.6 C 190.5,68.7 191.4,71.2 191.9,71.3 C 192.5,71.4 192.2,69.5 192.8,69.2 C 193.5,68.9 194.8,68.7 195.9,69.6 C 196.9,70.6 198.1,74.1 199.2,74.8 C 200.2,75.5 201.6,74.9 202.1,73.8 C 202.6,72.8 201.6,69.3 202.0,68.4 C 202.4,67.5 204.0,69.0 204.7,68.6 C 205.3,68.2 204.5,66.4 205.9,66.2 C 207.3,66.0 210.5,68.2 213.1,67.3 C 215.7,66.4 219.2,61.8 221.3,60.8 C 223.5,59.7 224.1,62.0 225.8,61.0 C 227.4,60.1 230.6,56.6 231.2,54.9 C 231.8,53.1 228.4,51.2 229.5,50.4 C 230.5,49.6 235.8,49.4 237.4,50.0 C 239.1,50.6 239.4,52.3 239.4,54.2 C 239.3,56.1 236.3,59.7 237.0,61.2 C 237.8,62.7 242.7,62.4 243.7,63.2 C 244.7,64.1 242.6,65.0 243.0,66.1 C 243.3,67.2 246.1,68.2 245.8,69.7 C 245.5,71.3 242.1,72.6 241.1,75.3 C 240.0,78.0 239.5,82.7 239.4,85.8 C 239.3,88.9 240.0,92.1 240.6,93.6 C 241.2,95.2 242.7,93.7 243.0,95.0 C 243.3,96.2 240.7,98.6 242.6,101.3 C 244.5,103.9 252.3,106.8 254.2,110.8 Z"},
  {d:"M 378.5,573.0 C 377.1,577.7 369.5,592.9 364.1,600.1 C 358.8,607.3 349.3,614.2 346.5,616.3 C 343.7,618.3 347.4,613.6 347.3,612.6 C 347.2,611.6 345.6,610.5 346.0,610.4 C 346.4,610.2 347.6,612.3 349.5,611.5 C 351.4,610.7 355.9,607.7 357.5,605.6 C 359.0,603.6 357.5,601.2 358.8,599.3 C 360.1,597.5 364.1,596.3 365.1,594.5 C 366.1,592.7 364.6,589.2 364.9,588.6 C 365.1,587.9 366.5,590.9 366.8,590.5 C 367.1,590.1 367.3,586.3 366.5,586.2 C 365.7,586.1 363.6,590.3 362.0,589.8 C 360.4,589.3 357.9,583.6 357.0,583.2 C 356.2,582.9 356.6,586.9 357.1,587.8 C 357.5,588.8 359.8,588.1 359.8,588.8 C 359.7,589.4 357.4,590.6 357.0,591.7 C 356.6,592.8 357.4,595.3 357.2,595.5 C 357.1,595.7 356.5,592.1 356.1,592.8 C 355.8,593.5 356.4,598.0 355.1,599.7 C 353.8,601.4 349.8,601.7 348.4,603.2 C 347.1,604.7 347.8,607.8 347.1,608.8 C 346.4,609.9 344.9,609.3 344.4,609.7 C 344.0,610.2 343.9,611.2 344.1,611.6 C 344.3,612.0 345.4,612.2 345.7,612.3 C 346.0,612.5 345.9,612.6 346.0,612.6 C 346.0,612.7 346.1,612.9 346.0,612.8 C 345.9,612.8 345.7,612.4 345.5,612.4 C 345.2,612.4 344.8,612.6 344.5,612.9 C 344.3,613.2 343.9,614.3 344.1,614.3 C 344.3,614.3 345.4,612.5 345.8,612.9 C 346.1,613.2 346.8,615.3 346.4,616.3 C 346.0,617.3 344.6,616.6 343.4,619.0 C 342.1,621.3 341.4,626.9 339.0,630.4 C 336.5,633.9 330.6,638.7 328.6,640.0 C 326.6,641.3 326.8,640.0 326.7,638.4 C 326.6,636.9 327.6,632.1 328.2,630.7 C 328.8,629.4 329.8,631.2 330.4,630.3 C 331.1,629.4 331.1,626.1 332.3,625.5 C 333.4,624.9 336.1,627.2 337.3,626.5 C 338.6,625.9 339.3,623.3 339.6,621.5 C 339.9,619.7 340.2,615.3 339.1,615.7 C 338.0,616.0 334.6,622.3 332.8,623.5 C 331.1,624.6 330.2,623.8 328.7,622.4 C 327.2,620.9 326.6,617.5 323.9,614.7 C 321.2,611.8 315.9,607.3 312.5,605.3 C 309.1,603.2 305.9,603.9 303.7,602.3 C 301.4,600.7 300.8,596.3 299.1,595.8 C 297.3,595.4 294.2,599.7 293.2,599.6 C 292.2,599.5 294.9,597.6 293.1,595.1 C 291.3,592.7 284.8,586.6 282.5,584.8 C 280.1,583.1 279.8,584.1 278.9,584.6 C 278.0,585.0 278.2,587.4 276.9,587.6 C 275.6,587.9 269.3,589.2 271.1,586.2 C 272.9,583.1 283.7,573.9 287.7,569.3 C 291.7,564.6 293.4,560.1 295.0,558.5 C 296.7,556.8 297.2,559.7 297.5,559.4 C 297.7,559.1 295.0,558.1 296.5,556.7 C 297.9,555.2 304.3,552.6 306.4,550.8 C 308.6,549.1 307.7,547.0 309.4,545.9 C 311.1,544.9 314.5,545.7 316.6,544.6 C 318.7,543.6 320.7,540.3 322.1,539.8 C 323.6,539.2 324.1,541.3 325.3,541.2 C 326.4,541.1 328.2,539.2 328.9,539.2 C 329.7,539.2 329.0,541.2 329.8,541.2 C 330.5,541.1 332.8,539.1 333.6,539.1 C 334.3,539.1 332.3,540.7 334.3,541.2 C 336.2,541.7 341.0,540.4 345.3,542.0 C 349.5,543.5 356.4,547.6 359.9,550.4 C 363.3,553.3 363.1,557.3 366.1,558.9 C 369.1,560.5 375.7,559.4 377.8,559.9 C 379.9,560.5 379.1,561.8 378.7,562.4 C 378.3,563.1 376.1,562.8 375.4,564.0 C 374.8,565.2 375.6,568.6 375.1,569.9 C 374.5,571.2 371.6,571.4 372.2,571.9 C 372.8,572.4 379.8,568.3 378.5,573.0 Z"},
  {d:"M 393.1,522.3 C 394.6,522.9 395.1,524.2 395.0,526.0 C 394.8,527.8 392.6,530.9 392.3,533.1 C 392.1,535.4 393.0,538.6 393.5,539.7 C 394.0,540.9 395.3,539.3 395.3,540.1 C 395.3,540.8 393.2,543.6 393.4,544.4 C 393.6,545.1 397.1,541.9 396.8,544.6 C 396.4,547.4 394.4,556.4 391.4,561.1 C 388.3,565.9 381.7,571.2 378.5,573.0 C 375.3,574.8 372.8,572.4 372.2,571.9 C 371.6,571.4 374.5,571.2 375.1,569.9 C 375.6,568.6 374.8,565.2 375.4,564.0 C 376.1,562.8 378.3,563.1 378.7,562.4 C 379.1,561.8 379.9,560.5 377.8,559.9 C 375.7,559.4 369.1,560.5 366.1,558.9 C 363.1,557.3 363.3,553.3 359.9,550.4 C 356.4,547.6 349.5,543.5 345.3,542.0 C 341.0,540.4 336.2,541.7 334.3,541.2 C 332.3,540.7 334.3,539.1 333.6,539.1 C 332.8,539.1 330.5,541.1 329.8,541.2 C 329.0,541.2 330.1,539.3 328.9,539.2 C 327.7,539.1 323.4,540.8 322.7,540.4 C 322.0,540.0 324.5,539.3 324.9,537.0 C 325.3,534.7 320.4,527.5 325.3,526.6 C 330.2,525.7 349.2,530.4 354.3,531.6 C 359.3,532.8 354.9,533.5 355.5,533.6 C 356.1,533.7 357.5,533.0 357.9,532.0 C 358.3,531.1 356.6,528.6 357.7,527.6 C 358.9,526.7 363.3,527.2 364.8,526.4 C 366.4,525.6 365.9,523.1 366.8,522.8 C 367.7,522.5 368.8,524.8 370.2,524.8 C 371.6,524.8 373.6,522.6 375.4,522.9 C 377.1,523.1 378.9,526.3 380.6,526.3 C 382.3,526.3 383.7,523.4 385.7,522.8 C 387.8,522.1 391.5,521.8 393.1,522.3 Z"},
  {d:"M 558.7,288.2 C 559.0,290.2 554.6,289.5 552.5,291.9 C 550.4,294.3 548.2,300.6 546.0,302.5 C 543.9,304.5 541.6,305.2 539.5,303.6 C 537.4,302.0 533.6,295.2 533.6,293.1 C 533.6,291.0 538.6,292.1 539.5,291.1 C 540.4,290.1 538.7,288.1 538.9,287.2 C 539.0,286.3 541.0,287.9 540.5,285.7 C 540.1,283.5 534.7,275.1 536.4,274.2 C 538.1,273.3 546.9,278.0 550.6,280.3 C 554.3,282.6 558.4,286.3 558.7,288.2 Z"},
  {d:"M 396.8,207.6 C 398.8,207.4 401.2,208.0 403.2,209.0 C 405.2,210.0 407.5,211.0 408.6,213.6 C 409.8,216.1 410.2,220.6 410.1,224.2 C 410.0,227.8 408.9,232.6 408.0,234.9 C 407.2,237.2 404.9,237.3 405.0,238.2 C 405.1,239.0 408.2,239.5 408.6,240.1 C 409.0,240.7 406.2,240.1 407.2,241.9 C 408.2,243.8 412.4,250.1 414.6,251.2 C 416.8,252.4 419.1,249.0 420.4,248.9 C 421.7,248.8 422.0,249.7 422.2,250.6 C 422.5,251.5 422.6,253.5 421.8,254.5 C 421.1,255.5 419.0,254.5 417.8,256.5 C 416.5,258.5 413.7,263.8 414.2,266.5 C 414.8,269.3 420.2,271.2 421.1,272.9 C 422.1,274.6 419.5,274.9 420.0,276.6 C 420.4,278.4 421.8,281.9 423.7,283.2 C 425.6,284.6 430.0,284.7 431.5,284.7 C 433.0,284.7 434.6,280.6 432.8,283.2 C 430.9,285.8 422.1,296.8 420.4,300.2 C 418.6,303.6 421.0,302.8 422.2,303.6 C 423.4,304.5 427.1,304.9 427.5,305.2 C 427.9,305.5 425.1,304.7 424.5,305.3 C 423.8,305.9 423.3,308.3 423.6,308.9 C 423.9,309.6 426.4,309.0 426.4,309.4 C 426.3,309.8 423.7,310.4 423.3,311.5 C 422.9,312.7 423.4,314.9 423.9,316.0 C 424.5,317.2 426.5,316.7 426.6,318.2 C 426.7,319.8 424.5,324.2 424.6,325.3 C 424.7,326.4 427.3,324.7 427.2,324.8 C 427.0,324.9 424.5,326.2 423.8,325.9 C 423.1,325.7 423.3,323.4 423.0,323.4 C 422.8,323.3 424.8,324.4 422.5,325.6 C 420.3,326.8 412.1,330.1 409.4,330.4 C 406.7,330.8 407.2,327.2 406.6,327.6 C 406.0,328.1 406.4,332.6 406.0,333.1 C 405.6,333.7 405.1,331.2 404.0,330.8 C 402.9,330.4 400.1,331.1 399.4,330.7 C 398.7,330.3 400.3,328.4 399.7,328.4 C 399.0,328.3 396.5,330.5 395.7,330.5 C 394.8,330.4 395.1,327.9 394.8,328.0 C 394.4,328.1 393.9,331.0 393.7,330.9 C 393.5,330.7 394.1,328.3 393.5,327.0 C 392.9,325.7 390.9,323.4 390.0,323.1 C 389.2,322.9 389.0,325.5 388.4,325.4 C 387.8,325.4 387.1,323.1 386.5,322.9 C 385.9,322.7 385.5,323.1 384.9,324.3 C 384.3,325.5 385.5,330.3 383.1,330.2 C 380.7,330.1 372.4,325.9 370.6,323.6 C 368.9,321.4 373.1,316.9 372.6,316.9 C 372.1,317.0 368.9,323.4 367.7,324.0 C 366.4,324.5 365.2,325.8 365.0,320.2 C 364.8,314.7 364.9,299.0 366.4,290.7 C 367.9,282.3 371.1,275.7 374.1,269.9 C 377.1,264.1 382.4,259.7 384.4,255.9 C 386.4,252.2 386.3,249.6 386.1,247.5 C 385.9,245.4 383.0,245.0 382.9,243.6 C 382.8,242.1 385.2,240.4 385.6,238.8 C 386.0,237.3 383.5,236.3 385.3,234.2 C 387.1,232.0 394.4,228.8 396.5,225.8 C 398.5,222.9 397.1,218.3 397.7,216.4 C 398.2,214.5 400.0,215.3 399.8,214.4 C 399.6,213.5 397.9,211.7 396.5,211.0 C 395.1,210.4 391.3,210.9 391.4,210.4 C 391.5,209.8 394.9,207.9 396.8,207.6 Z"},
  {d:"M 401.3,510.9 C 400.4,512.9 396.2,520.4 393.6,522.4 C 391.0,524.3 387.9,522.1 385.7,522.7 C 383.6,523.4 382.3,526.3 380.6,526.3 C 378.9,526.3 377.1,523.1 375.4,522.9 C 373.6,522.6 371.6,524.8 370.2,524.8 C 368.8,524.8 367.7,522.5 366.8,522.8 C 366.0,523.0 366.4,525.6 364.8,526.4 C 363.3,527.2 358.9,526.7 357.7,527.6 C 356.6,528.6 358.3,531.1 357.9,532.0 C 357.5,533.0 357.6,534.0 355.5,533.6 C 353.3,533.1 349.8,530.5 345.0,529.5 C 340.2,528.4 330.2,528.4 326.5,527.2 C 322.8,526.0 323.4,524.0 322.7,522.3 C 321.9,520.6 322.5,517.9 321.9,517.0 C 321.3,516.1 319.6,517.3 319.1,517.0 C 318.6,516.6 319.7,514.9 319.0,515.1 C 318.2,515.3 315.7,518.2 314.6,518.1 C 313.4,518.0 311.7,517.8 312.1,514.5 C 312.4,511.1 316.3,501.3 316.9,498.0 C 317.6,494.7 315.5,495.5 315.8,494.5 C 316.2,493.4 318.3,493.4 319.1,491.7 C 319.9,490.0 319.9,485.8 320.7,484.3 C 321.5,482.7 323.1,483.7 323.9,482.4 C 324.8,481.2 324.0,478.5 325.8,476.6 C 327.5,474.7 331.2,471.5 334.3,470.9 C 337.5,470.2 342.5,472.6 344.5,472.4 C 346.4,472.3 343.9,470.1 346.0,470.0 C 348.2,470.0 354.3,471.2 357.4,472.3 C 360.5,473.4 361.7,476.2 364.6,476.8 C 367.5,477.4 372.5,475.4 374.9,475.9 C 377.3,476.4 378.1,477.5 378.9,479.8 C 379.7,482.2 378.8,487.3 379.8,490.2 C 380.9,493.2 384.7,495.6 385.4,497.7 C 386.1,499.7 382.6,501.8 384.0,502.7 C 385.4,503.5 392.1,501.7 393.8,502.6 C 395.4,503.6 393.0,507.6 393.7,508.4 C 394.5,509.2 397.4,506.9 398.3,507.3 C 399.2,507.7 398.6,510.1 399.1,510.7 C 399.6,511.3 402.2,509.0 401.3,510.9 Z"},
  {d:"M 368.2,428.6 C 372.9,427.6 381.8,430.1 384.6,431.4 C 387.3,432.7 384.2,435.7 384.8,436.2 C 385.4,436.7 387.3,434.0 388.1,434.4 C 388.9,434.8 389.1,438.6 389.5,438.6 C 389.9,438.7 387.2,435.6 390.5,434.4 C 393.7,433.2 404.9,430.2 408.8,431.4 C 412.7,432.6 413.3,439.4 413.9,441.7 C 414.4,444.0 411.7,443.4 411.9,445.4 C 412.1,447.3 413.4,452.0 415.0,453.5 C 416.7,455.0 421.2,452.0 421.8,454.2 C 422.5,456.4 418.7,464.2 418.9,466.9 C 419.1,469.6 422.4,468.9 423.2,470.4 C 424.0,471.9 422.5,475.0 423.9,475.8 C 425.3,476.6 430.1,476.0 431.5,475.2 C 433.0,474.4 431.6,471.5 432.5,471.0 C 433.4,470.4 434.8,472.5 436.8,472.1 C 438.9,471.7 443.1,468.5 444.8,468.3 C 446.5,468.2 445.6,470.7 447.1,471.4 C 448.6,472.1 453.9,471.5 453.6,472.5 C 453.2,473.4 446.7,475.7 445.0,477.1 C 443.4,478.5 443.6,479.8 443.7,480.8 C 443.9,481.8 447.1,481.9 445.9,483.0 C 444.8,484.0 438.3,485.6 436.7,486.8 C 435.1,488.0 437.7,489.5 436.5,489.9 C 435.3,490.3 432.9,488.0 429.7,489.0 C 426.6,489.9 422.5,491.7 417.6,495.6 C 412.6,499.5 403.0,509.7 400.3,512.3 C 397.6,514.8 401.5,511.2 401.3,510.9 C 401.1,510.7 399.6,511.3 399.1,510.7 C 398.6,510.1 399.2,507.7 398.3,507.3 C 397.4,506.9 394.5,509.2 393.7,508.4 C 393.0,507.6 395.4,503.6 393.8,502.6 C 392.1,501.7 385.4,503.5 384.0,502.7 C 382.6,501.8 386.1,499.7 385.4,497.7 C 384.7,495.6 380.9,493.2 379.8,490.2 C 378.8,487.3 379.8,482.3 378.9,479.8 C 378.1,477.4 377.1,476.3 374.8,475.8 C 372.4,475.3 367.5,477.4 364.6,476.8 C 361.7,476.2 360.5,473.4 357.4,472.3 C 354.3,471.2 348.2,470.0 346.0,470.0 C 343.9,470.1 346.7,472.2 344.5,472.4 C 342.2,472.7 332.9,473.1 332.5,471.6 C 332.2,470.2 338.4,469.5 342.4,463.8 C 346.4,458.1 352.0,443.3 356.3,437.5 C 360.6,431.6 363.5,429.6 368.2,428.6 Z"}
];

const BR_PINS = {
  'FIOCRUZ': {x: 466.6, y: 475.8, lx: 590, ly: 495, label: 'Rio de Janeiro — FIOCRUZ (sede)', hub: true},
  'UNILA': {x: 313.7, y: 515.2, lx: 150, ly: 585, label: 'Foz do Iguaçu — UNILA', hub: false},
  'UFMS': {x: 312.3, y: 438.0, lx: 100, ly: 420, label: 'Campo Grande — UFMS', hub: false},
  'UFOPA': {x: 311.0, y: 165.7, lx: 311, ly: 25, label: 'Santarém — UFOPA', hub: false},
  'UFPI': {x: 472.0, y: 206.5, lx: 560, ly: 50, label: 'Teresina — UFPI', hub: false},
  'UNIR': {x: 186.5, y: 262.5, lx: 60, ly: 90, label: 'Porto Velho — UNIR', hub: false},
};

const BR_FIOCRUZ_UNITS = [
  {x:239.2, y:176.3, tx:225, ty:100, anchor:'middle', label:'FIOCRUZ AMAZONAS', sub:'e Instituto Leônidas e Maria Deane (ILMD)'},
  {x:133.7, y:280.2, tx:20, ty:320, anchor:'start', label:'COLLABORATIVE LABORATORY', sub:'Fiocruz/Fundhacre/Mérieux Foundation (Acre)'},
  {x:187.8, y:268.6, tx:205, ty:320, anchor:'start', label:'FIOCRUZ RONDÔNIA', sub:''},
  {x:472.0, y:235.0, tx:410, ty:255, anchor:'end', label:'FIOCRUZ PIAUÍ', sub:''},
  {x:530.2, y:185.4, tx:610, ty:145, anchor:'start', label:'FIOCRUZ CEARÁ', sub:''},
  {x:578.9, y:251.2, tx:655, ty:235, anchor:'start', label:'FIOCRUZ PERNAMBUCO', sub:'Instituto Aggeu Magalhães (IAM)'},
  {x:530.2, y:325.6, tx:610, ty:335, anchor:'start', label:'FIOCRUZ BAHIA', sub:'Instituto Gonçalo Muniz (IGM)'},
  {x:403.0, y:368.4, tx:320, ty:358, anchor:'end', label:'GERÊNCIA REGIONAL DE BRASÍLIA', sub:'(GEREB)'},
  {x:457.1, y:430.4, tx:545, ty:415, anchor:'start', label:'FIOCRUZ MINAS GERAIS', sub:'Instituto René Rachou (IRR)'},
  {x:404.3, y:450.1, tx:545, ty:452, anchor:'start', label:'PLATAFORMA DE PESQUISA', sub:'com a USP Ribeirão Preto'},
  {x:330.0, y:460.0, tx:245, ty:495, anchor:'end', label:'FIOCRUZ MATO GROSSO DO SUL', sub:''},
  {x:384.0, y:513.6, tx:330, ty:560, anchor:'end', label:'FIOCRUZ PARANÁ', sub:'Instituto Carlos Chagas (ICC) / IBMP'},
];

function pageQuemSomos() {
  const palette = ['#3d6fa8','#5588c2','#2c5384','#6f9bcf','#274468','#7fabdb'];
  const statesPaths = BR_STATES.map((s,i) => `<path d="${s.d}" fill="${palette[i % palette.length]}" stroke="#f5f8fc" stroke-width="1.3"/>`).join('');
  const pinLines = Object.entries(BR_PINS).map(([k,p]) => `
    <line x1="${p.lx}" y1="${p.ly}" x2="${p.x}" y2="${p.y}" stroke="#7a1f2b" stroke-width="0.9"/>
  `).join('');
  const pinsAndLabels = Object.entries(BR_PINS).map(([k,p]) => `
    <circle cx="${p.x}" cy="${p.y}" r="${p.hub?6:4.5}" fill="${p.hub?'#c0392b':'#ffffff'}" stroke="#7a1f2b" stroke-width="1.6"/>
    <text x="${p.lx}" y="${p.ly-4}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="14.5" fill="#7a1f2b" stroke="#f5f8fc" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${k}</text>
    <line x1="${p.lx-24}" y1="${p.ly+1}" x2="${p.lx+24}" y2="${p.ly+1}" stroke="#7a1f2b" stroke-width="1.4"/>
  `).join('');
  const unitLines = BR_FIOCRUZ_UNITS.map(u => `
    <line x1="${u.tx}" y1="${u.anchor === 'middle' ? u.ty + 13 : u.ty + 2}" x2="${u.x}" y2="${u.y}" stroke="#4a6a85" stroke-width="0.6"/>
  `).join('');
  const fiocruzUnits = BR_FIOCRUZ_UNITS.map(u => `
    <circle cx="${u.x}" cy="${u.y}" r="3" fill="#ffffff" stroke="#1a3d5c" stroke-width="1.2"/>
    <text x="${u.tx}" y="${u.ty}" text-anchor="${u.anchor}" font-family="Inter" font-weight="700" font-size="7.5" fill="#0f2a4a" stroke="#f5f8fc" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">${u.label}</text>
    ${u.sub ? `<text x="${u.tx}" y="${u.ty+9}" text-anchor="${u.anchor}" font-family="Inter" font-weight="500" font-size="6.8" fill="#33566f" stroke="#f5f8fc" stroke-width="2.2" paint-order="stroke" stroke-linejoin="round">${u.sub}</text>` : ''}
  `).join('');

  return `
    <div class="panel" style="line-height:1.75;font-size:13.5px;color:var(--text);">
      <p style="margin-bottom:14px;">A <b>Rede CAPES Global para o Desenvolvimento Sustentável, Ciência e Saúde</b> representa uma iniciativa estratégica para fortalecer a internacionalização da pós-graduação brasileira, ampliar a cooperação científica e promover a produção de conhecimento em áreas prioritárias para o desenvolvimento sustentável, a ciência e a saúde. A proposta também busca reduzir assimetrias regionais, ampliar a inserção internacional das instituições participantes e fomentar pesquisas capazes de subsidiar políticas públicas e soluções inovadoras para desafios nacionais e globais.</p>
      <p style="margin-bottom:14px;">Coordenada pela <b>Fundação Oswaldo Cruz (Fiocruz)</b>, a Rede reúne a Universidade Federal da Integração Latino-Americana (UNILA), a Universidade Federal de Mato Grosso do Sul (UFMS), a Universidade Federal do Oeste do Pará (UFOPA), a Universidade Federal do Piauí (UFPI) e a Universidade Federal de Rondônia (UNIR). A articulação entre instituições de diferentes regiões do país fortalece a excelência acadêmica, amplia as oportunidades de cooperação internacional e contribui para uma agenda científica mais integrada, colaborativa e equitativa.</p>
      <p style="margin-bottom:14px;">A Fiocruz lançou os editais da Rede, que estão estruturados em cinco eixos temáticos: <b>Sistemas de Saúde, Doenças Socialmente Determinadas e Desigualdades</b>; <b>Saúde Global e Emergências em Saúde</b>; <b>Biodiversidade, Ambiente e Mudanças Climáticas</b>; <b>Ciclo de Vida, Transformações Demográficas e Envelhecimento Saudável</b>; e <b>Inovação em Ciência e Tecnologia para a Saúde</b>. Os temas refletem prioridades nacionais e estão alinhados aos Objetivos de Desenvolvimento Sustentável (ODS).</p>
      <p style="margin-bottom:14px;">Os cinco eixos contemplam ações voltadas à formação de recursos humanos, mobilidade acadêmica, desenvolvimento de pesquisas colaborativas, inovação tecnológica e fortalecimento de redes internacionais de pesquisa. As iniciativas abrangem desde o enfrentamento das desigualdades em saúde e das emergências sanitárias até estudos sobre biodiversidade, mudanças climáticas, envelhecimento saudável e desenvolvimento de novas tecnologias para a saúde.</p>
      <p>Com os editais, a Rede CAPES Global consolida um modelo de cooperação científica baseado na integração entre instituições brasileiras e parceiros internacionais, fortalecendo a produção de conhecimento de excelência, a inovação e a formação de pesquisadores, com potencial para gerar impactos duradouros nas políticas públicas, no Sistema Único de Saúde e no desenvolvimento científico e tecnológico do país.</p>
    </div>

    <div class="section-title">A Rede pelo Brasil</div>
    <div class="panel">
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
        <svg viewBox="0 0 780 680" style="flex:1.7;min-width:420px;background:#f5f8fc;border-radius:12px;border:1px solid var(--border);">
          ${statesPaths}
          ${unitLines}
          ${pinLines}
          ${fiocruzUnits}
          ${pinsAndLabels}
        </svg>
        <div style="flex:1;min-width:210px;">
          <table>
            <tr><th>Instituição</th><th>Cidade</th></tr>
            ${Object.entries(BR_PINS).map(([k,p]) => `<tr><td>${p.hub ? k+' (coordenação)' : k}</td><td>${p.label.split(' — ')[0]}</td></tr>`).join('')}
          </table>
          <p style="font-size:11px;color:var(--muted);margin-top:14px;line-height:1.6;">Em bordô, as 6 instituições da Rede CAPES Global. Em azul-marinho, as unidades e institutos regionais da Fiocruz que ampliam a presença da rede pelo país.</p>
        </div>
      </div>
      <div class="qs-duo" style="margin-top:18px;">
        <div class="qs-duo-card">
          <svg class="qs-duo-bg" viewBox="0 0 400 260" preserveAspectRatio="none">
            <g fill="#5588c2" opacity=".35">
              ${[0,1,2,3,4].map(r => [0,1,2,3,4,5].map(c => `<circle cx="${18+c*13}" cy="${16+r*12}" r="1.6" opacity="${(1-(r+c)/10).toFixed(2)}"/>`).join('')).join('')}
            </g>
            <path d="M0,210 C80,180 150,240 240,210 C320,185 370,215 400,200 L400,260 L0,260 Z" fill="#dbeafe" opacity=".55"/>
            <path d="M0,230 C90,205 170,255 260,228 C330,208 375,232 400,222 L400,260 L0,260 Z" fill="#93c5fd" opacity=".45"/>
            <path d="M0,245 C100,228 190,262 290,242 C350,230 380,244 400,238 L400,260 L0,260 Z" fill="#3b82f6" opacity=".35"/>
          </svg>
          <div class="qs-duo-content">
            <div style="font-size:13px;font-weight:600;color:#1c2b3a;letter-spacing:.01em;">ESTRUTURA DESENHADA PARA</div>
            <div style="font-family:'Space Grotesk';font-weight:700;font-size:26px;line-height:1.15;color:#0f2a4a;margin-top:2px;">COMBATER<br><span style="color:#2563a8;">AS ASSIMETRIAS</span><br>REGIONAIS.</div>
            <div style="width:120px;height:3px;background:linear-gradient(90deg,#0f2a4a,#3b82f6);border-radius:2px;margin-top:14px;"></div>
          </div>
        </div>
        <div class="qs-duo-card">
          <svg class="qs-duo-bg" viewBox="0 0 400 260" preserveAspectRatio="none">
            <g fill="#5588c2" opacity=".35">
              ${[0,1,2,3,4].map(r => [0,1,2,3,4,5].map(c => `<circle cx="${382-c*13}" cy="${16+r*12}" r="1.6" opacity="${(1-(r+c)/10).toFixed(2)}"/>`).join('')).join('')}
            </g>
            <path d="M0,215 C80,190 160,245 250,215 C325,192 372,218 400,206 L400,260 L0,260 Z" fill="#dbeafe" opacity=".55"/>
            <path d="M0,235 C95,210 180,258 270,232 C335,214 378,236 400,226 L400,260 L0,260 Z" fill="#93c5fd" opacity=".45"/>
          </svg>
          <div class="qs-duo-content">
            <div style="font-size:12px;font-weight:600;color:#1c2b3a;letter-spacing:.06em;text-transform:uppercase;">Objetivo Central</div>
            <div style="width:56px;height:3px;background:#3b82f6;border-radius:2px;margin:8px 0 12px;"></div>
            <div style="font-family:'Space Grotesk';font-weight:700;font-size:16.5px;line-height:1.45;color:#0f2a4a;">PROMOVER A <span style="color:#2563a8;">COOPERAÇÃO</span> COM O <span style="color:#2563a8;">SUL GLOBAL E O NORTE</span>, ELEVANDO A INTERNACIONALIZAÇÃO DE <span style="color:#2563a8;">IES/IP</span> COM DIFERENTES <span style="color:#2563a8;">ESTÁGIOS DE DESENVOLVIMENTO.</span></div>
            <div style="width:120px;height:3px;background:linear-gradient(90deg,#0f2a4a,#3b82f6);border-radius:2px;margin-top:14px;"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">Estrutura da rede</div>
    <div class="panel" style="text-align:center;">
      <img src="estrutura-rede.png" alt="Estrutura da Rede CAPES Global" style="max-width:100%;height:auto;border-radius:8px;">
    </div>


    <div class="panel" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-size:12.5px;color:var(--muted);">Acesse nosso site</div>
        <a href="https://campusvirtual.fiocruz.br/portal/?q=content/99589" target="_blank" rel="noopener" style="font-size:13.5px;color:var(--blue);font-weight:600;text-decoration:none;">Rede CAPES Global | Campus Virtual Fiocruz →</a>
      </div>
      <div>
        <div style="font-size:12.5px;color:var(--muted);">Contato</div>
        <a href="mailto:rede.capesglobal@fiocruz.br" style="font-size:13.5px;color:var(--blue);font-weight:600;text-decoration:none;">📧 rede.capesglobal@fiocruz.br</a>
      </div>
    </div>
  `;
}


// ============================================================
// PAGE: Dashboard
// ============================================================
function pageDashboard() {
  const r = DATA.resumo;
  return `
    <div class="kpi-row">
      ${kpiCard('Total Rede - Aprovado', fmtBRL(r.total_rede.aprovado), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">Executado ${fmtBRL(r.total_rede.executado)}</div>`)}
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
  const b = t.bolsas;
  const bolsasSection = b ? `
    <div class="section-title">Bolsas do tema</div>
    <div class="kpi-row">
      ${kpiCard('Bolsas — Previsto', fmtBRL(b.previsto))}
      ${kpiCard('Bolsas — Executado', fmtBRL(b.executado))}
      ${kpiCard('Bolsas — Saldo', fmtBRL(b.saldo))}
      ${kpiCard('Bolsas — % Executado', fmtPct(b.pct))}
    </div>
    <div class="grid-2">
      <div class="panel"><h3>Bolsas: previsto vs. executado por ano</h3><div class="chart-box"><canvas id="chTemaBolsas"></canvas></div></div>
      <div class="panel"><h3>Detalhamento por ano</h3><table id="tblTemaBolsas"></table></div>
    </div>` : '';
  return `
    ${kpiRowStandard(t.kpis)}
    ${bolsasSection}
    <div class="section-title">Detalhamento por ano <span class="tag">Missões + Bolsas</span></div>
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
  const b = t.bolsas;
  if (b) {
    safeChart('chTemaBolsas', { type:'bar', data:{ labels: b.por_ano.map(a=>a.ano),
      datasets:[{label:'Previsto', data:b.por_ano.map(a=>a.previsto), backgroundColor:'#2563a8', borderRadius:4},
                 {label:'Executado', data:b.por_ano.map(a=>a.executado), backgroundColor:'#c98a2a', borderRadius:4}]},
      options: baseBarOpts() });
    const tbl = document.getElementById('tblTemaBolsas');
    if (tbl) tbl.innerHTML = `
      <tr><th>Ano</th><th>Previsto</th><th>Executado</th><th>Saldo</th><th>% Exec.</th></tr>
      ${b.por_ano.map(a => `<tr><td>${a.ano}</td><td class="num">${fmtBRL(a.previsto)}</td><td class="num">${fmtBRL(a.executado)}</td>
        <td class="num">${fmtBRL(a.saldo)}</td><td class="num">${fmtPct(a.pct)}</td></tr>`).join('')}`;
  }
  safeChart('chTemaIES', { type:'bar', data:{ labels: t.missoes_por_ies.map(i=>i.ies),
    datasets:[{label:'Previsto', data:t.missoes_por_ies.map(i=>i.total_previsto), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Executado', data:t.missoes_por_ies.map(i=>i.total_executado), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: baseBarOpts() });
  document.getElementById('tblTemaIES').innerHTML = `
    <tr><th>IES</th><th>Previsto</th><th>Executado</th></tr>
    ${t.missoes_por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${fmtBRL(i.total_previsto)}</td><td class="num">${fmtBRL(i.total_executado)}</td></tr>`).join('')}`;
}

// ============================================================
// PAGE: PPG's
// ============================================================
function pagePPGs() {
  const p = DATA.ppgs;
  const k = p.kpis;
  const notaBadgeClass = (n) => n >= 6 ? 'status-con' : (n >= 5 ? 'status-and' : 'status-nao');
  return `
    <div class="kpi-row">
      ${kpiCard('Total de PPGs', fmtNum(k.total), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">em ${fmtNum(k.total_ies)} IES</div>`)}
      ${kpiCard('Nota média CAPES', k.nota_media.toLocaleString('pt-BR',{minimumFractionDigits:1}), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">escala de 3 a 7</div>`)}
      ${kpiCard('Total docentes', fmtNum(k.total_docentes), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">média ${k.docentes_media.toLocaleString('pt-BR')} / PPG</div>`)}
      ${kpiCard('Total discentes', fmtNum(k.total_discentes), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">média ${k.discentes_media.toLocaleString('pt-BR')} / PPG</div>`)}
      ${kpiCard('PPGs nota 6-7', fmtNum(k.ppgs_alta_nota), `<div style="font-size:11.5px;color:var(--muted);margin-top:6px;">${k.ppgs_alta_nota_pct.toLocaleString('pt-BR')}% do total</div>`)}
    </div>

    <div class="section-title">Medianas de docentes e discentes</div>
    <div class="grid-3">
      <div class="panel">
        <h3>Geral (${fmtNum(p.kpis.total)} PPGs)</h3>
        <div style="display:flex;gap:14px;">
          <div style="flex:1;background:var(--blue-light);border-radius:8px;padding:12px 14px;">
            <div style="font-family:'Space Grotesk';font-size:19px;font-weight:700;color:var(--navy);">${p.mediana_geral.docentes.toLocaleString('pt-BR')}</div>
            <div style="font-size:10.5px;color:var(--muted);">Mediana docentes</div>
          </div>
          <div style="flex:1;background:var(--blue-light);border-radius:8px;padding:12px 14px;">
            <div style="font-family:'Space Grotesk';font-size:19px;font-weight:700;color:var(--navy);">${p.mediana_geral.discentes.toLocaleString('pt-BR')}</div>
            <div style="font-size:10.5px;color:var(--muted);">Mediana discentes</div>
          </div>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:12px;">A mediana representa o PPG "típico" da rede, sem distorção de programas muito grandes ou pequenos.</p>
      </div>
      <div class="panel"><h3>Por IES</h3><table>
        <tr><th>IES</th><th>Docentes</th><th>Discentes</th></tr>
        ${p.por_ies.map(i => `<tr><td>${i.ies}</td><td class="num">${i.mediana_docentes.toLocaleString('pt-BR')}</td><td class="num">${i.mediana_discentes.toLocaleString('pt-BR')}</td></tr>`).join('')}
      </table></div>
      <div class="panel"><h3>Por tema (PPGs com SIM)</h3><table>
        <tr><th>Tema</th><th>Docentes</th><th>Discentes</th></tr>
        ${p.mediana_por_tema.map(t => `<tr><td>${t.tema} <span style="color:var(--muted);">(${t.qtd})</span></td><td class="num">${t.docentes.toLocaleString('pt-BR')}</td><td class="num">${t.discentes.toLocaleString('pt-BR')}</td></tr>`).join('')}
      </table></div>
    </div>

    <div class="section-title">Distribuição por instituição</div>
    <div class="grid-2">
      <div class="panel"><h3>Quantidade de PPGs por IES</h3><div class="chart-box"><canvas id="chPPGqtdIES"></canvas></div></div>
      <div class="panel"><h3>Nota média por IES</h3><div class="chart-box"><canvas id="chPPGnotaIES"></canvas></div></div>
    </div>

    <div class="section-title">Notas e corpo acadêmico</div>
    <div class="grid-2">
      <div class="panel"><h3>Distribuição de notas CAPES</h3><div class="chart-box"><canvas id="chPPGnotas"></canvas></div></div>
      <div class="panel"><h3>Docentes e discentes por IES</h3><div class="chart-box"><canvas id="chPPGdocdisc"></canvas></div></div>
    </div>

    <div class="section-title">Cobertura temática <span class="tag">SIM = PPG cobre o tema</span></div>
    <div class="panel">
      ${p.cobertura_tematica.map(t => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:12px;color:var(--muted);width:60px;flex-shrink:0;">${t.tema}</span>
          <div style="flex:1;background:var(--bg);border-radius:4px;height:18px;overflow:hidden;">
            <div style="height:100%;border-radius:4px;display:flex;align-items:center;padding-left:8px;width:${t.pct}%;background:#2563a8;">
              <span style="font-size:11px;font-weight:500;color:#fff;">${t.pct}%</span>
            </div>
          </div>
          <span style="font-size:11px;color:var(--muted);width:55px;text-align:right;flex-shrink:0;">${t.qtd} / ${p.kpis.total}</span>
        </div>`).join('')}
    </div>

    <div class="section-title">Lista de PPGs da Rede <span class="tag">${fmtNum(p.lista.length)} programas</span></div>
    <div class="panel" style="max-height:460px;overflow-y:auto;">
      <table>
        <tr><th>PPG</th><th>IES</th><th>Nota</th><th class="num">Docentes</th><th class="num">Discentes</th></tr>
        ${p.lista.map(x => `<tr><td>${x.ppg}</td><td>${x.ies}</td>
          <td><span class="pct-pill ${notaBadgeClass(x.nota)}">${x.nota}</span></td>
          <td class="num">${fmtNum(x.docentes)}</td><td class="num">${fmtNum(x.discentes)}</td></tr>`).join('')}
      </table>
    </div>
  `;
}
function afterPPGs() {
  const p = DATA.ppgs;
  const palette = ['#2563a8','#2f8f6e','#c98a2a','#7c3d9e','#b5302b','#4a7fa0'];
  safeChart('chPPGqtdIES', { type:'bar', data:{ labels:p.por_ies.map(i=>i.ies),
    datasets:[{data:p.por_ies.map(i=>i.qtd), backgroundColor:palette, borderRadius:5}]},
    options:{...countBarOpts(), plugins:{legend:{display:false}}} });
  safeChart('chPPGnotaIES', { type:'bar', data:{ labels:p.por_ies.map(i=>i.ies),
    datasets:[{data:p.por_ies.map(i=>i.nota_media), backgroundColor:'#2f8f6e', borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{min:0,max:7,ticks:{font:{size:10.5},stepSize:1},grid:{color:'#eef1f5'}},x:{ticks:{font:{size:11}},grid:{display:false}}}} });
  safeChart('chPPGnotas', { type:'bar', data:{ labels:p.distribuicao_notas.map(n=>'Nota '+n.nota),
    datasets:[{data:p.distribuicao_notas.map(n=>n.qtd), backgroundColor:['#c98a2a','#4a7fa0','#2f8f6e','#2563a8','#0f2a4a'], borderRadius:5}]},
    options:{...countBarOpts(), plugins:{legend:{display:false}}} });
  safeChart('chPPGdocdisc', { type:'bar', data:{ labels:p.por_ies.map(i=>i.ies),
    datasets:[{label:'Docentes', data:p.por_ies.map(i=>i.docentes), backgroundColor:'#2563a8', borderRadius:4},
               {label:'Discentes', data:p.por_ies.map(i=>i.discentes), backgroundColor:'#c98a2a', borderRadius:4}]},
    options: countBarOpts() });
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
    ${heatmapBlock(DATA.paises.bolsas, {title:'Mapa de calor - país de destino', showIesDestino:true})}
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
    ${heatmapBlock(DATA.paises.missoes, {title:'Mapa de calor - destino das missões'})}
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
    ${heatmapBlock(DATA.paises.ri, {title:'Mapa de calor - parcerias e interações'})}
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
    ${heatmapBlock(DATA.paises.eventos, {title:'Mapa de calor - país dos eventos'})}
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
// PAGE: Metas (placeholder - aba ainda em elaboração na planilha)
// ============================================================
function pageMetas() {
  return `
    <div class="panel">
      <div class="empty-state" style="padding:60px 20px;">
        <div style="font-size:32px;margin-bottom:12px;">🎯</div>
        <div style="font-size:14px;font-weight:600;color:var(--navy);margin-bottom:6px;">Aba em elaboração</div>
        A aba de Metas ainda está sendo estruturada na planilha. Assim que os indicadores forem definidos,
        esta página passa a exibir o acompanhamento automaticamente.
      </div>
    </div>
  `;
}
