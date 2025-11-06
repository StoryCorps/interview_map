-- StoryCorps Interview Map Query - ALL TIME
-- Retrieves ALL interview counts by location with lat/lon from BigQuery public geo data
-- Categories: User Generated (APP prefix) vs Signature (other interview_ids)
-- Uses bigquery-public-data.geo_us_boundaries.zip_codes for geocoding
-- Time Range: ALL TIME (no date filter)

WITH wp_interviews AS (
  SELECT
    wp_posts.id,
    wp_posts.post_title,
    wp_posts.post_date,
    DATE_TRUNC(wp_posts.post_date, MONTH) as post_month,
    wp_posts.post_excerpt,
    wp_posts.post_name,
    wp_posts.post_modified,
    wp_posts.post_content,
    wp_posts.post_type,
    wp_posts.post_status,
    wp_posts.post_author,
    interview_id.meta_value AS interview_id,
    interview_id.meta_value IS NOT NULL AS has_interview_id
  FROM
    `sc-data-warehouse.archive_rds_archive.wp_posts` wp_posts
  LEFT JOIN (
    SELECT
      post_id,
      MIN(meta_value) as meta_value
    FROM `sc-data-warehouse.archive_rds_archive.wp_postmeta`
    WHERE meta_key = 'interview_id'
    GROUP BY post_id
  ) interview_id ON interview_id.post_id = wp_posts.id
  WHERE
    wp_posts.post_type = 'interviews'
),
-- Create city geocoding lookup from public ZIP code data with fuzzy matching
city_geo_lookup AS (
  SELECT
    -- Remove common suffixes and standardize
    UPPER(REGEXP_REPLACE(
      REGEXP_REPLACE(city, r' (city|town|village|CDP|borough|metropolitan government \(balance\))$', ''),
      r'-.*', ''  -- Remove everything after dash (Nashville-Davidson → Nashville)
    )) as clean_city,
    state_code,
    AVG(ST_Y(ST_CENTROID(zip_code_geom))) as lat,
    AVG(ST_X(ST_CENTROID(zip_code_geom))) as lon
  FROM `bigquery-public-data.geo_us_boundaries.zip_codes`
  WHERE city IS NOT NULL
  GROUP BY clean_city, state_code
),
-- NYC borough mappings
nyc_boroughs AS (
  SELECT 'BROOKLYN' as borough, 'NY' as state_code
  UNION ALL SELECT 'BRONX', 'NY'
  UNION ALL SELECT 'MANHATTAN', 'NY'
  UNION ALL SELECT 'QUEENS', 'NY'
  UNION ALL SELECT 'STATEN ISLAND', 'NY'
),
-- Get NYC coordinates for borough mapping
nyc_coords AS (
  SELECT lat, lon
  FROM city_geo_lookup
  WHERE clean_city = 'NEW YORK' AND state_code = 'NY'
  LIMIT 1
)
SELECT
  interview_address.city AS city,
  interview_address.state AS state,
  CASE
    WHEN UPPER(LEFT(wp_interviews.interview_id, 3)) = 'APP' THEN 'User Generated'
    WHEN wp_interviews.interview_id IS NOT NULL THEN 'Signature'
    ELSE 'User Generated'
  END AS category,
  -- Use NYC coords for boroughs, otherwise use city lookup
  COALESCE(
    CASE WHEN nyc_boroughs.borough IS NOT NULL THEN (SELECT lat FROM nyc_coords) ELSE NULL END,
    geo.lat
  ) as lat,
  COALESCE(
    CASE WHEN nyc_boroughs.borough IS NOT NULL THEN (SELECT lon FROM nyc_coords) ELSE NULL END,
    geo.lon
  ) as lon,
  COUNT(DISTINCT wp_interviews.id) AS interview_count
FROM wp_interviews
LEFT JOIN `sc-data-warehouse.archive_rds_archive.interview_address` AS interview_address
  ON CAST(wp_interviews.id AS BIGNUMERIC) = interview_address.id
LEFT JOIN city_geo_lookup AS geo
  ON UPPER(interview_address.city) = geo.clean_city
  AND interview_address.state = geo.state_code
LEFT JOIN nyc_boroughs
  ON UPPER(interview_address.city) = nyc_boroughs.borough
  AND interview_address.state = nyc_boroughs.state_code
WHERE
  UPPER(wp_interviews.post_status) = UPPER('publish')
  AND interview_address.city IS NOT NULL
  AND interview_address.state IS NOT NULL
  AND (geo.lat IS NOT NULL OR nyc_boroughs.borough IS NOT NULL)
GROUP BY
  1, 2, 3, 4, 5
ORDER BY
  interview_count DESC
