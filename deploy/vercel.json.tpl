{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "__API_URL__/api/$1" },
    { "source": "/health", "destination": "__API_URL__/api/v1/health" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
