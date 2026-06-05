import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const SOURCE_URL = "https://astronexus.com/downloads/catalogs/hygdata_v42.csv.gz";
const OUTPUT = resolve("public/stars/hyg-stars.bin");

interface StarRow {
  ra: number;
  dec: number;
  mag: number;
  bv: number;
}

async function main(): Promise<void> {
  const source = process.argv.includes("--sample") ? sampleCsv() : await fetchCsv();
  const stars = parseCsv(source).filter((star) => star.mag <= 6.5);
  await mkdir(dirname(OUTPUT), { recursive: true });
  const buffer = new Float32Array(stars.length * 4);
  stars.forEach((star, index) => {
    const offset = index * 4;
    buffer[offset] = star.ra;
    buffer[offset + 1] = star.dec;
    buffer[offset + 2] = star.mag;
    buffer[offset + 3] = Number.isFinite(star.bv) ? star.bv : 0.65;
  });
  await writeFile(OUTPUT, Buffer.from(buffer.buffer));
  console.log(`Wrote ${stars.length} stars to ${OUTPUT}`);
}

async function fetchCsv(): Promise<string> {
  const localPath = process.env.HYG_CSV;
  if (localPath) return readFile(localPath, "utf8");
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`HYG download failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return SOURCE_URL.endsWith(".gz") ? gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
}

function parseCsv(csv: string): StarRow[] {
  const lines = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  const index = (name: string) => headers.indexOf(name);
  const raIndex = index("ra");
  const decIndex = index("dec");
  const magIndex = index("mag");
  const bvIndex = index("ci");

  return lines.slice(1).flatMap((line) => {
    const columns = splitCsvLine(line);
    const star = {
      ra: Number(columns[raIndex]),
      dec: Number(columns[decIndex]),
      mag: Number(columns[magIndex]),
      bv: Number(columns[bvIndex])
    };
    return Number.isFinite(star.ra) && Number.isFinite(star.dec) && Number.isFinite(star.mag) ? [star] : [];
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function sampleCsv(): string {
  return [
    "id,hip,hd,hr,gl,bf,proper,ra,dec,dist,pmra,pmdec,rv,mag,absmag,spect,ci",
    "0,0,0,0,,,,6.7525,-16.7161,2.6,0,0,0,-1.46,1.4,A1V,0.00",
    "1,0,0,0,,,,5.9195,7.4071,197,0,0,0,0.42,-5.0,M2Iab,1.85",
    "2,0,0,0,,,,14.2610,19.1825,11.3,0,0,0,-0.05,0.6,K2III,1.23",
    "3,0,0,0,,,,18.6156,38.7837,7.7,0,0,0,0.03,0.6,A0V,0.00",
    "4,0,0,0,,,,2.5303,89.2641,132,0,0,0,1.98,-3.6,F7Ib,0.60",
    "5,0,0,0,,,,7.6550,5.2250,250,0,0,0,0.40,-6.6,M1Iab,1.50",
    "6,0,0,0,,,,5.2423,-8.2016,260,0,0,0,0.18,-6.9,B8I, -0.03",
    "7,0,0,0,,,,13.4199,-11.1613,80,0,0,0,0.98,-3.5,B1V,-0.23"
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
