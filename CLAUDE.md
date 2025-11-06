# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

StoryCorps Interview Map is a static web application that displays interview locations on an interactive globe-view map using Mapbox GL JS v3. It provides three time range views (12 months, 10 years, all-time) with category filtering for User Generated vs Signature interviews.

## Architecture

### Frontend (Static Web App)
- **index.html**: Single page application structure with time range toggles and filters
- **script.js**: Map initialization, Mapbox clustering, dataset switching, category filtering
- **styles.css**: StoryCorps brand styling with Gotham typography
- **JSON data files**: Three pre-loaded datasets for instant time range switching

### Data Pipeline (Python + BigQuery)
- **fetch_interviews.py**: Generates all three JSON datasets from BigQuery
- **query_*.sql**: Three SQL queries (12 months, 10 years, all-time) with geocoding logic
- **No dependencies**: Uses only Python stdlib and `bq` CLI

## Key Implementation Details

### Mapbox Clustering
- **Native GeoJSON clustering** (`cluster: true` on source)
- Cluster radius: 50px, max zoom: 14
- Handles 10,000+ points smoothly
- Click clusters to zoom and expand

### Time Range Switching
- **Pre-loads all three datasets** on page load (~2MB total)
- Instant switching with no network delay
- Updates map source via `setData()` method
- Maintains user's zoom/pan position when switching

### Category Filtering
- Filters applied client-side (no re-fetch)
- Works across all time ranges
- Updates both clusters and individual points

### Geocoding Strategy
- **BigQuery public geo data**: `bigquery-public-data.geo_us_boundaries.zip_codes`
- Aggregates ZIP code centroids by city/state
- Fuzzy matching: strips suffixes (city, town, village, CDP, metropolitan government)
- Special NYC borough handling (Brooklyn, Bronx, Manhattan, Queens, Staten Island)
- ~87% match rate for US cities

### Brand Compliance
- **StoryCorps Red**: #E51022 (PMS 199) - User Generated markers, active buttons
- **StoryCorps Teal**: #2D8095 (PMS 7697) - Signature markers
- **Typography**: Gotham font with system fallbacks
- **Logo**: Floats over map in top-left, no background
- **Globe projection**: 3D Earth view for brand appeal

## Common Development Tasks

### Updating Interview Data

**Full refresh (all three time ranges)**:
```bash
python3 fetch_interviews.py  # Takes ~2 minutes
git add interviews_*.json
git commit -m "Update interview data"
git push
```

**Single time range** (if needed):
```bash
# Modify fetch_interviews.py to comment out unwanted time ranges
python3 fetch_interviews.py
```

### Testing Locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

### Modifying Queries

All three SQL files share the same structure:
1. `wp_interviews` CTE: Get interview posts with interview_id
2. `city_geo_lookup` CTE: Geocode cities from public ZIP data
3. `nyc_boroughs` CTE: Map NYC boroughs to coordinates
4. Main SELECT: Join interview data with geocoded cities

**Only difference**: WHERE clause date filter

### Adding New Time Ranges

1. Copy existing query (e.g., `query_alltime.sql`)
2. Modify date filter in WHERE clause
3. Update `fetch_interviews.py` to add new `process_time_range()` call
4. Add button in `index.html`
5. Add event listener in `script.js` `setupTimeRangeToggle()`
6. Update `datasets` object to include new range

## Data Structure

### BigQuery Source Tables
- `wp_posts`: Interview posts
- `wp_postmeta`: Interview metadata (interview_id)
- `interview_address`: City/state location data
- `bigquery-public-data.geo_us_boundaries.zip_codes`: US Census geocoding

### JSON Output Format
```json
[
  {
    "city": "Chicago",
    "state": "IL",
    "category": "User Generated",
    "lat": 41.8698,
    "lon": -87.6776,
    "interview_count": 4052
  }
]
```

### GeoJSON Conversion
JavaScript converts flat JSON to GeoJSON FeatureCollection for Mapbox:
- Features have Point geometry
- Properties include city, state, category, interview_count
- Clustering enabled on GeoJSON source

## Performance Considerations

### Data Sizes
- **12 months**: ~1,600 rows, 260KB
- **10 years**: ~9,500 rows, 1.5MB
- **All time**: ~10,500 rows, 1.6MB
- **Total initial load**: ~3.4MB (acceptable for this use case)

### Optimization Strategies
- Pre-load all datasets (avoids loading delays)
- Mapbox native clustering (GPU-accelerated)
- Client-side filtering (no server round-trips)
- Compressed JSON (no whitespace in production if needed)

### BigQuery Query Performance
- Each query takes 30-60 seconds
- Processes ~500MB-2GB of data
- City geocoding CTE can be cached/materialized if needed

## Known Limitations

### Geocoding Coverage
- **87% match rate** for interviews with city/state data
- Missing ~13% due to:
  - International locations (not in US Census)
  - Non-standard city names
  - Typos or abbreviations
  - Cities not in ZIP code database

### Data Completeness
- ~60% of all interviews have city/state in `interview_address`
- ~40% missing location data entirely
- Older interviews (pre-2015) may have less complete location data

### Performance
- 10,000+ points loads well but may lag on older devices
- Globe projection requires WebGL support
- Initial page load is ~3-4MB with all datasets

## Security & Privacy

### Data Privacy
- Only aggregate counts (no individual interview details)
- No participant names or personal information
- City/state level only (no precise addresses)

### Mapbox Token
- Public token hardcoded in script.js
- Should be restricted to storycorps.org domains in Mapbox dashboard
- Safe for client-side use (read-only token)

### BigQuery Access
- Requires authentication to run data pipeline
- Uses service account or user credentials
- Should not be committed to repository

## Deployment

### GitHub Pages
- Hosted at: https://github.com/StoryCorps/interview_map
- Custom domain: interviewmap.storycorps.org
- Auto-deploys on push to `master` branch
- CNAME file must exist for custom domain

### Manual Deployment Steps
1. Make code changes
2. Optionally refresh data: `python3 fetch_interviews.py`
3. Commit changes: `git add . && git commit -m "description"`
4. Push: `git push origin master`
5. Wait 1-2 minutes for GitHub Pages deployment

### Automated Updates (Future)
Could add GitHub Actions workflow for weekly data refresh:
- Schedule: `cron: '0 9 * * 1'` (Mondays 9 AM)
- Run `fetch_interviews.py` via Python in Actions
- Auto-commit and push updated JSON files
- Similar to staffmap's update-data.yml workflow

## Troubleshooting

### "BigQuery error: Not found"
```bash
# Re-authenticate
gcloud auth login
gcloud config set project sc-data-warehouse
```

### "Retrieved 10000 rows" (hitting limit)
- Check `fetch_interviews.py` line 32
- Increase `--max_rows` value (currently 50000)
- All-time query may need higher limit as data grows

### Map shows wrong data after switching time ranges
- Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear browser cache
- Check browser console for JavaScript errors

### Cities not appearing on map
- Check if city name matches US Census format
- Add custom mapping in SQL query (like NYC boroughs)
- Consider fallback geocoding for unmatched cities

## Code Style & Conventions

- **JavaScript**: ES6+ features, no transpilation
- **SQL**: BigQuery Standard SQL (not legacy)
- **Python**: PEP 8 style, type hints in docstrings
- **CSS**: BEM-like naming where appropriate
- **Comments**: Explain "why" not "what"

## Related Projects

- **staffmap**: Similar project for StoryCorps staff locations (ZIP code based)
- Uses similar tech stack but with npm build process and data compression

## Future Enhancements

Potential improvements:
- Automated weekly data refresh via GitHub Actions
- Heatmap layer option
- Timeline animation showing interview growth over time
- Export/screenshot functionality
- Stats panel (currently commented out)
- Better handling of international locations
- Compression for JSON files (like staffmap)
