# P0 Dashboard Compatibility Evidence

## Scope

P0 endpoints:

- `GET /api/greenhouse/dashboard`
- `GET /api/v1/greenhouse/dashboard`

Seed source:

- `public/data/local-dashboard.json`

## Data Model Used

- `Greenhouse`: persistent greenhouse identity and display location.
- `Device`: normalized device identity, provider metadata, status and last-seen time.
- `EnvironmentReading`: latest seeded metric values with Decimal fields for cross-database compatibility.
- `Alert`: normalized active or historical greenhouse/device alerts.
- `DashboardSnapshot`: full dashboard display payload retained as cache/fallback compatibility data.

## Compatibility Rules

- Legacy path returns raw `DashboardData`.
- V1 path returns `{ code, message, data, request_id }`.
- Legacy field names, top-level keys, nested crop/greenhouse arrays, metric arrays, trend arrays, units and null values are preserved through the normalized dashboard service; snapshot is used only when normalized data is unavailable.

## Verification Evidence

Repeated seed result:

```text
Seeded 4 greenhouses, 4 devices, 4 readings, 5 alerts, 1 dashboard snapshot.
Seeded 4 greenhouses, 4 devices, 4 readings, 5 alerts, 1 dashboard snapshot.
```

Compatibility script output:

```text
legacy_status=200
legacy_top_keys=generatedAt,source,crops
top_keys_match=True
source_match=True
crop_count_match=True
first_crop_id=jujube
first_greenhouse_metric_count=8
first_greenhouse_trend_count=24
v1_status=200
v1_code=0
v1_data_top_keys=generatedAt,source,crops
```

## Test Coverage

- Empty legacy response.
- Empty v1 response with standard wrapper.
- `seed_dev` repeatability.
- Seeded legacy payload shape.
- Seeded v1 wrapper.
- Dashboard service prefers normalized model data before `DashboardSnapshot`.
- V1 readings endpoint filters by greenhouse, time range and `metric_type`.
- Health endpoint standard response and request id behavior remain covered by core tests.

## Risks

- `DashboardSnapshot.payload` intentionally preserves display shape for cache/fallback use. Normalized model changes must keep frontend compatibility tests passing.
- `local-dashboard.json` is a display snapshot, not the full source-of-truth sensor history.
- MySQL execution has not yet been validated on a real MySQL 8.0+ database.
