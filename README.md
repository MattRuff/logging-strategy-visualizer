# Logging strategy visualizer

Interactive **flow diagram** plus **cost sheet** for Datadog logging routing (Observability Pipelines, ingestion, indexed hot storage, Flex storage + compute, archive). Edge **%** values sync with the sheet; **quantity** is derived and read-only; **Unit $** uses defaults from [`src/model/pricingCatalog.ts`](src/model/pricingCatalog.ts) (verify against [Druids](https://druids.datadoghq.com/) on VPN) and can be **overridden** in the sheet. Use **Reset pricing defaults** to clear overrides.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Usage

- **Toolbar**: **Total TB/month**, **Million log lines, per month** (for indexed and ingestion math). Defaults follow a **30 TB/month ↔ 30 billion lines/month** rule of thumb (30,000 in the millions field). **New scenario** resets the example graph, volumes, Flex compute tier (Small), and **pricing overrides**. **Reset pricing defaults** clears overrides only.
- **Layout**: Drag the **horizontal handle** between the diagram and the cost sheet to resize panels.
- **Palette**: Drag node types onto the canvas; connect handles; edit **%** on edges (compact chip on the line).
- **Inspector**: **Flex compute** tier (global, XS–L). When a node is selected, edit label and retention (indexed / Flex).
- **Cost sheet**:
  - **One row per graph node** (BFS order), except **Flex** destinations share a single **Flex Storage** line (“Flex Tier Storage (all Flex nodes — 30-day buckets)”) with blended pricing; **Flex compute** is one row by tier. **Type** column: OP, Ingest, Standard, Flex Storage, Flex Compute, Archive.
  - **% of total**: editable for node rows; adjusts the **last edge** on the path from the root to match the target share.
  - **Unit $**: editable where a **pricing key** applies; writes an override (not the code default).
- **Export .xlsx**: **Costs** sheet plus **`_strategy_model`** (JSON: graph, volumes, `pricingOverrides`, `flexComputeTier`). **Import** requires that model sheet for a full restore.

## Notes

- **Defaults**: Align `DEFAULT_PRICING` with internal Druids list prices when they change; note the review date here: **2026-04-15** (update when re-verified). See [`DRUIDS_SOURCES.md`](DRUIDS_SOURCES.md).
- **SheetJS (`xlsx`)**: Confirm your organization’s license terms for production use.

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Dev server               |
| `npm run build`   | Typecheck + build        |
| `npm run preview` | Preview production build |
| `npm run test`    | Vitest unit tests        |
| `npm run helm:lint` | Lint the Helm chart   |
| `npm run helm:install-minikube` | Build image in Minikube + install chart |

## Docker image (GitHub Container Registry)

On every push to **`main`** (and **`master`**), [GitHub Actions](.github/workflows/docker-publish.yml) builds the [`Dockerfile`](Dockerfile) and pushes to **GitHub Container Registry (GHCR)**:

`ghcr.io/mattruff/logging-strategy-visualizer:latest` (also tagged with the commit SHA and branch/tag name).

Pull locally:

```bash
docker pull ghcr.io/mattruff/logging-strategy-visualizer:latest
```

The package may start **private** to your account. To let others pull without logging in: GitHub → **Packages** → this package → **Package settings** → **Change package visibility** → **Public** (or grant collaborators access).

Helm defaults are tuned for local Minikube; for GHCR set `image.repository`, `image.tag`, and `image.pullPolicy` (e.g. `IfNotPresent`) in [`deploy/helm/logging-strategy/values.yaml`](deploy/helm/logging-strategy/values.yaml).
