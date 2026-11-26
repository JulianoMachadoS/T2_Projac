#!/bin/sh
# Faz o que o instalar.sh do T1 fazia, mas sozinho dentro do docker compose up.
# Roda uma vez por subida; se ja estiver configurado, so confere e termina.
set -e

IEDUCAR_TOKEN=t2projac-ieducar-token
PROJETO=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$(hostname)")
MOODLE=$(docker ps -q -f "label=com.docker.compose.project=$PROJETO" -f label=com.docker.compose.service=moodle)

echo "[configurador] esperando o banco do i-Educar..."
until docker exec ieducar-postgres pg_isready -q; do sleep 2; done

# token fixo ja existe? entao o i-Educar ja foi instalado (nao roda o seed de novo, senao duplica turmas)
TEM_TOKEN=$(docker exec ieducar-postgres psql -U ieducar -tAc "select count(*) from personal_access_tokens where name = 'integracao'" 2>/dev/null || echo 0)
if [ "$TEM_TOKEN" = "0" ]; then
  echo "[configurador] instalando o i-Educar (primeira vez, demora alguns minutos)..."
  docker exec ieducar-php sh -c '[ -f .env ] || cp .env.example .env'
  docker exec ieducar-php composer install --no-interaction
  docker exec ieducar-php composer set-permissions || echo "aviso: permissoes nao ajustadas, seguindo"
  docker exec ieducar-php php artisan key:generate --force
  docker exec ieducar-php php artisan storage:link || echo "aviso: storage:link nao criado, seguindo"
  docker exec ieducar-php php artisan migrate --force
  docker exec ieducar-php php artisan db:seed --force
  docker exec ieducar-php php artisan db:seed --class=DemoSeeder --force
  # token fixo (o Sanctum guarda o sha256 dele); e trabalho de faculdade, pode ficar publico
  docker exec ieducar-php php artisan tinker --execute "
    \$admin = App\User::query()->whereHas('employee', fn (\$q) => \$q->where('matricula', 'admin'))->first();
    \$admin->tokens()->create(['name' => 'integracao', 'token' => hash('sha256', '$IEDUCAR_TOKEN'), 'abilities' => ['*']]);
  "
fi
echo "[configurador] i-Educar pronto"

echo "[configurador] esperando o Moodle terminar de instalar..."
until wget -q -O /dev/null http://moodle:8080/login/index.php; do sleep 10; done
# -u daemon: mesmo usuario do apache, senao o cache do moodle fica com dono root
docker exec -i -u daemon "$MOODLE" php < /dadosIniciais/moodle/configurar_webservices.php
echo "[configurador] Moodle pronto"
