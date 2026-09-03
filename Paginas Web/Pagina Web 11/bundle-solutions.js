import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputsDir = path.resolve(__dirname, '../../Outputs');
const files = fs.readdirSync(outputsDir).filter(f => f.endsWith('.txt') || f.endsWith('.json'));

const data = {};
for (const f of files) {
  const content = fs.readFileSync(path.join(outputsDir, f), 'utf-8');
  data[f] = JSON.parse(content);
}

const targetPath = path.join(__dirname, 'src', 'lib', 'defaultSolutions.ts');
const tsContent = `import { SolutionData } from "../types/tsppd";

export const DEFAULT_SOLUTIONS: Record<string, SolutionData> = ${JSON.stringify(data, null, 2)};
`;

fs.writeFileSync(targetPath, tsContent, 'utf-8');
console.log(`Successfully generated defaultSolutions.ts with ${Object.keys(data).length} solutions!`);
