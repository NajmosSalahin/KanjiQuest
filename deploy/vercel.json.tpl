{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "__API_URL__/api/$1" },
    { "source": "/health", "destination": "__API_URL__/api/v1/health" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
