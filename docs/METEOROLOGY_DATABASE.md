# Banco de demonstração

Banco PostgreSQL usado para demonstrar a plataforma sobre um schema realista.
Ele é tratado como qualquer banco externo: acessado por `node-postgres`, jamais
por Prisma ([D2](DECISIONS.md), [D15](DECISIONS.md)).

## Objetivo

Os dados são **sintéticos**, gerados por scripts próprios, e não têm vínculo com
nenhum serviço meteorológico. O domínio foi escolhido porque séries temporais
crescem por construção — o volume é função de estações, frequência e tempo — e
porque produz naturalmente consultas parametrizadas por estação e intervalo, que
é a forma de endpoint que a plataforma publica.

## Acesso

| | |
|---|---|
| Banco | `gerador_api_demo` |
| Container | `gerador-api-demo-db` |
| Host / porta | `127.0.0.1:5435` fora do Docker; `postgres-demo:5432` dentro da rede do compose |
| Usuário | `demo` (senha em `POSTGRES_DEMO_PASSWORD`) |

## Estrutura

Três schemas de domínio, além de `public`, vazio e mantido para verificar o
comportamento da introspecção diante de um schema sem objetos.

| Schema | Objeto | Tipo | Finalidade |
|---|---|---|---|
| `referencia` | `estados` | tabela | unidades federativas |
| `referencia` | `municipios` | tabela | municípios, vinculados a um estado |
| `referencia` | `estacoes` | tabela | estações de medição, vinculadas a um município |
| `referencia` | `tipos_evento` | tabela | classificação dos eventos climáticos |
| `meteorologia` | `observacoes` | tabela | medições horárias por estação |
| `meteorologia` | `resumos_diarios` | tabela | agregação diária por estação |
| `meteorologia` | `previsoes` | tabela | previsões por município |
| `meteorologia` | `eventos_climaticos` | tabela | ocorrências classificadas por tipo |
| `meteorologia` | `vw_observacoes_detalhadas` | view | observações com estação, município e UF |
| `impactos` | `impactos_climaticos` | tabela | impactos atribuídos a um evento |
| `impactos` | `vw_resumo_eventos` | view | eventos com seus impactos consolidados |

## Chaves e relacionamentos

São nove chaves estrangeiras, das quais **sete atravessam schemas** — apenas as
duas internas a `referencia` ficam no mesmo schema. Esse é o ponto central da
base: exercitar a introspecção em ambiente multi-schema.

```text
referencia.estados
   └── referencia.municipios
          ├── referencia.estacoes
          │      ├── meteorologia.observacoes
          │      └── meteorologia.resumos_diarios
          ├── meteorologia.previsoes
          ├── meteorologia.eventos_climaticos ── impactos.impactos_climaticos
          └── impactos.impactos_climaticos

referencia.tipos_evento
   └── meteorologia.eventos_climaticos
```

`meteorologia.resumos_diarios` é a única tabela sem chave sintética: sua chave
primária é composta por `(estacao_id, data)`. A escolha é deliberada — um resumo
diário *é* a combinação de uma estação com um dia. Para a introspecção, essa
tabela verifica se a ordem das colunas na chave é preservada e se a chave é
reconhecida como um conjunto, e não como duas independentes.

Há ainda constraints `UNIQUE` compostas, entre elas
`observacoes(estacao_id, observado_em)` e
`previsoes(municipio_id, gerada_em, prevista_para)`, esta última com três
colunas.

Onze índices são criados explicitamente, sobretudo sobre colunas temporais e
chaves estrangeiras, para que as consultas por intervalo tenham plano razoável.

## Volume

| Tabela | Registros |
|---|---|
| `referencia.estados` | 27 |
| `referencia.municipios` | 81 |
| `referencia.estacoes` | 90 |
| `referencia.tipos_evento` | 6 |
| `meteorologia.observacoes` | 43.200 |
| `meteorologia.resumos_diarios` | 1.890 |
| `meteorologia.previsoes` | 405 |
| `meteorologia.eventos_climaticos` | 81 |
| `impactos.impactos_climaticos` | 121 |

As observações correspondem a 90 estações × 20 dias × 24 horas. Apenas essa
tabela é ampliada em testes de volume; as demais permanecem estáveis.

## O que a base permite demonstrar

- introspecção de múltiplos schemas, tabelas e views;
- chaves primárias simples e composta;
- chaves estrangeiras cruzando schemas;
- constraints `UNIQUE` simples e compostas;
- consultas parametrizadas por estação, município e intervalo de tempo;
- junções entre schemas e agregações temporais;
- volume moderado, suficiente para exercitar limite de linhas e truncamento.

## Reprodutibilidade

Scripts em `infra/demo-database/`, aplicados em ordem:

| Arquivo | Conteúdo |
|---|---|
| `01-schema.sql` | schemas, tabelas e constraints |
| `02-indexes.sql` | índices explícitos |
| `03-views.sql` | views |
| `04-seed.sql` | dados de referência e carga inicial |
| `scripts/generate-observations.sql` | geração das observações horárias |

O `README.md` do diretório descreve a ordem de execução. A carga é
determinística: reexecutar os scripts em um banco vazio reproduz a mesma
estrutura e o mesmo volume.

## Limitações

Os valores são gerados por funções determinísticas com variação sazonal
simulada; não representam medições reais nem servem para qualquer análise
climática. A base existe para exercitar a plataforma.
