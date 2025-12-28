# Datadog Organization Information

## Organization Details

**Organization Name:** DevShield AI Hackathon  
**Datadog Site:** us5.datadoghq.com  
**Account Type:** 14-day trial (Hackathon access)  
**Service Name:** devshield-ai  
**Environment:** production

---

## Configured Resources

### Dashboard
- **Name:** DevShield AI - Security Monitoring Dashboard
- **Widgets:** 14 total
  - 4 Query Value widgets (attack counts, risk score, requests)
  - 6 Timeseries widgets (attack rate, risk trends, latency, sentiment, cost, confidence)
  - 1 Toplist widget (attack categories)
  - 1 Manage Status widget (active monitors)
- **Template Variables:** `env`, `service`
- **Export:** `datadog/dashboard-config.json`

### Monitors (6)
1. **[DevShield AI] High Risk Score Threshold Exceeded**
   - Query: `avg:security.risk_score.distribution{*} > 76`
   - Priority: 1 (Critical)
   - Tags: `service:devshield-ai`, `env:production`, `severity:critical`

2. **[DevShield AI] Attack Rate Spike Detected**
   - Query: `sum:security.attack.detected.total{*} > 10` (10min window)
   - Priority: 2 (High)
   - Tags: `service:devshield-ai`, `env:production`, `severity:high`

3. **[DevShield AI] LLM Response Latency Degradation**
   - Query: `p95:llm.request.latency{*} > 10000`
   - Priority: 3 (Medium)
   - Tags: `service:devshield-ai`, `env:production`, `severity:medium`

4. **[DevShield AI] Vertex AI Negative Sentiment Spike**
   - Query: `avg:vertex_ai.sentiment.score{*} < -0.5`
   - Priority: 4 (Medium)
   - Tags: `service:devshield-ai`, `env:production`, `team:ml`

5. **[DevShield AI] Cost Attack - Token Exhaustion Attempt**
   - Query: `sum:cost.tokens.estimated{*} > 50000` (5min window)
   - Priority: 2 (High)
   - Tags: `service:devshield-ai`, `env:production`, `severity:high`

6. **[DevShield AI] Detection Rule Failure - Monitoring Health**
   - Query: `avg:security.confidence{*} < 50`
   - Priority: 2 (High)
   - Tags: `service:devshield-ai`, `env:production`, `team:platform`

**Export:** `datadog/monitors-config.json`

### SLOs (4)
1. **DevShield AI - LLM Response Latency SLO**
   - Target: 99% of requests under 10 seconds
   - Timeframes: 7d, 30d
   - Tags: `slo:latency`

2. **DevShield AI - Security Detection Availability SLO**
   - Target: 99.9% uptime
   - Timeframes: 7d, 30d
   - Tags: `slo:availability`

3. **DevShield AI - Attack Block Success Rate SLO**
   - Target: 100% block rate for critical threats
   - Timeframes: 7d, 30d
   - Tags: `slo:blocking-effectiveness`

4. **DevShield AI - Vertex AI Integration Health SLO**
   - Target: 95% successful analysis
   - Timeframes: 7d, 30d
   - Tags: `slo:vertex-ai-health`

**Export:** `datadog/slos-config.json`

### Custom Metrics (16)

**Security Metrics:**
- `security.attack.detected.total` - Total attacks detected
- `security.attack.blocked.total` - Total attacks blocked
- `security.risk_score.distribution` - Risk score distribution
- `security.attack_type.count` - By attack category
- `security.confidence` - Detection confidence percentage
- `security.blocks_total` - Block events

**LLM Metrics:**
- `llm.requests.total` - Total LLM requests
- `llm.request.latency` - Response time (p50, p95, p99)
- `llm.tokens.estimated` - Estimated token usage
- `llm.model` - Model identifier

**Vertex AI Metrics:**
- `vertex_ai.sentiment.score` - Sentiment analysis score
- `vertex_ai.sentiment.magnitude` - Sentiment magnitude
- `vertex_ai.entities.detected` - Entity detection count
- `vertex_ai.risk_contribution` - AI risk contribution

**Rate Limiting & Cost:**
- `ratelimit.requests.total` - By tier (1/2/3)
- `cost.tokens.estimated` - Token consumption tracking

### Tags Used
- `service:devshield-ai` (primary service tag)
- `env:production`
- `team:security`, `team:platform`, `team:ml`
- `severity:critical`, `severity:high`, `severity:medium`
- `devshield-ai` (project tag)

---

## Import Instructions

### To Import Dashboard:
1. Navigate to Datadog UI → Dashboards → New Dashboard
2. Click "Import Dashboard JSON"
3. Upload `datadog/dashboard-config.json`
4. Verify template variables are set correctly

### To Import Monitors:
1. Navigate to Datadog UI → Monitors → New Monitor
2. Select "Import Monitor"
3. Paste content from `datadog/monitors-config.json`
4. Repeat for each monitor (6 total)
5. Verify tags and notification channels

### To Import SLOs:
1. Navigate to Datadog UI → Service Level Objectives → New SLO
2. Select "Define from Monitor" or "Metric-Based"
3. Use configuration from `datadog/slos-config.json`
4. Set 7-day and 30-day targets
5. Repeat for each SLO (4 total)

---

## Verification

### Dashboard Access
Navigate to: Dashboards → "DevShield AI - Security Monitoring Dashboard"

### Monitor Status
Navigate to: Monitors → Manage Monitors → Filter by tag: `devshield-ai`

### SLO Status
Navigate to: Service Level Objectives → Filter by service: `devshield-ai`

### Metrics Explorer
Navigate to: Metrics → Explorer → Search: `security.*`, `llm.*`, `vertex_ai.*`

---

## Hackathon Submission Details

**Challenge:** Datadog AI Accelerate  
**Project:** DevShield AI - LLM Security Monitoring  
**Application URL:** https://devshield-ai-25280477384.us-central1.run.app  
**GitHub Repository:** https://github.com/Mohib1402/AICatalystHackathon  
**Admin Portal:** https://devshield-ai-25280477384.us-central1.run.app/admin/login  

**Key Innovation:** Hybrid detection system combining 538 attack patterns (70%) with Vertex AI sentiment/entity analysis (30%) for comprehensive LLM security monitoring with full Datadog observability.
