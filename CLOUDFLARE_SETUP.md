## R2 CORS Policy

Set in Cloudflare dashboard → R2 → pal-aerial → Settings → CORS:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:4321",
      "https://taipinc.github.io"
    ],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

This restricts image loading to our own domains only, preventing other sites
from hotlinking images and consuming R2 bandwidth.
