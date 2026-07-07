"""
Script para atualizar o Painel de Controle da Rede CAPES Global
a partir da planilha CAPES_Global_Controle.xlsx.

Uso:
    python3 atualizar_dashboard.py CAPES_Global_Controle.xlsx

Regenera o bloco de dados dentro de index.html. Depois é só
fazer commit + push no GitHub para o Pages atualizar sozinho.
"""
import sys, json, re, pathlib
import openpyxl

def v(ws, cell):
    val = ws[cell].value
    return val if val is not None else 0

def pct_status(pct):
    if pct <= 0: return 'NÃO INICIADO'
    if pct >= 1: return 'CONCLUÍDO'
    return 'EM ANDAMENTO'

PT_EN = {
    'BRASIL':'Brazil','MÉXICO':'Mexico','MEXICO':'Mexico','CHILE':'Chile','ARGENTINA':'Argentina',
    'COLÔMBIA':'Colombia','COLOMBIA':'Colombia','PERU':'Peru','URUGUAI':'Uruguay','PARAGUAI':'Paraguay',
    'BOLÍVIA':'Bolivia','BOLIVIA':'Bolivia','EQUADOR':'Ecuador','VENEZUELA':'Venezuela','CUBA':'Cuba',
    'ESTADOS UNIDOS':'United States of America','EUA':'United States of America','CANADÁ':'Canada','CANADA':'Canada',
    'PORTUGAL':'Portugal','ESPANHA':'Spain','FRANÇA':'France','FRANCA':'France','ITÁLIA':'Italy','ITALIA':'Italy',
    'ALEMANHA':'Germany','REINO UNIDO':'United Kingdom','SUÍÇA':'Switzerland','SUICA':'Switzerland',
    'MOÇAMBIQUE':'Mozambique','MOCAMBIQUE':'Mozambique','ANGOLA':'Angola','CABO VERDE':'Cabo Verde',
    'GUINÉ-BISSAU':'Guinea-Bissau','SÃO TOMÉ E PRÍNCIPE':'São Tomé and Principe','TIMOR-LESTE':'Timor-Leste',
    'CHINA':'China', 'JAPÃO':'Japan', 'JAPAO':'Japan', 'ÍNDIA':'India', 'INDIA':'India',
    'ÁFRICA DO SUL':'South Africa', 'AFRICA DO SUL':'South Africa',
}
def norm_pais(pais):
    if not pais: return None
    p = str(pais).strip().upper()
    return PT_EN.get(p, p.title())

def extrair(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    result = {}

    ws = wb['📊 Resumo']
    result['resumo'] = {
        'total_rede': {'aprovado': v(ws,'B6'), 'executado': v(ws,'B7'), 'saldo': v(ws,'B8')},
        'bolsas_cg': {'previsto': v(ws,'D6'), 'executado': v(ws,'D7'), 'saldo': v(ws,'D8')},
        'missoes_cg': {'aprovado': v(ws,'F6'), 'executado': v(ws,'F7'), 'saldo': v(ws,'F8')},
        'acoes_inst': {'aprovado': v(ws,'H6'), 'executado': v(ws,'H7'), 'saldo': v(ws,'H8')},
        'missoes_temas': {'aprovado': v(ws,'J6'), 'executado': v(ws,'J7'), 'saldo': v(ws,'J8')},
        'bolsas_temas': {'planejado': v(ws,'L6'), 'executado': v(ws,'L7'), 'saldo': v(ws,'L8')},
    }
    anos = []
    for r in range(12, 17):
        anos.append({'ano': ws[f'A{r}'].value, 'previsto': v(ws,f'B{r}'), 'executado': v(ws,f'C{r}'), 'saldo': v(ws,f'D{r}'), 'pct': v(ws,f'E{r}')})
    result['resumo']['por_ano'] = anos

    ws2 = wb['📈 Geral']
    geral = []
    for row in ws2.iter_rows(min_row=5, max_row=ws2.max_row, values_only=True):
        if row[0] and row[1] and isinstance(row[0], str):
            if row[0].startswith('Total') or row[0].startswith('🌎') or 'Executado por Ano' in str(row[0]):
                continue
            geral.append({'ies': row[0], 'modalidade': row[1], '2026': row[2] or 0, '2027': row[3] or 0,
                           '2028': row[4] or 0, '2029': row[5] or 0, '2030': row[6] or 0,
                           'total_previsto': row[7] or 0, 'total_executado': row[8] or 0})
    result['geral_matrix'] = geral

    wscg = wb['💼 CG']
    por_ies_cg = []
    for r in range(6, 12):
        por_ies_cg.append({'ies': wscg.cell(r,1).value, 'missoes_prev': v(wscg,f'B{r}'), 'missoes_exec': v(wscg,f'C{r}'),
            'acoes_prev': v(wscg,f'D{r}'), 'acoes_exec': v(wscg,f'E{r}'), 'bolsas_prev': v(wscg,f'F{r}'), 'bolsas_exec': v(wscg,f'G{r}'),
            'previsto': v(wscg,f'H{r}'), 'executado': v(wscg,f'I{r}'), 'saldo': v(wscg,f'J{r}'), 'pct': v(wscg,f'K{r}')})
    totals_row = {'previsto': v(wscg,'H12'), 'executado': v(wscg,'I12'), 'saldo': v(wscg,'J12'), 'pct': v(wscg,'K12')}
    por_modalidade_cg = []
    for r in range(16, 19):
        por_modalidade_cg.append({'modalidade': wscg.cell(r,1).value, 'previsto': v(wscg,f'B{r}'), 'executado': v(wscg,f'C{r}'), 'saldo': v(wscg,f'D{r}'), 'pct': v(wscg,f'E{r}')})
    por_ano_cg = []
    for r in range(23, 28):
        por_ano_cg.append({'ano': wscg.cell(r,1).value, 'previsto': v(wscg,f'B{r}'), 'executado': v(wscg,f'C{r}'), 'saldo': v(wscg,f'D{r}'), 'pct': v(wscg,f'E{r}')})
    result['cg'] = {'kpis': {**totals_row, 'status': pct_status(totals_row['pct'])}, 'por_ies': por_ies_cg,
                     'por_modalidade': por_modalidade_cg, 'por_ano': por_ano_cg}

    inst_sheets = {'Fiocruz': '🏰Fiocruz', 'UFMS': '🏛️UFMS', 'UNILA': '🏛️UNILA', 'UNIR': '🏛️UNIR', 'UFOPA': '🏛️UFOPA', 'UFPI': '🏛️UFPI'}
    instituicoes = {}
    for nome, sheet_name in inst_sheets.items():
        wsi = wb[sheet_name]
        total_prev = v(wsi,'H4'); total_exec = v(wsi,'I4'); total_saldo = v(wsi,'J4')
        total_pct = total_exec / total_prev if total_prev else 0
        modalidades = []
        for r in range(7, 11):
            mod = wsi.cell(r,1).value
            if not mod: continue
            modalidades.append({'modalidade': mod, '2026': v(wsi,f'B{r}'), '2027': v(wsi,f'C{r}'), '2028': v(wsi,f'D{r}'),
                                 '2029': v(wsi,f'E{r}'), '2030': v(wsi,f'F{r}'), 'total_previsto': v(wsi,f'G{r}'),
                                 'total_executado': v(wsi,f'H{r}'), 'saldo': v(wsi,f'I{r}'), 'pct': v(wsi,f'J{r}')})
        anos_i = []
        for r in range(17, 22):
            ano_val = wsi.cell(r,1).value
            if not ano_val: continue
            anos_i.append({'ano': ano_val, 'previsto': v(wsi,f'B{r}'), 'executado': v(wsi,f'C{r}'), 'saldo': v(wsi,f'D{r}'), 'pct': v(wsi,f'E{r}')})
        instituicoes[nome] = {'kpis': {'previsto': total_prev, 'executado': total_exec, 'saldo': total_saldo, 'pct': total_pct, 'status': pct_status(total_pct)},
                               'modalidades': modalidades, 'por_ano': anos_i}
    result['instituicoes'] = instituicoes

    wst = wb['📚Temas']
    temas_overview_rows = []
    for row in wst.iter_rows(min_row=4, max_row=wst.max_row, values_only=True):
        if row[0] and row[1]:
            temas_overview_rows.append({'tema': row[0], 'componente': row[1], '2026': row[2] or 0, '2027': row[3] or 0,
                                         '2028': row[4] or 0, '2029': row[5] or 0, '2030': row[6] or 0,
                                         'total_previsto': row[7] or 0, 'total_executado': row[8] or 0})
    result['temas_overview'] = temas_overview_rows

    tema_sheets = {'Tema 01': '🦠 Tema 01', 'Tema 02': '🚑Tema 02', 'Tema 03': '🌱Tema 03',
                   'Tema 04': '👨\u200d👩\u200d👧\u200d👦 Tema 04', 'Tema 05': '💡Tema 05'}
    temas = {}
    for nome, sheet_name in tema_sheets.items():
        wst2 = wb[sheet_name]
        total_prev = v(wst2,'F4'); total_exec = v(wst2,'G4'); total_saldo = v(wst2,'H4')
        total_pct = total_exec / total_prev if total_prev else 0
        missoes_ies = []
        for r in range(8, 14):
            ies = wst2.cell(r,1).value
            if not ies: continue
            missoes_ies.append({'ies': ies, 'total_previsto': v(wst2,f'G{r}'), 'total_executado': v(wst2,f'H{r}')})
        temas[nome] = {'kpis': {'previsto': total_prev, 'executado': total_exec, 'saldo': total_saldo, 'pct': total_pct, 'status': pct_status(total_pct)},
                        'missoes_por_ies': missoes_ies}
    result['temas'] = temas

    wsb = wb['🎒 Bolsas']
    modalidade_totais = []
    for r in range(3, 11):
        mod = wsb.cell(r,1).value
        if not mod: continue
        modalidade_totais.append({'modalidade': mod, 'total': wsb.cell(r,13).value or 0})
    registros_bolsas = []
    for r in range(30, wsb.max_row+1):
        nome = wsb.cell(r,2).value; modal = wsb.cell(r,4).value; pais = wsb.cell(r,7).value
        if not (nome or modal or pais): continue
        registros_bolsas.append({'modalidade': modal, 'ies_sede': wsb.cell(r,5).value, 'ies_destino': wsb.cell(r,6).value,
            'pais_destino': pais, 'tema': wsb.cell(r,8).value, 'valor_total': wsb.cell(r,13).value or 0, 'status': wsb.cell(r,14).value})
    result['bolsas'] = {'modalidade_totais': modalidade_totais, 'registros': registros_bolsas}

    wsm = wb['✈️Missões']
    cg_por_ano = []
    for r in range(4, 10):
        ano = wsm.cell(r,1).value
        if not ano: continue
        cg_por_ano.append({'ano': ano, 'programada': wsm.cell(r,2).value or 0, 'realizada': wsm.cell(r,3).value or 0,
                            'saldo': wsm.cell(r,4).value or 0, 'pct': wsm.cell(r,5).value or 0})
    temas_por_ano = []
    for r in range(13, 18):
        ano = wsm.cell(r,1).value
        if not ano: continue
        temas_por_ano.append({'ano': ano, 'programada': wsm.cell(r,2).value or 0, 'realizada': wsm.cell(r,3).value or 0,
                               'saldo': wsm.cell(r,4).value or 0, 'pct': wsm.cell(r,5).value or 0})
    registros_missoes = []
    for r in range(26, wsm.max_row+1):
        tipo = wsm.cell(r,2).value
        if not tipo: continue
        registros_missoes.append({'tipo': tipo, 'tema': wsm.cell(r,3).value, 'ies': wsm.cell(r,4).value, 'ano': wsm.cell(r,5).value,
            'destino': wsm.cell(r,6).value, 'participantes': wsm.cell(r,7).value, 'dias': wsm.cell(r,8).value,
            'valor_total': wsm.cell(r,9).value or 0, 'status': wsm.cell(r,10).value})
    result['missoes'] = {'cg_por_ano': cg_por_ano, 'temas_por_ano': temas_por_ano, 'registros': registros_missoes}

    wse = wb['👩\u200d🏫Eventos']
    registros_eventos = []
    for r in range(15, wse.max_row+1):
        titulo = wse.cell(r,3).value
        if not titulo: continue
        registros_eventos.append({'ano': wse.cell(r,2).value, 'titulo': titulo, 'tipo': wse.cell(r,4).value,
            'abrangencia': wse.cell(r,5).value, 'finalidade': wse.cell(r,6).value, 'modalidade': wse.cell(r,7).value,
            'responsavel': wse.cell(r,8).value, 'pais': wse.cell(r,9).value, 'situacao': wse.cell(r,12).value})
    result['eventos'] = {'registros': registros_eventos, 'total': len(registros_eventos)}

    wscm = wb['📢 Comunicação']
    pub_por_tipo = []
    for r in range(2, 9):
        tipo = wscm.cell(r,1).value
        if not tipo: continue
        pub_por_tipo.append({'tipo': tipo, 'qtd': wscm.cell(r,2).value or 0})
    result['comunicacao'] = {'publicacoes_por_tipo': pub_por_tipo, 'visualizacoes_total': wscm.cell(2,4).value or 0}

    registros_paises = []
    for reg in registros_bolsas:
        if reg['pais_destino']:
            registros_paises.append({'origem':'Bolsas','pais':str(reg['pais_destino']).strip(),'pais_en':norm_pais(reg['pais_destino']),'valor':reg['valor_total']})
    for reg in registros_missoes:
        if reg['destino']:
            registros_paises.append({'origem':'Missões','pais':str(reg['destino']).strip(),'pais_en':norm_pais(reg['destino']),'valor':reg['valor_total']})
    for reg in registros_eventos:
        if reg['pais']:
            registros_paises.append({'origem':'Eventos','pais':str(reg['pais']).strip(),'pais_en':norm_pais(reg['pais']),'valor':0})
    agg = {}
    for reg in registros_paises:
        key = reg['pais_en']
        if key not in agg:
            agg[key] = {'pais': reg['pais'], 'pais_en': key, 'total_registros':0, 'valor_total':0, 'por_origem':{}}
        agg[key]['total_registros'] += 1
        agg[key]['valor_total'] += reg['valor']
        agg[key]['por_origem'][reg['origem']] = agg[key]['por_origem'].get(reg['origem'],0) + 1
    result['paises'] = {'registros': registros_paises, 'por_pais': list(agg.values())}

    # qtd_missoes derivadas
    from collections import defaultdict
    qtd_por_ies_ano = defaultdict(int)
    for reg in registros_missoes:
        if reg['ies'] and reg['ano']:
            qtd_por_ies_ano[(reg['ies'], str(reg['ano']))] += 1
    for nome, inst in instituicoes.items():
        for ano_obj in inst['por_ano']:
            ano_obj['qtd_missoes'] = qtd_por_ies_ano.get((nome, str(ano_obj['ano'])), 0)
    qtd_cg_ano = defaultdict(int)
    for reg in registros_missoes:
        if reg['tipo'] == 'Missões CG' and reg['ano']:
            qtd_cg_ano[str(reg['ano'])] += 1
    for ano_obj in result['cg']['por_ano']:
        ano_obj['qtd_missoes'] = qtd_cg_ano.get(str(ano_obj['ano']), 0)
    qtd_tema = defaultdict(int)
    for reg in registros_missoes:
        if reg['tema'] and reg['tema'] != '—':
            qtd_tema[reg['tema']] += 1
    for nome, t in temas.items():
        t['qtd_missoes'] = qtd_tema.get(nome, 0)

    return result

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 atualizar_dashboard.py <planilha.xlsx>")
        sys.exit(1)
    xlsx_path = sys.argv[1]
    data = extrair(xlsx_path)

    idx_path = pathlib.Path(__file__).parent / 'index.html'
    html = idx_path.read_text(encoding='utf-8')
    html = re.sub(r"const DATA = .*?;\n", f"const DATA = {json.dumps(data, ensure_ascii=False)};\n", html, count=1, flags=re.S)
    idx_path.write_text(html, encoding='utf-8')
    print(f"Painel atualizado: {idx_path}")
    print("Agora é só: git add . && git commit -m 'atualiza dados' && git push")

if __name__ == '__main__':
    main()
