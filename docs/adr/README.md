# Registros de decisão de arquitetura (ADRs)

Formato: template *Decision Record* de GIG Cymru / NHS Wales
(https://github.com/architecture-decision-record/architecture-decision-record/tree/main/locales/en-001/templates/decision-record-template-by-gig-cymru-nhs-wales).

**Autores:** Juliano Machado da Silva e João Pedro Madruga

| ADR | Decisão | Status |
|---|---|---|
| [0001](0001-decomposicao.md) | Decomposição: um serviço por módulo de domínio do T1 | Aceito |
| [0002](0002-comunicacao.md) | Comunicação: assíncrona entre os serviços (RabbitMQ), síncrona nas bordas | Aceito |
| [0003](0003-resiliencia.md) | Resiliência: idempotência, retry com backoff, DLQ e circuit breaker | Aceito |
| [0004](0004-stack.md) | Stack: NestJS, RabbitMQ, PostgreSQL, OpenTelemetry e Docker Compose | Aceito |
| [0005](0005-api-gateway.md) | API Gateway com nginx, sem service mesh (ponto extra) | Aceito |
