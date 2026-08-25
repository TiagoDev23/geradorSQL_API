# Banco demo — Meteorologia e Impactos Climáticos

Scripts SQL do banco PostgreSQL **externo** usado como cenário de demonstração
e validação da plataforma.

Documentação completa da estrutura:
[`docs/METEOROLOGY_DATABASE.md`](../../docs/METEOROLOGY_DATABASE.md).

> **Dados sintéticos.** Gerados por expressões determinísticas. Não provêm de
> nenhum serviço meteorológico e não devem ser usados para decisão real.

---

## Contexto arquitetural

Este banco representa um PostgreSQL **cadastrado pelo usuário** da ferramenta.
A aplicação o acessa exclusivamente por `node-postgres`.

Não use Prisma aqui: não há models, não há migrations e o `schema.prisma`
pertence apenas ao banco interno da plataforma.

| Item | Valor |
|---|---|
| Container | `gerador-api-demo-db` |
| Host / porta | `127.0.0.1` : `5435` |
| Banco | `gerador_api_demo` |
| Usuário | `demo` |

A senha fica em `.env`, na raiz do repositório, e não é registrada aqui.

---

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `01-schema.sql` | Schemas, tabelas, constraints e comentários |
| `02-indexes.sql` | Índices, com a justificativa de cada um |
| `03-views.sql` | Views de apoio |
| `04-seed.sql` | Carga inicial pequena, adequada ao desenvolvimento |
| `scripts/generate-observations.sql` | Geração parametrizável de volume |

Todos são **idempotentes**: reexecutar não duplica objetos nem registros.
Nenhum deles contém `DROP`.

Execute na ordem numérica — `01` antes de `02`, e assim por diante.

---

## Aplicar a estrutura

Pelo container, sem expor a senha:

```bash
docker exec -i gerador-api-demo-db psql -U demo -d gerador_api_demo -v ON_ERROR_STOP=1 < 01-schema.sql
```

Repita para `02-indexes.sql`, `03-views.sql` e `04-seed.sql`.

O `04-seed.sql` termina imprimindo a contagem de cada tabela.

---

## Carga inicial

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

As observações cobrem 20 dias de medições horárias para cada estação:
90 × 20 × 24 = 43.200 registros.

---

## Gerar volume para testes

O gerador aumenta **apenas** `meteorologia.observacoes`. O padrão é pequeno de
propósito; volumes maiores exigem parâmetro explícito.

```bash
docker exec -i gerador-api-demo-db psql -U demo -d gerador_api_demo -v dias=46 < scripts/generate-observations.sql
```

| Parâmetro | Padrão | Efeito |
|---|---|---|
| `dias` | 1 | Janela retroativa gerada |
| `intervalo` | 60 | Minutos entre medições |
| `estacoes` | todas | Limita a quantidade de estações |

Registros gerados ≈ `estações × dias × (1440 / intervalo)`.

Aumente em incrementos e verifique o espaço em disco antes de passar de um
milhão de registros. Como referência, as 43.200 observações da carga inicial
ocupam cerca de 8,4 MB com os índices.

---

## Cuidados

- Não execute `docker compose down -v`: isso apaga o volume e os dados.
- Não aponte a `DATABASE_URL` da aplicação para este banco — ela pertence ao
  banco interno da plataforma, na porta 5434.
- Os scripts não removem dados. Para recomeçar do zero, remova os objetos
  manualmente e de forma consciente.
