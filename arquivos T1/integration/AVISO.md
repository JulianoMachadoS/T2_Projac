# Monólito do T1 (referência)

Este é o serviço de integração do **T1**: um monólito modular em NestJS com arquitetura hexagonal.

- Está aqui só para **referência e comparação** com o T2 (ver `docs/architecture.md`).
- **Não sobe** no `docker compose up` do T2.
- No T2, cada módulo dele virou um microsserviço em `servicos/`:

| Módulo do T1 (`src/`) | Serviço do T2 |
|---|---|
| `academico/` | `servicos/academico` |
| `sincronizacao/` | `servicos/sincronizacao` |
| `plataforma-aprendizagem/` | `servicos/plataforma-aprendizagem` |

As chamadas de método entre os módulos viraram mensagens no RabbitMQ, e o banco único virou um banco por serviço.
