# StoryCorps Interview Map

An interactive globe-view map visualizing StoryCorps interview locations across the United States, with support for three time ranges and category filtering.

🌍 **Live Site**: [interviewmap.storycorps.org](http://interviewmap.storycorps.org)

## Overview

This map displays geographic distribution of StoryCorps interviews with:
- **Three time range views**: Past 12 Months, Past 10 Years, All Time
- **Category filtering**: User Generated vs Signature interviews
- **8,000+ cities** mapped across the United States
- **200,000+ interviews** visualized (all-time view)
- **Globe projection** with 3D Earth visualization
- **Intelligent clustering** for performance with large datasets

## Features

### Time Range Toggles
- **12 Months**: Recent activity (8K+ interviews, 1.5K cities)
- **10 Years**: Medium-term trends (143K+ interviews, 8.5K cities)
- **All Time**: Complete historical view (203K+ interviews, 8.8K cities)

### Interactive Elements
- **Mapbox clustering**: Automatically groups nearby locations at low zoom levels
- **Click to zoom**: Click cluster circles to zoom in and expand
- **Category filtering**: Toggle User Generated and Signature interviews independently
- **Hover popups**: See city name, interview count, and category on hover
- **Globe view**: Rotate and explore the 3D Earth projection

### Visual Design
- StoryCorps brand colors (Red: #E51022, Teal: #2D8095)
- Gotham typography (brand font)
- Responsive marker sizing based on interview volume
- Clean, minimal interface with floating logo

## Technology Stack

### Frontend
- **Mapbox GL JS v3.7.0** - Interactive maps with globe projection and clustering
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Static HTML/CSS** - No build process required
- **GeoJSON** - Standard geographic data format

### Data Pipeline
- **Python 3.8+** - Data fetching and transformation
- **Google BigQuery** - Data warehouse queries
- **BigQuery Public Geo Data** - US Census Bureau geographic boundaries for geocoding
- **No external APIs** - All geocoding done in BigQuery for speed

### Infrastructure
- **GitHub Pages** - Static site hosting
- **Custom Domain** - interviewmap.storycorps.org via CNAME
- **Git Version Control** - Source control and deployment

## Project Structure

```
interview_map/
├── index.html                      # Main HTML page
├── script.js                       # Map initialization, clustering, filtering
├── styles.css                      # StoryCorps brand styling
├── CNAME                           # GitHub Pages custom domain
├── README.md                       # This file
├── CLAUDE.md                       # Claude Code guidance
│
├── Data Queries (SQL)
├── query_12months.sql              # Past 12 months query
├── query_10years.sql               # Past 10 years query
├── query_alltime.sql               # All-time query
│
├── Data Pipeline (Python)
├── fetch_interviews.py             # Generates all three JSON datasets
├── requirements.txt                # Python dependencies (none!)
│
├── Generated Data (JSON)
├── interviews_12months.json        # ~260KB
├── interviews_10years.json         # ~1.5MB
├── interviews_alltime.json         # ~1.6MB
│
└── Assets
    └── StoryCorps logo.svg         # Brand logo
```

## Setup & Development

### Prerequisites

1. **Google Cloud CLI** with BigQuery access:
   ```bash
   # Install: https://cloud.google.com/sdk/docs/install
   gcloud auth login
   gcloud config set project sc-data-warehouse
   ```

2. **Python 3.8+** (no additional packages needed!)

3. **Git** and **GitHub CLI** (`gh`) for deployment

### Local Development

```bash
# Clone the repository
git clone https://github.com/StoryCorps/interview_map.git
cd interview_map

# Start local server
python3 -m http.server 8000
# Open http://localhost:8000
```

### Updating Data

To refresh interview data from BigQuery:

```bash
# Run the data pipeline (generates all three time ranges)
python3 fetch_interviews.py

# Commit and push
git add interviews_*.json
git commit -m "Update interview data"
git push
```

The site will automatically deploy within 1-2 minutes.

## Data Pipeline Details

### SQL Queries

Each query includes:
- **Interview type detection** - Classifies as "User Generated" (APP prefix) or "Signature"
- **Date filtering** - Different ranges for each view
- **City/state geocoding** - Joins with BigQuery public US Census data
- **NYC borough mapping** - Special handling for Brooklyn, Bronx, Manhattan, Queens, Staten Island
- **Fuzzy city matching** - Strips suffixes like "city", "town", "metropolitan government"

### Geocoding Strategy

Uses `bigquery-public-data.geo_us_boundaries.zip_codes`:
1. Aggregate ZIP code centroids by city/state
2. Calculate average lat/lon for each city
3. Handle special cases (NYC boroughs, metropolitan areas)
4. ~87% match rate for US cities with standard names

### Coverage Statistics

**All-Time View**:
- Total published interviews: 392,502
- Interviews with city/state: 233,678 (60%)
- Successfully geocoded: 203,112 (52% of total, 87% of those with location data)

**Missing Data**:
- ~40% lack city/state in database
- ~13% have city names that don't match US Census data (international, typos, unusual names)

## Customization

### Changing Map Colors

Edit `script.js` line 14-16:
```javascript
const categoryColors = {
  "User Generated": "#E51022",  // Change this color
  "Signature": "#2D8095"         // And this color
};
```

### Adjusting Cluster Settings

Edit `script.js` line 61-62:
```javascript
clusterMaxZoom: 14,  // Max zoom level for clustering
clusterRadius: 50    // Pixel radius for clustering
```

### Modifying Marker Sizes

Edit `script.js` line 110-117:
```javascript
'circle-radius': [
  'interpolate', ['linear'], ['get', 'interview_count'],
  1, 8,      // 1 interview = 8px radius
  50, 15,    // 50 interviews = 15px
  100, 20,   // 100 interviews = 20px
  200, 25    // 200+ interviews = 25px
]
```

### Changing Map Style

Edit `script.js` line 7:
```javascript
style: "mapbox://styles/mapbox/streets-v12", // Current
// Other options:
// "mapbox://styles/mapbox/outdoors-v12"  // Topographic
// "mapbox://styles/mapbox/dark-v11"      // Dark mode
// "mapbox://styles/mapbox/satellite-streets-v12"  // Satellite
```

## Deployment

### GitHub Pages Configuration

The site is automatically deployed via GitHub Pages:
- **Repository**: https://github.com/StoryCorps/interview_map
- **Branch**: `master`
- **Custom Domain**: interviewmap.storycorps.org (via CNAME file)
- **Deploy Trigger**: Any push to `master` branch

### DNS Configuration

CNAME record (already configured):
```
Type:  CNAME
Host:  interviewmap
Value: storycorps.github.io
```

### Manual Deployment

```bash
# Make changes
git add .
git commit -m "Description of changes"
git push origin master

# GitHub Pages deploys automatically within 1-2 minutes
```

## Data Privacy & Security

- **No personal information**: Only aggregate interview counts by location
- **City/state level only**: No street addresses or precise coordinates
- **Public Mapbox token**: Restricted to storycorps.org domains only
- **Internal use**: Footer indicates "Please don't share outside of StoryCorps"

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires JavaScript enabled
- Requires WebGL for Mapbox GL

## Performance

- **Initial load**: ~2MB total (all three datasets pre-loaded)
- **Clustering**: Handles 10,000+ points smoothly
- **Filtering**: Instant (no network requests)
- **Time range switching**: Instant (pre-loaded data)

## Troubleshooting

### Map not loading
1. Check browser console for errors
2. Verify all JSON files exist
3. Clear browser cache (Cmd+Shift+R)
4. Ensure Mapbox token is valid

### Missing cities
Some cities don't match US Census data due to:
- Non-standard city names
- International locations
- Typos or abbreviations
- Missing data in `interview_address` table

### Globe view not working
- Requires Mapbox GL JS v3.0+
- Check that `projection: 'globe'` is set in script.js
- Some older browsers may not support globe projection

## Related Projects

- **StoryCorps Staff Map**: `/Users/molson/code/storycorps/staffmap` - Similar project showing staff locations by ZIP code

## Contact

Questions or issues? Contact [digital@storycorps.org](mailto:digital@storycorps.org)

## License

Internal StoryCorps project - Not for external distribution
