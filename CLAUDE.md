# PAL_AERIAL Archive — Project Context


## What this is
A static online archive of ~700 scanned aerial photographs (Palestine, 1940s).
No backend. No database. No auth. Everything is static.

## Stack
- **Astro** — static site framework
- **React** — interactive islands only (the two-pane UI)
- **MapLibre GL JS** — map with image overlays
- **Plain CSS** — CSS custom properties, no framework
- **Cloudflare Pages** — hosting
- **Cloudflare R2** — image + metadata storage

## Data
`metadata.json` is fetched from R2 at startup. It is a JSON array of image records:

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
  "display_webp": "https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/originals/PAL_AERIAL_0001.webp",
  "geo_webp": "https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/geo/PAL_AERIAL_0001.webp",
  "thumb_jpg": "https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/thumbs/PAL_AERIAL_0001.jpg"
}
```

- `bounds` is WGS84 `[W, S, E, N]`, null if not georeferenced
- `geo_webp` only present if georeferenced
- ~150 georeferenced images, ~700 total

**metadata.json URL:**
`https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/metadata.json`

## UI Layout
Two resizable panes, each collapsible:

```
┌─────────────────────────┬──────────────────────────┐
│   MAP PANE (left)       │   COLLECTION PANE (right) │
│   MapLibre map          │   Grid or table view      │
│   Geo image overlays    │   Filterable / sortable   │
│                         │                           │
│                         │   ┌─────────────────────┐ │
│                         │   │  EXPANDED ITEM      │ │
│                         │   │  inline on select   │ │
│                         │   └─────────────────────┘ │
└─────────────────────────┴──────────────────────────┘
```

- Default: 50/50 split
- Drag handle to resize
- Each pane collapsible to a slim bar
- Mobile: stacks vertically

## Map pane
- Basemap: MapLibre + MapTiler or Stadia (free tier)
- Each georeferenced image = individual image overlay using `bounds`
- Global opacity slider for all overlays
- Clicking overlay → selects image, expands it in collection
- Active image gets highlight (glow or opacity boost)
- Toggle to hide all overlays

## Collection pane
Two view modes (toggle): **Grid** and **Table**

Grid: thumbnails, place name, date
Table: thumbnail (small), original name, current name, date, flight ID, georef badge — sortable

Filtering/search:
- Text search: place names + notes
- Filter: georeferenced / not georeferenced
- Filter: date range
- Filter: flight ID

## Expanded item view (inline, full collection pane width)
Opens accordion-style below the selected card/row (Google Images style):
- Large image viewer — `display_webp`, toggle to `geo_webp` if available
- Zoomable / pannable
- Full metadata display
- "Focus on map" button (flies map to bounds, georeferenced only)
- Prev / Next within current filtered set
- Copyable permalink: `/?id=PAL_AERIAL_0001`
- Close button

## URL state
| Param | Example | Meaning |
|---|---|---|
| `id` | `?id=PAL_AERIAL_0001` | Selected image |
| `view` | `?view=grid` | Collection view mode |
| `q` | `?q=haifa` | Search query |

## Design notes
- Dark-first (map context)
- Hebrew place names may appear in data — no RTL UI needed, just display as-is
- CSS custom properties for all colours and spacing
- No UI component library
