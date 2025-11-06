-- StoryCorps Interview Map Query
-- Retrieves ALL interview counts by location with lat/lon from BigQuery public geo data
-- Categories: User Generated (APP prefix) vs Signature (other interview_ids)
-- Uses bigquery-public-data.geo_us_boundaries.zip_codes for geocoding

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
-- Create city geocoding lookup from public ZIP code data
city_geo_lookup AS (
  SELECT
    UPPER(REGEXP_REPLACE(city, r' (city|town|village|CDP)$', '')) as clean_city,
    state_code,
    AVG(ST_Y(ST_CENTROID(zip_code_geom))) as lat,
    AVG(ST_X(ST_CENTROID(zip_code_geom))) as lon
  FROM `bigquery-public-data.geo_us_boundaries.zip_codes`
  WHERE city IS NOT NULL
  GROUP BY clean_city, state_code
)
SELECT
  interview_address.city AS city,
  interview_address.state AS state,
  CASE
    WHEN UPPER(LEFT(wp_interviews.interview_id, 3)) = 'APP' THEN 'User Generated'
    WHEN wp_interviews.interview_id IS NOT NULL THEN 'Signature'
    ELSE 'User Generated'
  END AS category,
  geo.lat,
  geo.lon,
  COUNT(DISTINCT wp_interviews.id) AS interview_count
FROM wp_interviews
LEFT JOIN `sc-data-warehouse.archive_rds_archive.interview_address` AS interview_address
  ON CAST(wp_interviews.id AS BIGNUMERIC) = interview_address.id
LEFT JOIN city_geo_lookup AS geo
  ON UPPER(interview_address.city) = geo.clean_city
  AND interview_address.state = geo.state_code
WHERE
  wp_interviews.post_date >= DATETIME(TIMESTAMP(DATETIME_ADD(DATETIME_TRUNC(DATETIME_TRUNC(CURRENT_DATETIME('America/New_York'), DAY), MONTH), INTERVAL -11 MONTH), 'America/New_York'))
  AND wp_interviews.post_date < DATETIME(TIMESTAMP(DATETIME_ADD(DATETIME_ADD(DATETIME_TRUNC(DATETIME_TRUNC(CURRENT_DATETIME('America/New_York'), DAY), MONTH), INTERVAL -11 MONTH), INTERVAL 12 MONTH), 'America/New_York'))
  AND UPPER(wp_interviews.post_status) = UPPER('publish')
  AND interview_address.city IS NOT NULL
  AND interview_address.state IS NOT NULL
  AND geo.lat IS NOT NULL
  AND geo.lon IS NOT NULL
GROUP BY
  city,
  state,
  category,
  geo.lat,
  geo.lon
ORDER BY
  interview_count DESC
