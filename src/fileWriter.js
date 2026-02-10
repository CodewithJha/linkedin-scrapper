import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

export async function writeCsv(records, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `linkedin-jobs-${timestamp}.csv`;
  const targetPath = path.resolve(outputDir, filename);

  const csvWriter = createObjectCsvWriter({
    path: targetPath,
    header: [
      { id: 'title', title: 'Title' },
      { id: 'company', title: 'Company' },
      { id: 'location', title: 'Location' },
      { id: 'link', title: 'Link' },
      { id: 'techStack', title: 'TechStack' },
      { id: 'listedAt', title: 'ListedAt' },
      { id: 'scrapedAt', title: 'ScrapedAt' },
      { id: 'seniority', title: 'SeniorityHint' },
      { id: 'isEntryLevel', title: 'IsEntryLevel' }
    ]
  });

  await csvWriter.writeRecords(records);
  return targetPath;
}

export function writeJson(records, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `linkedin-jobs-${timestamp}.json`;
  const targetPath = path.resolve(outputDir, filename);
  fs.writeFileSync(targetPath, JSON.stringify(records, null, 2), 'utf-8');
  return targetPath;
}
