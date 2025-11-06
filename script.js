document.addEventListener("DOMContentLoaded", () => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoibW9sc29uLXN0b3J5Y29ycHMtb3JnIiwiYSI6ImNqdndwbWMxNzBvcXA0Ym51ZDA1NmoyY3EifQ.MFFxtcDa0mkV2hg5Gthz4A";

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12", // Updated colorful style
    center: [-98.35, 39.5], // Centered on the US
    zoom: 3,
    projection: 'globe', // Enable globe view
  });

  // StoryCorps brand colors
  const categoryColors = {
    "User Generated": "#E51022",  // StoryCorps Primary Red
    "Signature": "#2D8095"         // StoryCorps Teal
  };

  // Filter state
  let filters = {
    userGenerated: true,
    signature: true
  };

  // Store all data for filtering
  let allInterviewData = [];

  // Load and display data
  fetch("interviews.json")
    .then((response) => response.json())
    .then((data) => {
      allInterviewData = data;

      // Wait for map to load before adding sources/layers
      map.on('load', () => {
        // Convert to GeoJSON format for Mapbox
        const geojson = convertToGeoJSON(data);

        // Add source with clustering enabled
        map.addSource('interviews', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14, // Max zoom to cluster points on
          clusterRadius: 50 // Radius of each cluster when clustering points
        });

        // Add cluster circles layer
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'interviews',
          filter: ['has', 'point_count'],
          paint: {
            // Size clusters based on point count
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15,  // radius for count < 10
              10, 20,  // radius for 10-50
              50, 25,  // radius for 50-100
              100, 30  // radius for 100+
            ],
            // Color by dominant category in cluster
            'circle-color': '#E51022', // StoryCorps red for clusters
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        // Add cluster count labels
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

        // Add individual point layer (when zoomed in)
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

        // Click on cluster to zoom in
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

        // Show popup on individual point hover
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
          // Close all popups
          document.querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
        });

        // Change cursor on cluster hover
        map.on('mouseenter', 'clusters', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'clusters', () => {
          map.getCanvas().style.cursor = '';
        });

        // Set up filters
        setupFilters();
      });
    })
    .catch((error) => console.error("Error loading interview data:", error));

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

  function setupFilters() {
    const userGenCheckbox = document.getElementById('filter-user-generated');
    const signatureCheckbox = document.getElementById('filter-signature');

    if (!userGenCheckbox || !signatureCheckbox) {
      console.warn('Filter checkboxes not found in HTML');
      return;
    }

    // Initialize checkboxes
    userGenCheckbox.checked = filters.userGenerated;
    signatureCheckbox.checked = filters.signature;

    // Add event listeners
    userGenCheckbox.addEventListener('change', () => {
      filters.userGenerated = userGenCheckbox.checked;
      updateMapFilter();
    });

    signatureCheckbox.addEventListener('change', () => {
      filters.signature = signatureCheckbox.checked;
      updateMapFilter();
    });
  }

  function updateMapFilter() {
    // Filter data based on checkbox state
    const filteredData = allInterviewData.filter(d => {
      if (d.category === 'User Generated' && filters.userGenerated) return true;
      if (d.category === 'Signature' && filters.signature) return true;
      return false;
    });

    // Update the map source with filtered data
    const geojson = convertToGeoJSON(filteredData);
    map.getSource('interviews').setData(geojson);
  }
});
