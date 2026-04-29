/**
 * Curated library of best-practice strategies surfaced on the landing page.
 *
 * Each entry points at an `.xlsx` file served from `public/templates/` — i.e. the
 * same workbook format the app exports. Build a new template by designing it in
 * the running app, clicking Export, dropping the file into `public/templates/`,
 * and adding an entry here.
 */
export interface StrategyTemplate {
  /** Stable id used as the React key and for analytics-style attribution. */
  id: string;
  title: string;
  /** Short label above the title (e.g. routing style). */
  subtitle: string;
  description: string;
  /** Path served by Vite from `public/templates/`. Must start with `/templates/`. */
  file: string;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "flex-heavy-archive",
    title: "Flex-heavy with full archive",
    subtitle: "Balanced cost + searchability",
    description:
      "Most logs flow through Observability Pipelines into Flex for mid-term searchability, a small high-priority subset hits a 3-day Index, and everything mirrors to S3 archive.",
    file: "/templates/flex-heavy-archive.xlsx",
  },
  {
    id: "indexed-first-low-volume",
    title: "Indexed-first (low volume)",
    subtitle: "Small footprint, fast search",
    description:
      "Small-volume org: no pipelines, logs go straight from the source to a 15-day Standard Index so everything is searchable out of the box.",
    file: "/templates/indexed-first-low-volume.xlsx",
  },
  {
    id: "tiered-ops-pipeline",
    title: "Tiered OP pipeline",
    subtitle: "Severity-aware routing",
    description:
      "OP splits by severity: info to Flex 30d, warn to Index 7d, error to Index 30d, and a full copy of everything to S3 archive for compliance.",
    file: "/templates/tiered-ops-pipeline.xlsx",
  },
];
