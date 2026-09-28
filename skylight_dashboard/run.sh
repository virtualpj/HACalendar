#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Skylight Dashboard..."

export GOOGLE_CLIENT_ID=$(bashio::config 'google_client_id')
export GOOGLE_CLIENT_SECRET=$(bashio::config 'google_client_secret')
export WEATHER_ENTITY_ID=$(bashio::config 'weather_entity_id')
export PORT=8099
export DATA_DIR="/data"
export SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

cd /app/server
exec node index.js
