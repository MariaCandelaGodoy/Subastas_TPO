gcloud run deploy bidvault-api \
  --image gcr.io/bidvault-api-project/bidvault-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DB_HOST=mysql://interchange.proxy.rlwy.net:59171/railway,DB_PORT=8080,DB_NAME=railway,DB_USER=root,DB_PASSWORD=ONjcyjmykxqyeLewGWssWGNWTHAqtXHj