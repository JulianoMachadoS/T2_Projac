#!/bin/sh
# Atalho para subir o T2. O "docker compose up" ja faz tudo sozinho: o container
# configurador instala o i-Educar e liga a API do Moodle (no T1 este script fazia isso).
# Versao do T1 guardada em "arquivos T1/scripts/instalar.sh".
set -e
cd "$(dirname "$0")"
# Git Bash (Windows): nao deixa ele trocar caminhos como /opt/... por C:/... nos comandos do docker
export MSYS_NO_PATHCONV=1

echo "Subindo o ambiente (na primeira vez leva alguns minutos)..."
docker compose up -d --build

echo "Esperando os servicos responderem pelo gateway..."
for servico in academico sincronizacao plataforma; do
  until curl -s -o /dev/null -w '%{http_code}' -H 'X-Api-Key: projac' "http://localhost:8000/api/$servico/health" | grep -q 200; do
    sleep 5
  done
done

echo ""
echo "Pronto!"
echo "  i-Educar:     http://localhost          (admin / 123456789)"
echo "  Moodle:       http://localhost:8080     (user / bitnami)"
echo "  API Gateway:  http://localhost:8000/api (cabecalho X-Api-Key: projac)"
echo "  RabbitMQ:     http://localhost:15672    (projac / projac)"
echo "  Jaeger:       http://localhost:16686"
echo ""
echo "A deteccao roda sozinha a cada 30 s: as turmas ativas do i-Educar viram cursos no Moodle."
