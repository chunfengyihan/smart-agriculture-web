# Observability

## Structured logs

The Django API writes JSON logs by default through `apps.core.logging.JsonLogFormatter`.
Each completed request logs:

- `request_id`
- `user_id`
- `path`
- `method`
- `status_code`
- `duration_ms`
- `exception`

Incoming `X-Request-ID` is reused when it matches the safe request id pattern; otherwise a new UUID is generated. The value is also returned as `X-Request-ID` and in standard API responses.

Set `DJANGO_LOG_FORMAT=plain` only for local debugging. Production should keep the default JSON format so log collectors can parse fields reliably.

The formatter redacts keys containing token, password, secret, authorization, cookie, session, credential, access token, and refresh token. Do not log raw request bodies, raw device payloads, passwords, tokens, cookies, or full identity documents.

## Metrics endpoint

The Prometheus-compatible endpoint is disabled by default.

Enable it with:

```env
PROMETHEUS_METRICS_ENABLED=true
```

Endpoint:

```text
GET /api/v1/metrics/
```

The endpoint still uses the normal API authentication policy. In production, keep it behind Nginx or an internal network and use an allowlisted API key.

Current metrics include:

- `smart_agri_http_requests_total`
- `smart_agri_http_request_duration_ms`
- `smart_agri_slow_queries_total`
- `smart_agri_slow_query_duration_ms`
- `smart_agri_external_calls_total`
- `smart_agri_external_call_duration_ms`
- `smart_agri_cache_events_total`
- `smart_agri_upload_failures_total`

Set the slow query threshold with:

```env
DB_SLOW_QUERY_MS=500
```

## Prometheus scrape example

```yaml
scrape_configs:
  - job_name: smart-agri-api
    metrics_path: /api/v1/metrics/
    scheme: https
    static_configs:
      - targets:
          - api.example.com
    authorization:
      type: ApiKey
      credentials: ${SMART_AGRI_METRICS_API_KEY}
```

For local development with the single-port Django app:

```yaml
scrape_configs:
  - job_name: smart-agri-local
    metrics_path: /api/v1/metrics/
    static_configs:
      - targets:
          - 127.0.0.1:8000
```

## Grafana dashboard starter panels

Create panels from these PromQL queries:

```promql
sum by (status) (rate(smart_agri_http_requests_total[5m]))
```

```promql
sum by (service, success) (rate(smart_agri_external_calls_total[5m]))
```

```promql
sum by (cache, result) (rate(smart_agri_cache_events_total[5m]))
```

```promql
sum by (reason) (rate(smart_agri_upload_failures_total[5m]))
```

```promql
sum(rate(smart_agri_slow_queries_total[5m]))
```

## Sentry placeholder

The project reserves these settings:

```env
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.05
```

When `SENTRY_DSN` is empty, the project starts normally and no Sentry SDK is required. To enable Sentry later, add `sentry-sdk` to dependencies and initialize it from these settings in the Django settings module.
