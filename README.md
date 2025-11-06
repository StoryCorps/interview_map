# StoryCorps Interview Map

An interactive map visualization showing StoryCorps interview locations from the past 12 months, grouped by city and interview type.

## Overview

This project displays interview data on an interactive Mapbox map, showing:
- Interview counts by location (city/state)
- Participant counts by location
- Breakdown by interview type (App, Signature, SC Connect, OSS Connect, etc.)
- Color-coded markers based on dominant interview type
- Dynamic marker sizing based on interview volume

## Project Structure

```
interview_map/
├── README.md                 # This file
├── index.html               # Main HTML page with Mapbox map
├── script.js                # Frontend JavaScript for map rendering
├── styles.css               # CSS styling for map and UI
├── query.sql                # BigQuery SQL query for interview data
├── fetch_interviews.py      # Python script to fetch and geocode data
├── interviews.json          # Generated data file (for map display)
├── StoryCorps logo.svg      # StoryCorps logo asset
└── test_query.sql          # Test query (can be deleted)
```

## Architecture

### Data Pipeline

1. **BigQuery Query** (`query.sql`):
   - Queries `wp_posts` for published interviews from last 12 months
   - Joins with `interview_address` to get city/state
   - Excludes storycorps.org staff emails
   - Aggregates by city/state/interview_type
   - Returns interview counts and participant counts

2. **Python Data Fetcher** (`fetch_interviews.py`):
   - Executes BigQuery query via `bq` CLI
   - Geocodes city/state combinations to lat/lon using Nominatim (OpenStreetMap)
   - Caches geocoding results to minimize API calls
   - Outputs `interviews.json` for frontend consumption

3. **Frontend Web Map**:
   - HTML/CSS/JavaScript single-page application
   - Uses Mapbox GL JS for map rendering
   - Loads `interviews.json` and displays markers
   - Groups markers by location
   - Shows detailed popups on hover

### Interview Types

The map categorizes interviews into types based on their `interview_id` prefix:
- **App**: Interviews starting with "APP"
- **Signature**: Interviews with subject_log or generic interview_id
- **SC Connect**: Remote interviews (remote_interview flag = '1')
- **OSS Connect**: Interviews starting with "OSC"
- **Other/Manual Upload**: Everything else

## Setup

### Prerequisites

1. **BigQuery CLI (`bq`)**:
   ```bash
   # Install Google Cloud SDK
   # Follow: https://cloud.google.com/sdk/docs/install

   # Authenticate
   gcloud auth login
   gcloud config set project sc-data-warehouse
   ```

2. **Python 3.8+** with dependencies:
   ```bash
   pip install geopy
   ```

3. **Mapbox Access Token**:
   - Currently using molson-storycorps-org token (hardcoded in `script.js`)
   - Token is public-facing (client-side only, acceptable for read-only maps)

### Running the Data Pipeline

To refresh the map with latest data:

```bash
# Navigate to project directory
cd /Users/molson/code/storycorps/interview_map

# Run the data fetcher (takes 2-3 minutes due to geocoding rate limits)
python3 fetch_interviews.py
```

**Output**:
```
============================================================
StoryCorps Interview Map Data Pipeline
============================================================
Reading query from .../query.sql...
Executing BigQuery query...
✓ Retrieved 100 rows from BigQuery
Transforming and geocoding data...
  Processing location 10/100...
  ...
✓ Successfully geocoded 99 locations
✓ Saved 99 locations to interviews.json
============================================================
✓ Pipeline completed successfully!
============================================================

Summary:
  Locations: 99
  Total Interviews: 5160
  Total Participants: 10648

By Interview Type:
  App: 5022
  SC Connect: 138
```

### Viewing the Map

Option 1: **Local Python Server** (recommended for testing):
```bash
python3 -m http.server 8000
# Open http://localhost:8000 in browser
```

Option 2: **Deploy to GitHub Pages** (like staffmap):
1. Create a new GitHub repository
2. Push all files to the repository
3. Enable GitHub Pages in repository settings
4. Optionally add a CNAME file for custom domain

## Customization

### Adjusting Date Range

Edit `query.sql` line 60:
```sql
-- Current: Last 12 months
wp_interviews.post_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 12 MONTH)

-- Change to specific date:
wp_interviews.post_date >= '2025-01-01'

-- Or different interval:
wp_interviews.post_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 6 MONTH)
```

### Changing Map Colors

Edit `script.js` lines 12-18 to customize interview type colors:
```javascript
const typeColors = {
  "App": "#FF6B6B",              // Red
  "Signature": "#4ECDC4",        // Teal
  "SC Connect": "#45B7D1",       // Blue
  "OSS Connect": "#96CEB4",      // Green
  "Other/Manual Upload": "#DDA15E" // Orange
};
```

### Modifying Marker Sizes

Edit `script.js` line 57:
```javascript
// Current formula: sqrt(count) * 8 + 10
const size = Math.sqrt(locationData.totalInterviews) * 8 + 10;

// Make markers bigger:
const size = Math.sqrt(locationData.totalInterviews) * 12 + 15;

// Make markers smaller:
const size = Math.sqrt(locationData.totalInterviews) * 6 + 8;
```

## Automation

To automatically refresh data on a schedule:

### Using Cron (Mac/Linux)

```bash
# Edit crontab
crontab -e

# Add line to run daily at 6 AM:
0 6 * * * cd /Users/molson/code/storycorps/interview_map && /usr/local/bin/python3 fetch_interviews.py >> /tmp/interview_map.log 2>&1
```

### Using GitHub Actions

If deploying to GitHub Pages, create `.github/workflows/update_data.yml`:

```yaml
name: Update Interview Data
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: pip install geopy

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}

      - name: Fetch interview data
        run: python3 fetch_interviews.py

      - name: Commit and push
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add interviews.json
          git commit -m "Update interview data [skip ci]" || exit 0
          git push
```

## Troubleshooting

### "geopy not installed"
```bash
pip install geopy
```

### "BigQuery error: Not found"
Make sure you're authenticated with BigQuery:
```bash
gcloud auth login
gcloud config set project sc-data-warehouse
```

### Geocoding fails for some locations
- Nominatim (OpenStreetMap) has rate limits (1 request/second)
- Some unusual city names may not be recognized
- Failed locations are reported but won't appear on map

### Map not loading
1. Check browser console for errors
2. Verify `interviews.json` exists and has valid data
3. Confirm Mapbox token is valid
4. Make sure you're serving via HTTP (not file://)

## Data Privacy

- This map shows **aggregate** interview counts only
- No participant names, personal details, or interview content
- City/state location data only (no street addresses)
- Footer warns: "Please don't share outside of StoryCorps"

## Contact

Questions? Contact [digital@storycorps.org](mailto:digital@storycorps.org)

## Related Projects

- **staffmap**: `/Users/molson/code/storycorps/staffmap` - Similar project mapping StoryCorps staff locations by ZIP code
