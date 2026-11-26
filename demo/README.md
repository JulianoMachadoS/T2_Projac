# Demonstração ao vivo

Abre o Chrome e executa, na frente de quem assiste, um roteiro descrito em `roteiros.json`. Cada passo aparece numa faixa azul no rodapé da tela. Os passos marcados com ✔ são conferidos: se um falhar, a faixa fica vermelha, o terminal mostra `✘` e o resultado é `FALHOU`.

## Como rodar

Pré-requisitos: o ambiente no ar (`docker compose up -d` na raiz), Node.js 20+ e Google Chrome.

```bash
cd demo
npm install                            # só na primeira vez
node demo.mjs                          # lista os cenários
node demo.mjs sincronizacao            # caminho feliz (~1 min)
node demo.mjs moodle-fora              # Moodle fora do ar (~2 min)
node demo.mjs sincronizacao --passo    # espera Enter antes de cada passo (apresentação)
node demo.mjs sincronizacao --fechar   # fecha o navegador no fim sem perguntar
```

Sem o Chrome instalado: `npx playwright install chromium`. No Windows, rode pelo Git Bash ou pelo WSL, porque os comandos usam `sh`.

## Cenário `sincronizacao`: uma turma nova vira um curso

| # | Passo | Comando ou chamada |
|---|---|---|
| 1 | Os 3 serviços no ar | `GET http://localhost:8000/api/academico/health` (e `/sincronizacao/health`, `/plataforma/health`), com `X-Api-Key: projac` |
| 2 | Criar uma turma no i-Educar (cópia da turma 3) | `docker compose exec -T php php artisan tinker --execute='$t = App\Models\LegacySchoolClass::find(3)->replicate(); $t->nm_turma = "Turma Demo Ao Vivo"; $t->save(); echo $t->cod_turma;'` |
| 3 | Pedir a detecção agora | `POST http://localhost:8000/api/academico/deteccoes` com `X-Correlation-ID: demo-<turma>` |
| 4 | Ver a turma no i-Educar | login em `http://localhost/login` (`admin` / `123456789`) e abre `http://localhost/intranet/educar_turma_det.php?cod_turma=<turma>` |
| 5 | ✔ Vínculo `CRIADO` (espera até 60 s) | `GET http://localhost:8000/api/sincronizacao/vinculos`, a cada 2 s |
| 6 | ✔ Um curso só no Moodle, com o mesmo id | `GET http://localhost:8080/webservice/rest/server.php?wstoken=...&wsfunction=core_course_get_courses_by_field&field=idnumber&value=ieducar-turma-<turma>` |
| 7 | Ver o curso no Moodle | login em `http://localhost:8080/login/index.php` (`user` / `bitnami`) e abre `http://localhost:8080/course/edit.php?id=<curso>`, com o *Course ID number* destacado |
| 8 | ✔ Mesmo `correlationId` nos 3 serviços | `docker compose logs academico sincronizacao plataforma-aprendizagem \| grep -E '"turmaId":<turma>[,}]'` |
| 9 | Trace no Jaeger | `GET http://localhost:16686/api/traces?service=academico&operation=POST&lookback=15m&limit=1` e abre `http://localhost:16686/trace/<id>` |
| 10 | Mensagem final | — |

## Cenário `moodle-fora`: o Moodle cai e nada se perde

| # | Passo | Comando ou chamada |
|---|---|---|
| 1 | Anotar quantas mensagens a DLQ tem | `GET http://localhost:15672/api/queues/%2F/cursos.dlq` (`projac` / `projac`) |
| 2 | Derrubar o Moodle | `docker compose stop moodle && docker compose ps -a moodle` |
| 3 | Criar uma turma e pedir a detecção | o mesmo `tinker` do outro cenário ("Turma Demo Moodle Fora") + `POST /api/academico/deteccoes` |
| 4 | ✔ Vínculo `PENDENTE` durante as 5 entregas e depois `FALHOU` (até 180 s) | `GET /api/sincronizacao/vinculos`, a cada 2 s |
| 5 | ✔ A `cursos.dlq` tem uma mensagem a mais | `GET http://localhost:15672/api/queues/%2F/cursos.dlq` |
| 6 | Religar o Moodle e esperar responder | `docker compose start moodle` + `GET http://localhost:8080/login/index.php` até responder |
| 7 | Reprocessar a turma | `POST http://localhost:8000/api/sincronizacao/vinculos/<turma>/reprocessar` |
| 8 | ✔ Vínculo `CRIADO` | `GET /api/sincronizacao/vinculos` |
| 9 | ✔ Um curso só no Moodle | a mesma busca pelo `idnumber` do outro cenário |
| 10 | Ver o curso no Moodle | o mesmo login e a mesma tela do outro cenário |
| 11 | Mensagem final | — |

## Limpeza (roda sempre, mesmo se um passo falhar)

```bash
docker compose start moodle                      # só no moodle-fora
docker compose exec -T php php artisan tinker --execute='App\Models\LegacySchoolClass::find(<turma>)?->delete();'
docker compose exec -T -u daemon moodle php -r 'define("CLI_SCRIPT", true); require "/opt/bitnami/moodle/config.php"; require_once $CFG->dirroot."/course/lib.php"; delete_course(<curso>, false);'
docker compose exec -T sincronizacao-db psql -U sincronizacao -qtA -c 'delete from vinculo_turma_curso where turma_id = <turma>'
docker compose exec -T academico-db psql -U academico -qtA -c 'delete from turma_detectada where turma_id = <turma>'
```

A mensagem que foi para a `cursos.dlq` no cenário `moodle-fora` continua lá. Ela não atrapalha nada.

## Como o roteiro é escrito

Cada cenário em `roteiros.json` tem `descricao`, `passos` e `limpeza`. Um passo pode combinar estes campos:

| Campo | O que faz |
|---|---|
| `legenda` | texto da faixa azul |
| `abrir` | abre uma URL no navegador |
| `preencher` / `clicar` | digita nos campos (seletor → texto) e clica (usado nos logins) |
| `destacar` | rola até um elemento e contorna em laranja |
| `comando` | roda um comando na raiz do projeto; `guardar` salva a última linha, `exibir` mostra a saída na tela |
| `http` | `"GET /rota"` vai pelo gateway com a chave; URL completa vai direto |
| `encontrar` / `lista` | procura o item na resposta (ex.: o vínculo da turma) |
| `esperar` / `ate` | repete a cada 2 s até os campos baterem, por no máximo `ate` segundos; `">N"` compara número |
| `quantidade` | exige exatamente N itens encontrados (ex.: 1 curso só) |
| `guardar` | salva campos da resposta para os passos seguintes, usados como `{{nome}}` |
| `pausa` | espera N segundos para quem assiste ler |
| `seTiver` | só roda se o valor já foi guardado (usado na limpeza) |

Para conferir uma execução depois, rode com `DEMO_CAPTURAS=<pasta>`: o script salva uma imagem da tela a cada passo.
