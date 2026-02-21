import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

export async function writeCsv(records, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `linkedin-jobs-${timestamp}.csv`;
  const targetPath = path.resolve(outputDir, filename);

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  fs.writeFileSync(targetPath, BOM, 'utf-8');

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
      { id: 'isEntryLevel', title: 'IsEntryLevel' },
      { id: 'isLikelyStartup', title: 'IsLikelyStartup' }
    ],
    append: true // Append after BOM
  });

  const recordsWithStartup = records.map((r) => ({
    ...r,
    isLikelyStartup: r.isLikelyStartup === true ? 'Yes' : 'No'
  }));

  await csvWriter.writeRecords(recordsWithStartup);
  return targetPath;
}

export function writeJson(records, outputDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `linkedin-jobs-${timestamp}.json`;
  const targetPath = path.resolve(outputDir, filename);
  fs.writeFileSync(targetPath, JSON.stringify(records, null, 2), 'utf-8');
  return targetPath;
}
