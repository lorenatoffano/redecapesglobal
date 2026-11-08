# Painel de Controle — Rede CAPES Global (PDG/SMIR)

Painel único com navegação lateral. Os dados vêm das planilhas de controle da Rede e são embutidos no `index.html` pelo script `atualizar_dashboard.py`.

Endereço: https://lorenatoffano.github.io/redecapesglobal/

## Arquivos (subir na raiz do repositório)

| Arquivo | Para que serve |
|---|---|
| `index.html` | Página principal: estilo e **dados embutidos** (é o que muda a cada atualização) |
| `app.js` | Lógica: menu, páginas, gráficos, mapas, filtros |
| `atualizar_dashboard.py` | Script que lê as planilhas e regenera os dados do `index.html` |
| `logo-capes-global.png` | Logo no topo da barra lateral |
| `logo-instituicoes.png` | Régua das instituições no rodapé da barra lateral |
| `estrutura-rede.png` | Imagem de apoio da aba Sobre a Rede |
| `favicon.png`, `apple-touch-icon.png` | Ícone da aba do navegador e da tela inicial do celular |

Bibliotecas (Chart.js, d3, topojson, mapa-múndi) são carregadas da internet (jsDelivr); não precisam ser enviadas.

## Abas do painel

Sobre a Rede (abertura padrão) · Dashboard · Comitê Gestor · Instituições · Temas · Bolsas · Missões · Relações Internacionais · Parcerias Prioritárias · Eventos · Comunicação · Metas · PPG's

## Como atualizar os dados

Planilhas usadas:

- `CAPES_Global_Controle.xlsx` — obrigatória (orçamento, bolsas, missões, eventos, RI, comunicação)
- `Dados_PPGS.xlsx` — opcional (aba PPG's e cruzamento com bolsas)
- `Parcerias_Prioritarias.xlsx` — opcional (aba Parcerias Prioritárias)

Se uma planilha opcional não for informada, o painel mantém os dados que já tem dela.

```bash
pip install openpyxl
python3 atualizar_dashboard.py CAPES_Global_Controle.xlsx Dados_PPGS.xlsx Parcerias_Prioritarias.xlsx
```

Só controle: `python3 atualizar_dashboard.py CAPES_Global_Controle.xlsx`

O script deve estar na mesma pasta do `index.html`. Depois, envie para o GitHub:

- **Pelo navegador:** Add file → Upload files → arraste o `index.html` (e o `app.js` ou o script, se mudaram) → Commit changes. Aguarde 1–3 minutos e use Ctrl+Shift+R.
- **Pelo terminal:** `git add . && git commit -m "atualiza dados" && git push`

Mudou só a planilha? Basta subir o `index.html`.

### Cuidados com a planilha

- O script localiza colunas e tabelas pelo **nome do cabeçalho** (Bolsas, Missões, Eventos, Comunicação). Pode inserir colunas ou linhas, mas não renomeie os cabeçalhos.
- Na aba Bolsas, as colunas lidas são: Modalidade, País de Origem, IES Sede, PPG Sede / Anfitrião, IES Destino, País Destino, IES / TEMA, Data Início, Data Fim, Valor Total (R$), Status.
- Países podem ser escritos em português; o script traduz para o mapa. Bolsa com mais de um destino (ex.: `Portugal / Moçambique`) é separada por `/` ou `;`.
- Nomes de bolsistas **não** são levados para o painel (o site é público).

## Mapas

- **Mapas de calor** (Dashboard, Bolsas, Missões, Eventos, RI, Parcerias): planisfério com o **sul no topo**, no modelo do IBGE. O centro do mapa é a constante `MAP_CENTER_LON` no `app.js`.
- **Mapa de fluxo** (aba Bolsas): país de origem → país de destino, com filtros (modalidade, tema, IES, continente), zoom (botões ou Ctrl + rolagem), gráficos e tabelas. Aparece sozinho conforme os registros da planilha.
- **Mapa do Brasil** (Sobre a Rede): instituições da Rede e unidades da Fiocruz.

## Bolsas por PPG

Seção na aba Bolsas, baseada na coluna "PPG Sede / Anfitrião":

- O texto da coluna (ex.: `ioc - biologia celular e molecular 31010016004p9`) é separado em **unidade**, **nome** e **código CAPES**.
- O código liga cada bolsa ao PPG da aba PPG's (nota, docentes, discentes).
- Os códigos dos 82 PPGs vêm do site da Rede (https://redeconectacapesglobal.fiocruz.br/programas) e ficam na lista `PPG_CODIGOS` do `atualizar_dashboard.py`. **Quando a Rede incluir um programa novo, acrescente a linha lá.**
- Nomes de PPG que diferem do site são ligados por `PPG_ALIAS` (mesmo arquivo). Se um PPG da planilha de PPGs ficar sem código, o script não o liga; adicione um apelido.
- Cada bolsa conta uma vez no PPG, mesmo com mais de um país de destino.

## Dicas e solução de problemas

- **Página sem as mudanças:** Ctrl+Shift+R. O GitHub Pages pode demorar alguns minutos.
- **Mapa não aparece:** verifique a conexão (as bibliotecas e o mapa vêm da internet). As tabelas continuam funcionando.
- **Gráficos ou tabelas vazios:** normalmente a planilha está sem registros naquela aba. Não é erro do painel.
- **Erro ao rodar o script:** confira se o `index.html` está na mesma pasta e se os cabeçalhos da planilha não foram renomeados.
- **Celular e tablet:** o layout se adapta; no celular o menu abre pelo botão de três linhas.
