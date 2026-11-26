#!/bin/sh
# Teste de ponta a ponta do T2: cria uma turma no i-Educar, dispara a deteccao pelo gateway,
# espera o fluxo assincrono (academico -> sincronizacao -> plataforma-aprendizagem) e confere
# o vinculo e o curso no Moodle. No fim apaga o que criou.
# Rodar na raiz, com o ambiente de pe. Versao do T1 em "arquivos T1/scripts/testar-integracao.sh".
cd "$(dirname "$0")"
# Git Bash (Windows): nao deixa ele trocar caminhos como /opt/... por C:/... nos comandos do docker
export MSYS_NO_PATHCONV=1

API="http://localhost:8000/api"
CHAVE="X-Api-Key: projac"
MOODLE_TOKEN=t2projacmoodletoken0000000000000

echo "1) Criando uma turma nova no i-Educar (copia da turma 3)..."
TURMA=$(docker compose exec -T php php artisan tinker --execute="\$t = App\Models\LegacySchoolClass::find(3)->replicate(); \$t->nm_turma = 'Turma Teste Integracao'; \$t->save(); echo \$t->cod_turma;" | tail -n 1)
echo "   turma criada: $TURMA"

echo "2) Disparando a deteccao pelo gateway (POST $API/academico/deteccoes)..."
curl -s -X POST -H "$CHAVE" -H "X-Correlation-ID: teste-turma-$TURMA" "$API/academico/deteccoes"
echo ""

echo "3) Esperando o vinculo ficar CRIADO (fluxo assincrono, ate 60 s)..."
VINCULO=""
for i in $(seq 1 30); do
  VINCULO=$(curl -s -H "$CHAVE" "$API/sincronizacao/vinculos" | grep -o "{\"turmaId\":$TURMA,[^}]*}")
  echo "$VINCULO" | grep -q '"status":"CRIADO"' && break
  sleep 2
done
echo "   vinculo: ${VINCULO:-nao encontrado}"
CURSO_VINCULO=$(echo "$VINCULO" | grep -o '"cursoId":[0-9]*' | grep -o '[0-9]*$')

echo "4) Conferindo o curso no Moodle (idnumber ieducar-turma-$TURMA)..."
CURSO=$(curl -s "http://localhost:8080/webservice/rest/server.php?wstoken=$MOODLE_TOKEN&wsfunction=core_course_get_courses_by_field&moodlewsrestformat=json&field=idnumber&value=ieducar-turma-$TURMA" | grep -o '"courses":\[{"id":[0-9]*' | grep -o '[0-9]*$')
echo "   curso no Moodle: ${CURSO:-nao encontrado}"

echo "5) Mesmo correlation id nos logs dos 3 servicos:"
docker compose logs academico sincronizacao plataforma-aprendizagem 2>/dev/null | grep "teste-turma-$TURMA" | cut -c1-160

if [ -n "$CURSO" ] && [ "$CURSO" = "$CURSO_VINCULO" ]; then
  RESULTADO="OK: a turma $TURMA virou o curso $CURSO e o vinculo foi gravado"
else
  RESULTADO="FALHOU"
fi

# limpeza: o teste nao deixa a turma, o curso nem os registros dos servicos pra tras
echo "6) Apagando o que o teste criou..."
docker compose exec -T php php artisan tinker --execute="App\Models\LegacySchoolClass::find($TURMA)?->delete();" > /dev/null
[ -n "$CURSO" ] && docker compose exec -T -u daemon moodle php -r "define('CLI_SCRIPT', true); require '/opt/bitnami/moodle/config.php'; require_once \$CFG->dirroot.'/course/lib.php'; delete_course($CURSO, false);" > /dev/null
docker compose exec -T sincronizacao-db psql -U sincronizacao -qtA -c "delete from vinculo_turma_curso where turma_id = $TURMA"
docker compose exec -T academico-db psql -U academico -qtA -c "delete from turma_detectada where turma_id = $TURMA"

echo ""
echo "$RESULTADO"
[ "$RESULTADO" != "FALHOU" ]
