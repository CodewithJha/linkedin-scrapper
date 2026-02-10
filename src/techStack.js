const STACK_KEYWORDS = [
  // Languages
  'python',
  'java',
  'scala',
  'go',
  'golang',
  'javascript',
  'typescript',
  'sql',
  'bash',
  'shell',
  // Data/processing
  'spark',
  'pyspark',
  'hadoop',
  'hive',
  'trino',
  'presto',
  'athena',
  'databricks',
  'delta lake',
  'iceberg',
  'hudi',
  'airflow',
  'dagster',
  'dbt',
  'kafka',
  'flink',
  'beam',
  // Warehouses/lakes
  'snowflake',
  'bigquery',
  'redshift',
  'synapse',
  // Databases
  'postgres',
  'postgresql',
  'mysql',
  'mongodb',
  'cassandra',
  'dynamodb',
  'redis',
  // Cloud
  'aws',
  'azure',
  'gcp',
  's3',
  'emr',
  'glue',
  'lambda',
  'ecs',
  'eks',
  'dataproc',
  'dataflow',
  'pubsub',
  'eventhub',
  // Infra/devops
  'docker',
  'kubernetes',
  'terraform',
  'ansible',
  'jenkins',
  'github actions',
  'ci/cd'
];

function normalizeText(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#./\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTechStack(descriptionText) {
  const text = normalizeText(descriptionText);
  if (!text) return [];

  const found = new Set();
  for (const kw of STACK_KEYWORDS) {
    const needle = normalizeText(kw);
    if (!needle) continue;

    // Word-ish boundary match to reduce false positives (best-effort)
    const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (re.test(text)) {
      found.add(kw);
    }
  }

  return Array.from(found);
}

