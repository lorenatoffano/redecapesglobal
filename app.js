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
  { id:'quemsomos', label:'Quem Somos', icon:'🌐' },
  { id:'dashboard', label:'Dashboard', icon:'📊' },
  { id:'cg', label:'Comitê Gestor', icon:'💼' },
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
  { id:'ppgs', label:'PPG\'s', icon:'🎓' },
];

const TITLES = { quemsomos:['Quem Somos','Rede CAPES Global para o Desenvolvimento Sustentável, Ciência e Saúde.'],
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
  else { setTitle(...TITLES.dashboard); root.innerHTML = pageDashboard(); afterDashboard(); }
}
function setTitle(t, s) { document.getElementById('pageTitle').textContent = t; document.getElementById('pageSubtitle').textContent = s || ''; }
function findTemaKey(route) {
  const item = NAV.find(n => n.id === 'temas').children.find(c => c.id === route);
  return item ? item.key : route;
}

// ============================================================
// PAGE: Quem Somos
// ============================================================
const BR_MAP_PATH = "M 290.1,431.3 C 287.6,435.4 284.7,443.9 280.6,448.9 C 276.6,453.9 268.3,459.9 266.0,461.5 C 263.7,463.1 266.8,459.4 266.7,458.6 C 266.6,457.9 265.3,457.1 265.6,456.9 C 265.9,456.8 267.3,458.1 268.5,457.8 C 269.8,457.5 272.4,455.7 273.2,454.9 C 274.0,454.2 272.9,453.5 273.3,453.2 C 273.6,452.9 274.6,454.0 275.1,453.2 C 275.6,452.4 275.2,449.7 276.2,448.3 C 277.3,446.8 280.6,446.0 281.4,444.6 C 282.3,443.2 281.0,440.4 281.3,439.9 C 281.5,439.4 282.6,441.8 282.9,441.4 C 283.1,441.1 283.3,438.2 282.6,438.1 C 281.9,438.0 280.2,441.3 278.9,440.9 C 277.6,440.5 275.4,436.0 274.8,435.8 C 274.1,435.5 274.4,438.6 274.8,439.4 C 275.2,440.1 277.0,439.6 277.0,440.1 C 277.0,440.6 275.1,441.5 274.7,442.4 C 274.4,443.2 275.0,445.2 274.9,445.3 C 274.8,445.5 274.3,442.7 274.0,443.2 C 273.7,443.8 274.2,447.2 273.1,448.6 C 272.1,449.9 268.7,450.2 267.6,451.3 C 266.5,452.5 267.1,454.9 266.5,455.7 C 266.0,456.6 264.7,456.1 264.3,456.4 C 263.9,456.8 263.9,457.5 264.0,457.9 C 264.2,458.2 265.1,458.3 265.4,458.4 C 265.6,458.6 265.6,458.6 265.6,458.7 C 265.6,458.7 265.7,458.9 265.6,458.8 C 265.5,458.8 265.4,458.5 265.2,458.5 C 265.0,458.5 264.6,458.6 264.4,458.9 C 264.2,459.1 263.9,460.0 264.1,460.0 C 264.2,460.0 265.1,458.6 265.4,458.9 C 265.7,459.1 266.3,460.7 265.9,461.5 C 265.6,462.3 264.4,461.8 263.4,463.6 C 262.4,465.4 261.8,469.8 259.8,472.5 C 257.8,475.2 252.9,479.0 251.2,480.0 C 249.5,481.0 249.7,480.0 249.6,478.8 C 249.6,477.6 250.3,473.9 250.8,472.8 C 251.4,471.7 252.1,473.1 252.7,472.4 C 253.3,471.7 253.3,469.2 254.2,468.7 C 255.2,468.2 257.4,470.0 258.4,469.5 C 259.4,469.0 260.0,467.0 260.3,465.6 C 260.5,464.1 260.8,460.8 259.9,461.0 C 258.9,461.3 256.1,466.2 254.7,467.1 C 253.2,468.0 252.3,466.8 251.3,466.3 C 250.2,465.7 249.1,464.9 248.4,463.9 C 247.7,462.9 249.0,462.1 247.3,460.3 C 245.5,458.5 240.6,454.6 237.8,452.9 C 235.0,451.3 232.3,451.9 230.5,450.6 C 228.6,449.4 228.1,445.9 226.7,445.6 C 225.2,445.2 222.7,448.6 221.8,448.5 C 221.0,448.4 223.2,447.0 221.7,445.0 C 220.2,443.1 214.9,438.4 212.9,437.0 C 210.9,435.6 210.7,436.4 209.9,436.8 C 209.2,437.2 209.4,439.0 208.3,439.2 C 207.2,439.4 202.0,440.4 203.5,438.1 C 205.0,435.7 214.0,428.5 217.3,424.9 C 220.6,421.3 222.0,417.7 223.3,416.5 C 224.7,415.2 225.2,417.4 225.4,417.2 C 225.6,417.0 223.3,416.2 224.5,415.1 C 225.8,413.9 231.0,411.9 232.8,410.5 C 234.6,409.1 233.9,407.5 235.3,406.7 C 236.7,405.9 240.0,406.2 241.2,405.7 C 242.4,405.1 241.6,404.0 242.5,403.4 C 243.4,402.8 245.7,404.1 246.7,402.1 C 247.7,400.2 248.7,394.7 248.6,391.7 C 248.4,388.7 246.5,385.4 245.6,384.2 C 244.7,382.9 243.7,384.4 243.3,384.1 C 242.9,383.9 243.9,382.5 243.2,382.7 C 242.6,382.8 240.5,384.8 239.6,385.0 C 238.7,385.2 237.4,387.0 237.7,383.8 C 238.0,380.6 241.5,369.3 241.3,365.8 C 241.2,362.3 238.3,363.0 236.9,362.8 C 235.4,362.7 233.9,364.7 232.5,365.0 C 231.1,365.3 229.6,367.3 228.5,364.7 C 227.5,362.0 227.1,352.5 226.3,349.2 C 225.5,345.9 224.9,345.7 223.8,344.9 C 222.7,344.2 220.6,345.2 219.6,344.7 C 218.6,344.3 218.7,342.3 217.5,342.4 C 216.4,342.4 215.5,345.0 212.5,345.0 C 209.5,345.1 201.4,345.2 199.6,342.5 C 197.8,339.9 201.9,332.8 201.5,329.0 C 201.2,325.2 197.7,321.8 197.6,319.9 C 197.5,318.0 201.0,318.4 201.1,317.5 C 201.1,316.7 197.7,316.9 198.0,315.0 C 198.3,313.2 202.3,307.9 202.9,306.2 C 203.6,304.5 201.9,306.4 202.1,304.9 C 202.4,303.4 203.9,298.5 204.5,297.2 C 205.1,295.8 206.0,298.4 205.6,297.0 C 205.3,295.7 204.1,291.2 202.3,289.2 C 200.5,287.1 196.4,286.4 195.0,284.7 C 193.7,283.0 194.1,280.8 194.2,279.0 C 194.4,277.2 199.1,274.7 195.9,273.9 C 192.7,273.0 178.7,275.4 175.1,273.9 C 171.5,272.3 175.1,266.8 174.4,264.5 C 173.6,262.3 170.7,261.0 170.7,260.2 C 170.7,259.5 173.8,261.1 174.3,260.1 C 174.9,259.1 174.5,256.3 174.0,254.5 C 173.5,252.7 171.7,250.6 171.5,249.4 C 171.3,248.2 172.7,247.9 172.8,247.1 C 172.8,246.3 172.5,245.4 171.8,244.8 C 171.1,244.2 169.4,244.1 168.4,243.4 C 167.4,242.8 167.7,241.4 165.7,241.1 C 163.7,240.9 158.6,242.6 156.4,241.9 C 154.2,241.1 154.4,237.8 152.7,236.7 C 150.9,235.7 147.7,236.5 145.9,235.5 C 144.0,234.5 142.6,231.5 141.6,230.8 C 140.6,230.2 141.2,232.0 140.1,231.6 C 138.9,231.3 136.4,229.0 134.6,228.6 C 132.7,228.3 130.6,230.2 128.9,229.5 C 127.2,228.9 125.7,225.7 124.3,224.7 C 122.9,223.7 121.3,224.3 120.6,223.6 C 119.9,222.8 120.4,220.7 119.9,220.2 C 119.5,219.6 118.5,221.0 118.0,220.1 C 117.5,219.2 116.9,216.2 116.9,214.8 C 116.9,213.4 118.2,212.9 118.1,211.6 C 118.0,210.4 116.3,208.8 116.3,207.3 C 116.2,205.8 117.6,204.4 117.7,202.6 C 117.7,200.8 117.0,197.1 116.5,196.3 C 116.0,195.6 115.3,198.1 114.6,198.2 C 113.9,198.3 114.3,196.8 112.3,196.9 C 110.3,197.0 106.4,196.9 102.7,198.8 C 99.1,200.7 93.2,206.9 90.5,208.4 C 87.9,209.9 87.9,207.2 86.9,207.7 C 85.8,208.3 85.4,210.7 84.1,211.7 C 82.8,212.6 80.1,213.5 79.2,213.5 C 78.3,213.5 79.7,212.2 78.7,211.8 C 77.8,211.4 76.9,211.1 73.4,211.1 C 69.9,211.1 60.2,214.8 57.8,211.8 C 55.5,208.8 60.3,195.2 59.2,193.2 C 58.1,191.2 54.4,198.5 51.2,199.6 C 48.0,200.8 42.1,200.9 40.1,200.0 C 38.1,199.2 41.1,195.8 39.2,194.6 C 37.3,193.4 30.0,194.2 28.7,193.1 C 27.5,192.0 32.4,190.2 31.8,188.1 C 31.2,186.0 26.6,182.7 25.1,180.5 C 23.5,178.4 22.7,176.4 22.5,175.3 C 22.2,174.2 23.9,174.5 23.4,173.8 C 23.0,173.1 20.5,171.8 20.0,171.0 C 19.5,170.1 19.8,169.2 20.4,168.7 C 20.9,168.3 23.0,168.7 23.3,168.2 C 23.6,167.8 22.1,166.9 22.1,166.0 C 22.1,165.1 22.0,164.0 23.2,162.8 C 24.4,161.6 28.7,160.3 29.6,158.7 C 30.5,157.2 28.1,154.9 28.5,153.2 C 28.8,151.6 30.9,150.5 31.6,148.8 C 32.2,147.1 30.2,145.4 32.4,143.0 C 34.7,140.7 41.5,136.4 45.2,134.9 C 48.8,133.3 52.2,134.5 54.2,133.8 C 56.3,133.2 56.3,131.3 57.5,130.8 C 58.6,130.3 60.3,130.5 61.1,131.0 C 62.0,131.5 61.8,133.5 62.6,133.6 C 63.3,133.7 64.0,138.2 65.5,131.8 C 67.0,125.5 71.0,102.3 71.6,95.5 C 72.2,88.7 69.4,92.2 69.0,91.0 C 68.6,89.7 69.9,89.2 69.1,88.1 C 68.3,87.0 65.0,86.4 64.2,84.3 C 63.4,82.3 63.2,77.4 64.3,75.6 C 65.4,73.7 69.3,73.6 70.6,73.5 C 71.9,73.4 71.3,74.8 72.0,74.9 C 72.7,75.1 74.6,75.4 74.7,74.5 C 74.9,73.6 74.4,70.5 73.1,69.6 C 71.7,68.7 67.6,70.6 66.6,69.3 C 65.5,68.1 63.4,63.1 66.6,61.9 C 69.7,60.6 82.5,61.9 85.5,61.7 C 88.4,61.5 84.3,61.1 84.3,60.6 C 84.2,60.1 84.6,58.8 85.2,58.8 C 85.8,58.8 86.4,61.1 87.9,60.6 C 89.4,60.0 92.5,55.5 94.1,55.7 C 95.7,55.9 96.8,59.6 97.4,61.7 C 98.0,63.8 97.0,67.4 97.5,68.4 C 97.9,69.4 98.6,66.8 100.1,67.6 C 101.5,68.5 103.8,73.0 106.2,73.5 C 108.5,73.9 112.9,70.1 114.4,70.2 C 115.8,70.4 114.4,74.3 114.9,74.5 C 115.3,74.6 116.6,71.7 117.2,71.2 C 117.9,70.6 118.5,71.7 118.9,71.3 C 119.3,70.8 119.1,69.3 119.8,68.5 C 120.5,67.7 122.4,66.8 123.1,66.6 C 123.7,66.5 123.0,68.1 123.8,67.7 C 124.5,67.3 126.9,64.4 127.7,64.1 C 128.5,63.9 127.6,67.0 128.4,66.1 C 129.1,65.2 130.4,60.5 132.2,58.8 C 134.0,57.1 138.1,57.0 139.2,56.1 C 140.3,55.2 140.1,54.0 138.8,53.4 C 137.5,52.9 132.6,53.4 131.5,52.7 C 130.4,52.0 132.6,50.7 132.2,49.5 C 131.9,48.3 129.9,47.0 129.5,45.4 C 129.2,43.9 131.1,42.5 130.1,40.2 C 129.0,37.9 123.9,32.7 123.2,31.6 C 122.5,30.6 124.7,33.5 125.9,33.8 C 127.1,34.1 129.2,33.0 130.3,33.5 C 131.4,34.0 131.7,36.1 132.6,36.5 C 133.5,37.0 135.2,36.4 135.7,36.1 C 136.3,35.8 135.4,34.6 135.8,34.8 C 136.1,34.9 137.3,36.8 137.8,36.9 C 138.3,37.0 138.0,35.5 138.6,35.3 C 139.1,35.0 140.2,34.8 141.1,35.6 C 142.0,36.3 143.0,39.1 143.8,39.6 C 144.7,40.2 145.9,39.7 146.3,38.8 C 146.7,38.0 145.9,35.3 146.2,34.6 C 146.6,33.9 147.8,35.1 148.4,34.8 C 148.9,34.5 148.5,33.0 149.7,32.8 C 150.9,32.7 153.7,33.9 155.4,33.8 C 157.0,33.6 158.4,32.9 159.5,32.0 C 160.7,31.2 161.1,29.2 162.2,28.7 C 163.3,28.2 164.5,29.6 165.9,28.9 C 167.3,28.1 169.9,25.4 170.4,24.1 C 170.9,22.7 168.2,21.3 168.9,20.6 C 169.6,19.9 173.3,19.5 174.7,20.0 C 176.0,20.5 177.1,21.8 177.2,23.3 C 177.3,24.8 174.6,27.8 175.2,29.0 C 175.8,30.2 179.9,30.0 180.7,30.6 C 181.6,31.2 179.8,32.0 180.1,32.8 C 180.4,33.7 182.7,34.5 182.5,35.7 C 182.2,36.8 179.1,38.8 178.6,40.0 C 178.0,41.1 179.5,41.2 179.3,42.5 C 179.0,43.9 177.4,46.2 177.2,48.2 C 177.0,50.1 177.7,53.1 178.2,54.3 C 178.7,55.5 179.9,54.3 180.2,55.3 C 180.4,56.3 178.2,58.1 179.8,60.2 C 181.5,62.4 187.9,67.2 190.3,68.3 C 192.6,69.5 193.4,67.8 193.9,67.2 C 194.5,66.6 193.5,65.5 193.8,64.9 C 194.1,64.3 194.9,63.4 195.9,63.3 C 196.8,63.2 198.8,64.5 199.5,64.4 C 200.1,64.3 198.7,63.0 199.6,62.6 C 200.5,62.2 203.4,62.8 204.7,62.1 C 206.0,61.4 204.3,58.9 207.3,58.6 C 210.2,58.3 219.8,60.5 222.4,60.4 C 225.1,60.3 223.4,58.9 223.0,58.1 C 222.7,57.3 220.5,56.4 220.4,55.4 C 220.3,54.5 220.9,52.6 222.3,52.3 C 223.7,52.0 227.0,53.8 228.9,53.6 C 230.7,53.5 231.4,51.2 233.1,51.6 C 234.9,52.0 237.6,55.4 239.5,56.1 C 241.4,56.8 243.4,56.2 244.7,55.8 C 245.9,55.5 245.0,54.0 247.0,54.1 C 249.0,54.2 254.4,56.6 256.7,56.4 C 259.0,56.1 259.6,54.4 260.6,52.5 C 261.7,50.6 261.4,47.8 263.1,44.7 C 264.8,41.7 269.3,37.0 270.8,34.5 C 272.4,32.0 271.2,29.5 272.3,29.8 C 273.4,30.1 276.3,33.7 277.2,36.3 C 278.1,38.8 277.0,41.7 277.7,45.2 C 278.4,48.6 280.3,55.1 281.4,56.9 C 282.5,58.8 283.4,55.6 284.3,56.2 C 285.2,56.9 285.6,59.9 286.6,60.9 C 287.6,61.9 289.9,59.3 290.3,62.2 C 290.6,65.0 288.2,75.5 288.6,78.2 C 289.1,80.8 291.7,77.2 292.9,77.8 C 294.2,78.5 294.7,80.8 296.1,82.0 C 297.5,83.1 299.5,84.3 301.3,84.8 C 303.2,85.3 306.3,84.6 307.1,85.2 C 308.0,85.7 305.7,87.1 306.5,88.0 C 307.2,88.9 310.7,90.3 311.8,90.5 C 312.9,90.6 312.6,88.7 312.9,88.7 C 313.2,88.6 313.2,90.2 313.5,90.2 C 313.9,90.1 314.7,88.4 315.1,88.5 C 315.5,88.5 315.7,90.3 316.0,90.4 C 316.2,90.5 315.9,89.2 316.5,89.0 C 317.0,88.8 318.6,88.8 319.4,89.1 C 320.1,89.5 320.4,91.1 321.1,91.3 C 321.8,91.5 323.0,90.4 323.5,90.6 C 323.9,90.7 323.5,92.4 323.7,92.5 C 323.9,92.5 324.4,90.8 324.6,90.8 C 324.8,90.9 324.6,92.7 325.0,92.8 C 325.4,92.9 326.8,91.3 327.0,91.4 C 327.3,91.6 326.2,93.5 326.6,93.6 C 327.0,93.8 329.0,92.1 329.4,92.3 C 329.9,92.4 329.2,94.3 329.4,94.7 C 329.6,95.1 330.4,95.3 330.8,94.9 C 331.2,94.6 331.8,92.4 331.9,92.6 C 332.0,92.8 331.1,95.7 331.1,96.0 C 331.2,96.2 332.2,93.9 332.3,93.8 C 332.4,93.8 331.7,95.4 331.9,95.5 C 332.1,95.5 333.1,94.0 333.4,94.1 C 333.6,94.3 333.2,96.2 333.3,96.2 C 333.4,96.3 333.8,95.0 334.0,94.7 C 334.2,94.4 334.5,94.1 334.6,94.5 C 334.7,94.8 334.6,96.7 334.8,96.7 C 335.0,96.8 335.4,95.0 335.6,94.7 C 335.8,94.3 336.1,94.1 336.0,94.5 C 335.9,94.8 335.1,96.5 335.2,96.7 C 335.3,96.9 336.4,95.8 336.5,95.9 C 336.7,95.9 336.0,96.9 336.0,97.3 C 336.0,97.6 336.4,98.0 336.4,98.0 C 336.4,98.0 335.9,97.7 336.0,97.3 C 336.1,96.9 336.9,95.8 337.2,95.5 C 337.5,95.2 337.8,95.1 337.8,95.6 C 337.8,96.2 337.1,98.6 337.3,98.8 C 337.5,99.1 338.5,97.0 338.9,97.0 C 339.3,97.0 339.3,98.7 339.6,98.8 C 339.9,98.9 340.8,97.3 340.8,97.3 C 340.9,97.4 340.1,98.5 339.9,99.0 C 339.8,99.5 339.9,100.0 340.0,100.2 C 340.0,100.4 340.1,100.7 340.5,100.3 C 340.8,100.0 341.9,97.6 342.1,98.0 C 342.2,98.4 341.2,102.4 341.5,102.6 C 341.8,102.8 343.3,99.8 343.7,99.4 C 344.1,98.9 343.8,100.0 343.8,100.1 C 343.8,100.2 344.0,99.9 344.0,100.0 C 344.0,100.0 344.0,100.1 344.0,100.2 C 344.0,100.2 344.0,100.3 344.0,100.3 C 344.0,100.4 344.0,100.4 344.1,100.4 C 344.1,100.4 344.2,100.6 344.2,100.4 C 344.2,100.2 344.0,99.7 344.0,99.3 C 344.0,99.0 344.3,98.1 344.3,98.2 C 344.3,98.3 344.2,99.5 344.2,99.8 C 344.2,100.1 343.8,100.1 344.3,100.0 C 344.9,99.8 347.1,98.7 347.5,98.8 C 347.9,99.0 346.3,100.8 346.6,101.2 C 346.9,101.6 349.3,100.9 349.4,101.3 C 349.5,101.7 347.2,103.5 347.2,103.7 C 347.1,103.9 348.9,102.6 349.3,102.4 C 349.8,102.3 349.4,101.2 350.0,102.7 C 350.6,104.3 351.9,110.3 353.0,111.6 C 354.1,112.9 356.0,110.5 356.4,110.4 C 356.8,110.4 355.2,110.9 355.3,111.3 C 355.4,111.6 355.9,113.0 356.9,112.5 C 357.8,112.0 358.6,108.2 361.0,108.3 C 363.4,108.5 369.7,112.7 371.3,113.4 C 373.0,114.0 370.4,112.1 370.8,112.2 C 371.2,112.3 372.0,113.8 373.7,114.1 C 375.4,114.4 379.4,113.8 381.1,114.2 C 382.7,114.6 380.2,116.1 383.7,116.4 C 387.2,116.7 396.4,114.3 402.2,115.8 C 408.0,117.4 413.5,121.7 418.6,125.8 C 423.8,129.8 430.0,137.5 433.4,140.3 C 436.7,143.0 436.4,142.0 438.7,142.2 C 441.0,142.4 444.6,141.3 447.0,141.6 C 449.4,141.9 451.1,139.8 453.2,144.0 C 455.4,148.1 459.3,160.0 460.0,166.5 C 460.7,173.0 458.6,179.1 457.6,183.1 C 456.7,187.1 456.9,186.7 454.2,190.5 C 451.6,194.3 445.2,202.7 442.0,206.1 C 438.8,209.6 438.2,206.8 435.1,211.0 C 432.0,215.1 425.9,227.1 423.5,231.1 C 421.0,235.1 421.2,234.2 420.1,234.8 C 419.1,235.4 418.2,234.0 417.1,234.6 C 416.0,235.1 414.2,234.7 413.4,238.2 C 412.5,241.7 411.9,250.3 412.0,255.5 C 412.2,260.6 414.7,264.3 414.4,269.1 C 414.1,273.9 410.9,280.9 410.4,284.5 C 409.9,288.1 412.0,288.8 411.3,290.6 C 410.6,292.4 407.3,293.9 406.2,295.3 C 405.2,296.7 405.3,296.1 404.9,299.2 C 404.5,302.3 404.4,311.0 403.7,313.7 C 403.1,316.5 402.2,313.6 401.0,315.6 C 399.9,317.5 398.1,323.3 396.8,325.4 C 395.5,327.5 394.3,326.4 393.0,328.1 C 391.8,329.8 390.0,333.3 389.5,335.6 C 389.1,337.8 392.2,339.4 390.5,341.5 C 388.8,343.5 381.3,346.5 379.5,347.9 C 377.6,349.3 379.0,349.4 379.2,349.8 C 379.4,350.3 380.7,349.8 380.6,350.4 C 380.6,350.9 381.2,352.8 379.0,353.2 C 376.7,353.7 369.3,353.7 367.3,353.1 C 365.3,352.4 367.4,349.8 366.9,349.5 C 366.5,349.1 364.8,350.3 364.6,350.9 C 364.5,351.5 366.3,352.6 365.8,353.1 C 365.4,353.6 363.2,353.9 361.7,354.2 C 360.1,354.4 356.6,354.4 356.6,354.4 C 356.6,354.3 361.3,354.3 361.6,353.9 C 361.9,353.5 359.8,352.1 358.5,352.1 C 357.2,352.1 355.0,353.7 354.0,353.9 C 353.0,354.2 352.8,353.7 352.6,353.5 C 352.5,353.3 353.2,352.9 353.3,352.8 C 353.3,352.7 353.0,352.9 352.9,352.9 C 352.9,352.8 353.1,352.5 353.0,352.4 C 353.0,352.3 353.2,352.1 352.6,352.4 C 351.9,352.7 349.5,353.6 348.9,354.2 C 348.2,354.9 348.6,355.8 348.7,356.0 C 348.7,356.2 349.3,355.3 349.4,355.4 C 349.5,355.6 349.1,356.7 349.3,356.7 C 349.5,356.8 350.1,355.9 350.4,355.9 C 350.7,355.9 351.1,356.5 351.0,356.8 C 351.0,357.0 350.7,357.3 350.1,357.5 C 349.4,357.7 347.8,357.9 347.2,357.8 C 346.6,357.8 347.5,356.7 346.5,357.2 C 345.4,357.7 341.7,359.7 340.8,360.6 C 339.9,361.6 341.0,362.4 341.0,362.8 C 340.9,363.2 341.9,363.0 340.6,363.1 C 339.2,363.1 334.3,362.8 332.9,363.1 C 331.5,363.4 333.5,364.2 332.2,364.9 C 330.8,365.7 327.9,365.7 325.0,367.5 C 322.0,369.3 317.6,372.6 314.3,375.8 C 311.0,379.1 306.8,384.4 305.4,387.0 C 304.1,389.5 306.5,389.6 306.2,391.2 C 306.0,392.8 304.3,395.0 304.0,396.7 C 303.8,398.5 304.6,401.0 305.0,401.9 C 305.4,402.8 306.5,401.9 306.5,402.1 C 306.5,402.3 305.2,402.5 304.9,403.1 C 304.6,403.6 304.5,405.1 304.9,405.5 C 305.4,405.9 308.0,403.5 307.7,405.6 C 307.5,407.7 305.4,415.1 303.4,418.2 C 301.4,421.2 298.0,421.8 295.8,423.9 C 293.6,426.1 292.6,427.1 290.1,431.3 Z";

const BR_PINS = {
  'FIOCRUZ': {x: 365.6, y: 352.1, label: 'Rio de Janeiro — FIOCRUZ (sede)', hub: true},
  'UNILA': {x: 238.8, y: 382.7, label: 'Foz do Iguaçu — UNILA'},
  'UFMS': {x: 237.7, y: 322.6, label: 'Campo Grande — UFMS'},
  'UFOPA': {x: 236.5, y: 110.4, label: 'Santarém — UFOPA'},
  'UFPI': {x: 370.1, y: 142.3, label: 'Teresina — UFPI'},
  'UNIR': {x: 133.3, y: 185.9, label: 'Porto Velho — UNIR'},
};

function pageQuemSomos() {
  const hub = BR_PINS.FIOCRUZ;
  const spokes = Object.entries(BR_PINS).filter(([k]) => k !== 'FIOCRUZ');

  return `
    <div class="panel" style="line-height:1.75;font-size:13.5px;color:var(--text);">
      <p style="margin-bottom:14px;">A <b>Rede CAPES Global para o Desenvolvimento Sustentável, Ciência e Saúde</b> representa uma iniciativa estratégica para fortalecer a internacionalização da pós-graduação brasileira, ampliar a cooperação científica e promover a produção de conhecimento em áreas prioritárias para o desenvolvimento sustentável, a ciência e a saúde. A proposta também busca reduzir assimetrias regionais, ampliar a inserção internacional das instituições participantes e fomentar pesquisas capazes de subsidiar políticas públicas e soluções inovadoras para desafios nacionais e globais.</p>
      <p style="margin-bottom:14px;">Coordenada pela <b>Fundação Oswaldo Cruz (Fiocruz)</b>, a Rede reúne a Universidade Federal da Integração Latino-Americana (UNILA), a Universidade Federal de Mato Grosso do Sul (UFMS), a Universidade Federal do Oeste do Pará (UFOPA), a Universidade Federal do Piauí (UFPI) e a Universidade Federal de Rondônia (UNIR). A articulação entre instituições de diferentes regiões do país fortalece a excelência acadêmica, amplia as oportunidades de cooperação internacional e contribui para uma agenda científica mais integrada, colaborativa e equitativa.</p>
      <p style="margin-bottom:14px;">A Fiocruz lançou os editais da Rede, que estão estruturados em cinco eixos temáticos: <b>Sistemas de Saúde, Doenças Socialmente Determinadas e Desigualdades</b>; <b>Saúde Global e Emergências em Saúde</b>; <b>Biodiversidade, Ambiente e Mudanças Climáticas</b>; <b>Ciclo de Vida, Transformações Demográficas e Envelhecimento Saudável</b>; e <b>Inovação em Ciência e Tecnologia para a Saúde</b>. Os temas refletem prioridades nacionais e estão alinhados aos Objetivos de Desenvolvimento Sustentável (ODS).</p>
      <p style="margin-bottom:14px;">Os cinco eixos contemplam ações voltadas à formação de recursos humanos, mobilidade acadêmica, desenvolvimento de pesquisas colaborativas, inovação tecnológica e fortalecimento de redes internacionais de pesquisa. As iniciativas abrangem desde o enfrentamento das desigualdades em saúde e das emergências sanitárias até estudos sobre biodiversidade, mudanças climáticas, envelhecimento saudável e desenvolvimento de novas tecnologias para a saúde.</p>
      <p>Com os editais, a Rede CAPES Global consolida um modelo de cooperação científica baseado na integração entre instituições brasileiras e parceiros internacionais, fortalecendo a produção de conhecimento de excelência, a inovação e a formação de pesquisadores, com potencial para gerar impactos duradouros nas políticas públicas, no Sistema Único de Saúde e no desenvolvimento científico e tecnológico do país.</p>
    </div>

    <div class="section-title">Instituições da rede pelo Brasil</div>
    <div class="panel">
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <svg viewBox="0 0 480 500" style="width:340px;flex-shrink:0;background:linear-gradient(160deg,#0a1e3d,#123a6e);border-radius:12px;">
          <defs>
            <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.9"/>
              <stop offset="100%" stop-color="#7dd3fc" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <path d="${BR_MAP_PATH}" fill="#1e4d85" stroke="#60a5fa" stroke-width="1.2" opacity="0.85"/>
          <g stroke="#7dd3fc" stroke-width="1.3" opacity="0.65">
            ${spokes.map(([k,p]) => `<line x1="${hub.x}" y1="${hub.y}" x2="${p.x}" y2="${p.y}"/>`).join('')}
          </g>
          <circle cx="${hub.x}" cy="${hub.y}" r="16" fill="url(#pinGlow)"/>
          <circle cx="${hub.x}" cy="${hub.y}" r="6.5" fill="#e0f2fe" stroke="#0f2a4a" stroke-width="1.5"/>
          ${spokes.map(([k,p]) => `
            <circle cx="${p.x}" cy="${p.y}" r="9" fill="url(#pinGlow)"/>
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#93c5fd" stroke="#0f2a4a" stroke-width="1.2"/>
          `).join('')}
        </svg>
        <div style="flex:1;min-width:220px;">
          <table>
            <tr><th>Instituição</th><th>Cidade / Estado</th></tr>
            ${Object.entries(BR_PINS).map(([k,p]) => `<tr><td>${p.hub ? '⭐ '+k+' (coordenação)' : k}</td><td>${p.label.split(' — ')[0]}</td></tr>`).join('')}
          </table>
          <p style="font-size:11.5px;color:var(--muted);margin-top:14px;">A Fiocruz, no Rio de Janeiro, coordena a Rede e se conecta às demais instituições parceiras distribuídas pelas regiões Norte, Nordeste, Centro-Oeste e Sul do país.</p>
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
