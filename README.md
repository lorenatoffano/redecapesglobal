# Painel de Controle — Rede CAPES Global

Painel único com navegação lateral, uma seção para cada aba da planilha de controle orçamentário.

## Arquivos
- `index.html` — página principal (contém os dados atuais embutidos)
- `app.js` — lógica de navegação e renderização dos gráficos/tabelas
- `atualizar_dashboard.py` — script para atualizar os dados a partir de uma nova planilha

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser privado)
2. Suba os arquivos `index.html` e `app.js` para a raiz do repositório
3. Vá em **Settings → Pages**
4. Em "Source", selecione a branch `main` e a pasta `/ (root)`
5. Salve — em alguns minutos o link público aparece ali mesmo (formato `https://seunome.github.io/nome-do-repositorio`)

## Como atualizar os dados depois

Sempre que a planilha `CAPES_Global_Controle.xlsx` for atualizada:

```bash
pip install openpyxl
python3 atualizar_dashboard.py CAPES_Global_Controle.xlsx
```

Isso regenera o bloco de dados dentro do `index.html`. Depois é só enviar a
atualização para o GitHub:

```bash
git add .
git commit -m "atualiza dados"
git push
```

O GitHub Pages atualiza sozinho o site publicado em 1-2 minutos.

## Estrutura da navegação

- **Dashboard** — visão geral consolidada
- **Comitê Gestor** — orçamento por ano e por IES (não segue a hierarquia Tema > UF > PPG, igual à aba CG)
- **Instituições** (submenu) — Fiocruz, UFMS, UNILA, UNIR, UFOPA, UFPI
- **Temas** (submenu) — Visão Geral + Tema 01 a 05
- **Bolsas** — registro de bolsistas por modalidade, IES e país
- **Missões** — programadas vs. realizadas, lista completa
- **Relações Internacionais** — mapa de calor por país (bolsas + missões + eventos)
- **Eventos** — controle de eventos institucionais
- **Comunicação** — publicações e alcance

## Observação sobre os KPIs

A planilha não tem os mesmos campos da referência visual que você me mandou
(ex: "Valor Liberado" / "Total detalhado" / "Saldo a detalhar"). Adaptei os
cards para os campos que sua planilha realmente controla: **Previsto**,
**Executado**, **Saldo** e **% Executado**, com um status calculado
automaticamente (Não iniciado / Em andamento / Concluído) a partir do
percentual de execução.
