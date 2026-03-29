# PAL AERIAL — Archive Explorer

A static online archive of ~700 scanned aerial photographs of Palestine from the 1940s.

## Stack

- **Astro** — static site framework
- **React** — interactive islands (two-pane UI)
- **MapLibre GL JS** — map with georeferenced image overlays
- **Plain CSS** — CSS custom properties, no framework
- **Cloudflare Pages** — hosting
- **Cloudflare R2** — image and metadata storage

## Project Structure

```text
/
├── public/
├── src/
│   ├── components/
│   │   ├── Archive.tsx        — main layout: map pane + collection pane
│   │   ├── MapPane.tsx        — MapLibre map with image overlays
│   │   ├── CollectionPane.tsx — grid/table view with filtering and sorting
│   │   └── AboutPane.tsx      — renders about.md content
│   ├── content/
│   │   └── about.md           — about page content (editable)
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
└── package.json
```

## Data

`metadata.json` is fetched from R2 at startup. Each record:

```json
{
  "id": "PAL_AERIAL_0001",
  "place_name_original": "...",
  "place_name_current": "...",
  "date": "1948-04-16",
  "flight_id": "...",
  "notes": "...",
  "is_georeferenced": true,
  "bounds": [W, S, E, N],
  "display_webp": "...",
  "geo_webp": "...",
  "thumb_jpg": "..."
}
```

- `bounds` is WGS84 `[W, S, E, N]`, null if not georeferenced
- ~150 georeferenced images, ~700 total

## Commands

| Command             | Action                                      |
| :------------------ | :------------------------------------------ |
| `npm install`       | Installs dependencies                       |
| `npm run dev`       | Starts local dev server at `localhost:4321` |
| `npm run build`     | Build production site to `./dist/`          |
| `npm run preview`   | Preview build locally                       |
