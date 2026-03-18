@echo off
docker compose -f docker-compose.minio.yml up -d
echo MinIO started.
echo API: http://localhost:9000
echo Console: http://localhost:9001
echo User: minioadmin
echo Password: minioadmin
