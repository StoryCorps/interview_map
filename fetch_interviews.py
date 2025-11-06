#!/usr/bin/env python3
"""
StoryCorps Interview Map Data Fetcher

Queries BigQuery for interview location data with coordinates from BigQuery public geo data.
No external geocoding needed!
"""

import json
import subprocess
import sys
from pathlib import Path


def run_bigquery_query(query_file: Path) -> list[dict]:
    """
    Execute BigQuery query using bq CLI and return results as list of dicts.

    Args:
        query_file: Path to SQL query file

    Returns:
        List of dictionaries containing query results
    """
    print(f"Reading query from {query_file}...")
    query = query_file.read_text()

    print("Executing BigQuery query...")
    print("(This may take 30-60 seconds for ~2,000 cities...)")
    try:
        result = subprocess.run(
            ["bq", "query", "--use_legacy_sql=false", "--format=json", "--max_rows=50000"],
            input=query,
            capture_output=True,
            text=True,
            check=True
        )

        data = json.loads(result.stdout)
        print(f"✓ Retrieved {len(data)} rows from BigQuery")
        return data

    except subprocess.CalledProcessError as e:
        print(f"✗ BigQuery error: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"✗ Failed to parse BigQuery output: {e}", file=sys.stderr)
        sys.exit(1)


def transform_data(raw_data: list[dict]) -> list[dict]:
    """
    Transform BigQuery results into format expected by frontend.

    Args:
        raw_data: Raw query results from BigQuery

    Returns:
        Transformed data ready for map visualization
    """
    print("Transforming data...")

    transformed = []
    skipped = 0

    for row in raw_data:
        # Skip rows without valid coordinates
        if not row.get('lat') or not row.get('lon'):
            skipped += 1
            continue

        # Skip rows without city/state
        if not row.get('city') or not row.get('state'):
            skipped += 1
            continue

        transformed.append({
            'city': row['city'],
            'state': row['state'],
            'category': row['category'],
            'lat': float(row['lat']),
            'lon': float(row['lon']),
            'interview_count': int(row['interview_count'])
        })

    print(f"✓ Transformed {len(transformed)} locations")
    if skipped > 0:
        print(f"  (Skipped {skipped} rows with missing data)")

    return transformed


def save_json(data: list[dict], output_file: Path) -> None:
    """
    Save data to JSON file.

    Args:
        data: Data to save
        output_file: Path to output JSON file
    """
    print(f"Writing data to {output_file}...")

    with output_file.open('w') as f:
        json.dump(data, f, indent=2)

    print(f"✓ Saved {len(data)} locations to {output_file}")


def process_time_range(query_file: Path, output_file: Path, time_range_name: str):
    """Process a single time range query."""
    print(f"\n{'=' * 60}")
    print(f"Processing {time_range_name} data...")
    print(f"{'=' * 60}")

    # Verify query file exists
    if not query_file.exists():
        print(f"✗ Query file not found: {query_file}", file=sys.stderr)
        return None

    raw_data = run_bigquery_query(query_file)
    transformed_data = transform_data(raw_data)
    save_json(transformed_data, output_file)

    # Print summary statistics
    if transformed_data:
        total_interviews = sum(d['interview_count'] for d in transformed_data)
        unique_cities = len(set((d['city'], d['state']) for d in transformed_data))

        print(f"\nSummary for {time_range_name}:")
        print(f"  Unique Locations: {unique_cities}")
        print(f"  Total Rows: {len(transformed_data)}")
        print(f"  Total Interviews: {total_interviews:,}")

        # Category breakdown
        categories = {}
        for d in transformed_data:
            cat = d['category']
            categories[cat] = categories.get(cat, 0) + d['interview_count']

        print(f"\nBy Category:")
        for category, count in sorted(categories.items(), key=lambda x: -x[1]):
            percentage = (count / total_interviews * 100) if total_interviews > 0 else 0
            print(f"  {category}: {count:,} ({percentage:.1f}%)")

    return transformed_data


def main():
    """Main execution function - generates all time range datasets."""
    script_dir = Path(__file__).parent

    # Execute pipeline for all time ranges
    print("=" * 60)
    print("StoryCorps Interview Map Data Pipeline")
    print("Generating data for ALL time ranges...")
    print("=" * 60)

    # Process 12 months
    process_time_range(
        script_dir / "query_12months.sql",
        script_dir / "interviews_12months.json",
        "Past 12 Months"
    )

    # Process 10 years
    process_time_range(
        script_dir / "query_10years.sql",
        script_dir / "interviews_10years.json",
        "Past 10 Years"
    )

    # Process all time
    process_time_range(
        script_dir / "query_alltime.sql",
        script_dir / "interviews_alltime.json",
        "All Time"
    )

    print("\n" + "=" * 60)
    print("✓ Pipeline completed successfully!")
    print("✓ Generated all datasets:")
    print("  - interviews_12months.json")
    print("  - interviews_10years.json")
    print("  - interviews_alltime.json")
    print("=" * 60)


if __name__ == "__main__":
    main()
