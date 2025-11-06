document.addEventListener("DOMContentLoaded", () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoibW9sc29uLXN0b3J5Y29ycHMtb3JnIiwiYSI6ImNqdndwbWMxNzBvcXA0Ym51ZDA1NmoyY3EifQ.MFFxtcDa0mkV2hg5Gthz4A";

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [-98.35, 39.5],
    zoom: 3,
    projection: 'globe',
  });

  // StoryCorps brand colors
  const categoryColors = {
    "User Generated": "#E51022",
    "Signature": "#2D8095"
  };

  // State
  let currentTimeRange = '12months'; // or '10years' or 'alltime'
  let datasets = {
    '12months': null,
    '10years': null,
    'alltime': null
  };
  let filters = {
    userGenerated: true,
    signature: true
  };

  // Load all three datasets
  Promise.all([
    fetch("interviews_12months.json").then(r => r.json()),
    fetch("interviews_10years.json").then(r => r.json()),
    fetch("interviews_alltime.json").then(r => r.json())
  ])
    .then(([data12months, data10years, dataAlltime]) => {
      datasets['12months'] = data12months;
      datasets['10years'] = data10years;
      datasets['alltime'] = dataAlltime;

      console.log(`Loaded 12 months: ${data12months.length} locations`);
      console.log(`Loaded 10 years: ${data10years.length} locations`);
      console.log(`Loaded all time: ${dataAlltime.length} locations`);

      // Wait for map to load
      map.on('load', () => {
        initializeMap();
        setupTimeRangeToggle();
        setupCategoryFilters();
        // updateStats(getFilteredData()); // Commented out for now
      });
    })
    .catch((error) => console.error("Error loading data:", error));

  function initializeMap() {
    // Start with 12 months data
    const initialData = getFilteredData();
    const geojson = convertToGeoJSON(initialData);

    // Add source with clustering
    map.addSource('interviews', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    // Cluster circles
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'interviews',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          15,
          10, 20,
          50, 25,
          100, 30
        ],
        'circle-color': '#E51022',
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Cluster count labels
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'interviews',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Individual points
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'interviews',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'interview_count'],
          1, 8,
          50, 15,
          100, 20,
          200, 25
        ],
        'circle-color': [
          'match',
          ['get', 'category'],
          'User Generated', categoryColors['User Generated'],
          'Signature', categoryColors['Signature'],
          '#999'
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Click cluster to zoom
    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      });
      const clusterId = features[0].properties.cluster_id;
      map.getSource('interviews').getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        }
      );
    });

    // Hover popups on individual points
    map.on('mouseenter', 'unclustered-point', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;

      const popupHTML = `
        <div class="popup-content">
          <h3>${props.city}, ${props.state}</h3>
          <div class="popup-separator"></div>
          <div class="popup-totals">
            <strong>Interviews:</strong> ${props.interview_count}<br>
            <strong>Category:</strong> ${props.category}
          </div>
        </div>
      `;

      new mapboxgl.Popup({
        closeButton: false,
        offset: 15
      })
        .setLngLat(coordinates)
        .setHTML(popupHTML)
        .addTo(map);
    });

    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
      document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
    });

    // Cursor changes on cluster hover
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  function setupTimeRangeToggle() {
    const btn12months = document.getElementById('toggle-12months');
    const btn10years = document.getElementById('toggle-10years');
    const btnAlltime = document.getElementById('toggle-alltime');
    const allButtons = [btn12months, btn10years, btnAlltime];

    btn12months.addEventListener('click', () => {
      if (currentTimeRange !== '12months') {
        currentTimeRange = '12months';
        allButtons.forEach(btn => btn.classList.remove('active'));
        btn12months.classList.add('active');
        updateMapData();
      }
    });

    btn10years.addEventListener('click', () => {
      if (currentTimeRange !== '10years') {
        currentTimeRange = '10years';
        allButtons.forEach(btn => btn.classList.remove('active'));
        btn10years.classList.add('active');
        updateMapData();
      }
    });

    btnAlltime.addEventListener('click', () => {
      if (currentTimeRange !== 'alltime') {
        currentTimeRange = 'alltime';
        allButtons.forEach(btn => btn.classList.remove('active'));
        btnAlltime.classList.add('active');
        updateMapData();
      }
    });
  }

  function setupCategoryFilters() {
    const userGenCheckbox = document.getElementById('filter-user-generated');
    const signatureCheckbox = document.getElementById('filter-signature');

    if (!userGenCheckbox || !signatureCheckbox) {
      console.warn('Filter checkboxes not found');
      return;
    }

    userGenCheckbox.checked = filters.userGenerated;
    signatureCheckbox.checked = filters.signature;

    userGenCheckbox.addEventListener('change', () => {
      filters.userGenerated = userGenCheckbox.checked;
      updateMapData();
    });

    signatureCheckbox.addEventListener('change', () => {
      filters.signature = signatureCheckbox.checked;
      updateMapData();
    });
  }

  function getFilteredData() {
    const currentData = datasets[currentTimeRange];
    if (!currentData) return [];

    return currentData.filter(d => {
      if (d.category === 'User Generated' && filters.userGenerated) return true;
      if (d.category === 'Signature' && filters.signature) return true;
      return false;
    });
  }

  function updateMapData() {
    const filteredData = getFilteredData();
    const geojson = convertToGeoJSON(filteredData);
    map.getSource('interviews').setData(geojson);
    // updateStats(filteredData); // Commented out for now
  }

  // Stats function commented out - uncomment when ready to show stats
  /*
  function updateStats(data) {
    const totalInterviews = data.reduce((sum, d) => sum + d.interview_count, 0);
    const uniqueCities = new Set(data.map(d => `${d.city}, ${d.state}`)).size;

    document.getElementById('total-interviews').textContent = totalInterviews.toLocaleString();
    document.getElementById('total-cities').textContent = `${uniqueCities.toLocaleString()} cities`;
  }
  */

  function convertToGeoJSON(data) {
    return {
      type: 'FeatureCollection',
      features: data.map(d => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [d.lon, d.lat]
        },
        properties: {
          city: d.city,
          state: d.state,
          category: d.category,
          interview_count: d.interview_count
        }
      }))
    };
  }
});
