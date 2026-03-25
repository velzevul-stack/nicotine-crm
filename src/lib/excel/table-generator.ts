import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { isSafePhotoUrl } from '@/lib/image-validate';
import { getCurrencySymbol } from '@/lib/currency';

export interface ExcelGeneratorInput {
  categories: Array<{
    id: string;
    name: string;
    emoji: string;
  }>;
  brands: Array<{
    id: string;
    name: string;
    emojiPrefix: string;
    photoUrl?: string | null;
    categoryId: string;
  }>;
  formats: Array<{
    id: string;
    brandId: string;
    name: string;
    strengthLabel: string;
    unitPrice: number;
    isLiquid: boolean;
  }>;
  flavors: Array<{
    id: string;
    productFormatId: string;
    name: string;
  }>;
  stocks: Array<{ flavorId: string; quantity: number }>;
  includeBrandPhotos?: boolean;
  currencyCode?: string;
}

const ROW_HEIGHT_PX = 18;
const IMAGE_MAX_HEIGHT = 80;
const IMAGE_MAX_WIDTH = 120;

const INFO_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFE8E8E8' },
};
const BRAND_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFDDEBF7' },
};
const OUT_OF_STOCK_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFFFCCCC' },
};

// Перенос по границам слов (Excel по умолчанию не разрывает слова)
const WRAP_ALIGNMENT = {
  wrapText: true,
  shrinkToFit: false,
  vertical: 'top' as const,
  horizontal: 'left' as const,
};

function applyInfoStyle(cell: ExcelJS.Cell) {
  cell.fill = INFO_FILL;
  cell.font = { bold: true };
  cell.alignment = WRAP_ALIGNMENT;
}
function applyBrandStyle(cell: ExcelJS.Cell) {
  cell.fill = BRAND_FILL;
  cell.font = { bold: true };
  cell.alignment = WRAP_ALIGNMENT;
}
function applyOutOfStockStyle(cell: ExcelJS.Cell) {
  cell.fill = OUT_OF_STOCK_FILL;
  cell.alignment = WRAP_ALIGNMENT;
}
function applyTextStyle(cell: ExcelJS.Cell) {
  cell.alignment = WRAP_ALIGNMENT;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Склеивает бренд и хвост без повтора, если хвост уже начинается с названия бренда (без учёта регистра). */
function joinBrandName(brand: string, detail: string): string {
  const b = brand.trim();
  const d = detail.trim();
  if (!d) return b;
  if (!b) return d;
  const re = new RegExp(`^${escapeRegExp(b)}(\\s|$)`, 'i');
  if (re.test(d)) return d;
  return `${b} ${d}`;
}

/** Убирает двойной префикс бренда в начале строки (напр. «Elf Bar Elf Bar Mango»). */
function dedupeLeadingBrandInLine(brand: string, line: string): string {
  const b = brand.trim();
  const t = line.trim();
  if (!b || !t) return t;
  const re = new RegExp(`^(?:${escapeRegExp(b)}\\s+){2,}`, 'i');
  return t.replace(re, `${b} `);
}

function categoryType(catName: string): 'liquids' | 'snus' | 'devices' | 'consumables' | 'disposables' | 'other' {
  const n = catName.toLowerCase();
  if (n.includes('жидкост') || n.includes('liquid')) return 'liquids';
  if (n.includes('снюс') || n.includes('snus')) return 'snus';
  if (n.includes('устройств') || n.includes('device') || n.includes('электрон')) return 'devices';
  if (n.includes('расходник') || n.includes('consumable') || n.includes('картридж')) return 'consumables';
  if (n.includes('однораз') || n.includes('disposable')) return 'disposables';
  return 'other';
}

export async function generateStockTable(
  input: ExcelGeneratorInput,
  outputPath: string
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const stockMap = new Map(input.stocks.map((s) => [s.flavorId, s.quantity]));
  const curSym = getCurrencySymbol(input.currencyCode ?? 'BYN');
  const priceInline = (unitPrice: number) =>
    unitPrice ? ` - ${unitPrice} ${curSym}` : '';
  const priceOnly = (unitPrice: number) =>
    unitPrice ? `${unitPrice} ${curSym}` : '';

  // Жидкости
  const liquidsCat = input.categories.find((c) => categoryType(c.name) === 'liquids');
  const brandRowMap = new Map<string, number>();
  if (liquidsCat) {
    const ws = wb.addWorksheet('Жидкости', { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.getColumn(1).width = 65;
    ws.getColumn(2).width = 28;

    let row = 1;
    const infoRow = ws.getRow(row);
    infoRow.height = 36;
    const infoCell = infoRow.getCell(1);
    infoCell.value = 'То, чего нет — выделено красным. Если не открывается полностью таблица, скачайте файл.';
    ws.mergeCells(`A${row}:B${row}`);
    applyInfoStyle(infoCell);
    row += 4;

    const liquidBrands = input.brands.filter((b) => b.categoryId === liquidsCat.id);
    for (const brand of liquidBrands) {
      const brandFormats = input.formats.filter(
        (f) => f.brandId === brand.id && f.isLiquid
      );
      for (const format of brandFormats) {
        const formatFlavors = input.flavors.filter((fl) => fl.productFormatId === format.id);
        if (formatFlavors.length === 0) continue;

        const formatLabel = [format.name, format.strengthLabel].filter(Boolean).join(' ');
        const brandFormatLabel = joinBrandName(brand.name, formatLabel);
        const priceStr = priceInline(format.unitPrice);

        const brandCell = ws.getRow(row).getCell(1);
        brandCell.value = `${brandFormatLabel}${priceStr}`;
        applyBrandStyle(brandCell);
        if (!brandRowMap.has(brand.id)) brandRowMap.set(brand.id, row);
        row++;

        for (const fl of formatFlavors) {
          const cell = ws.getRow(row).getCell(1);
          cell.value = fl.name;
          const qty = stockMap.get(fl.id) ?? 0;
          if (qty === 0) applyOutOfStockStyle(cell);
          else applyTextStyle(cell);
          row++;
        }
      }
    }
  }

  // Снюс
  const snusCat = input.categories.find((c) => categoryType(c.name) === 'snus');
  if (snusCat) {
    const ws = wb.addWorksheet('Снюс');
    const snusBrands = input.brands.filter((b) => b.categoryId === snusCat.id);
    const strengths = [...new Set(
      input.formats
        .filter((f) => snusBrands.some((b) => b.id === f.brandId))
        .map((f) => (f.strengthLabel || '').replace(/мг/gi, 'mg').trim())
        .filter(Boolean)
    )].sort();

    if (strengths.length > 0) {
      strengths.forEach((_, i) => ws.getColumn(i + 1).width = 50);
      ws.getRow(1).height = 24;
      strengths.forEach((s, i) => {
        const cell = ws.getRow(1).getCell(i + 1);
        cell.value = s;
        applyBrandStyle(cell);
      });
      let row = 2;
      const byStrength = new Map<string, Array<{ brand: string; flavor: string; flavorId: string }>>();
      for (const format of input.formats.filter((f) => snusBrands.some((b) => b.id === f.brandId))) {
        const brand = input.brands.find((b) => b.id === format.brandId);
        if (!brand) continue;
        const str = (format.strengthLabel || '').replace(/мг/gi, 'mg').trim() || 'other';
        if (!byStrength.has(str)) byStrength.set(str, []);
        const priceStr = priceInline(format.unitPrice);
        for (const fl of input.flavors.filter((f) => f.productFormatId === format.id)) {
          byStrength.get(str)!.push({
            brand: brand.name,
            flavor: `${joinBrandName(brand.name, fl.name)}${priceStr}`,
            flavorId: fl.id,
          });
        }
      }
      const maxRows = Math.max(...[...byStrength.values()].map((a) => a.length), 1);
      for (let r = 0; r < maxRows; r++) {
        strengths.forEach((str, col) => {
          const arr = byStrength.get(str) || [];
          const item = arr[r];
          if (item) {
            const cell = ws.getRow(row).getCell(col + 1);
            cell.value = item.flavor;
            const qty = stockMap.get(item.flavorId) ?? 0;
            if (qty === 0) applyOutOfStockStyle(cell);
            else applyTextStyle(cell);
          }
        });
        row++;
      }
    }
  }

  // Электронки (Устройства)
  const devicesCat = input.categories.find((c) => categoryType(c.name) === 'devices');
  if (devicesCat) {
    const ws = wb.addWorksheet('Электронки');
    ws.getColumn(1).width = 65;
    ws.getRow(1).height = 24;
    const infoCell = ws.getRow(1).getCell(1);
    infoCell.value = 'Электронные устройства — наличие уточняйте в директ';
    applyInfoStyle(infoCell);
    const headerCell = ws.getRow(2).getCell(1);
    headerCell.value = 'Наименование';
    applyBrandStyle(headerCell);
    let row = 3;
    const deviceBrands = input.brands.filter((b) => b.categoryId === devicesCat.id);
    for (const format of input.formats.filter((f) => deviceBrands.some((b) => b.id === f.brandId))) {
      const brand = input.brands.find((b) => b.id === format.brandId);
      const flavors = input.flavors.filter((f) => f.productFormatId === format.id);
      const priceStr = priceInline(format.unitPrice);
      const formatCell = ws.getRow(row).getCell(1);
      formatCell.value = `${format.name}${priceStr}`;
      applyBrandStyle(formatCell);
      row++;
      for (const fl of flavors) {
        const cell = ws.getRow(row).getCell(1);
        cell.value = fl.name;
        const qty = stockMap.get(fl.id) ?? 0;
        if (qty === 0) applyOutOfStockStyle(cell);
        else applyTextStyle(cell);
        row++;
      }
    }
  }

  // Расходники
  const consumablesCat = input.categories.find((c) => categoryType(c.name) === 'consumables');
  if (consumablesCat) {
    const ws = wb.addWorksheet('Расходники');
    ws.getColumn(1).width = 65;
    ws.getColumn(2).width = 18;
    ws.getRow(1).height = 24;
    const r1c1 = ws.getRow(1).getCell(1);
    r1c1.value = 'Расходники';
    applyInfoStyle(r1c1);
    const r2c1 = ws.getRow(2).getCell(1);
    const r2c2 = ws.getRow(2).getCell(2);
    r2c1.value = 'Наименование';
    r2c2.value = `Цена (${curSym})`;
    applyInfoStyle(r2c1);
    applyInfoStyle(r2c2);
    let row = 3;
    const consBrands = input.brands.filter((b) => b.categoryId === consumablesCat.id);
    for (const brand of consBrands) {
      const brandCell = ws.getRow(row).getCell(1);
      brandCell.value = `- ${brand.name.toUpperCase()} -`;
      applyBrandStyle(brandCell);
      row++;
      for (const format of input.formats.filter((f) => f.brandId === brand.id)) {
        const flavors = input.flavors.filter((f) => f.productFormatId === format.id);
        if (flavors.length > 0) {
          for (const fl of flavors) {
            const c1 = ws.getRow(row).getCell(1);
            const c2 = ws.getRow(row).getCell(2);
            c1.value = dedupeLeadingBrandInLine(brand.name, `${format.name} ${fl.name}`.trim());
            c2.value = format.unitPrice ? priceOnly(format.unitPrice) : '';
            const qty = stockMap.get(fl.id) ?? 0;
            if (qty === 0) applyOutOfStockStyle(c1);
            else applyTextStyle(c1);
            applyTextStyle(c2);
            row++;
          }
        } else {
          const c1 = ws.getRow(row).getCell(1);
          const c2 = ws.getRow(row).getCell(2);
          c1.value = dedupeLeadingBrandInLine(brand.name, format.name);
          c2.value = format.unitPrice ? priceOnly(format.unitPrice) : '';
          applyTextStyle(c1);
          applyTextStyle(c2);
          row++;
        }
      }
    }
  }

  // Одноразки
  const disposablesCat = input.categories.find((c) => categoryType(c.name) === 'disposables');
  if (disposablesCat) {
    const ws = wb.addWorksheet('Одноразки');
    ws.getColumn(1).width = 65;
    ws.getRow(1).height = 24;
    const r1c1 = ws.getRow(1).getCell(1);
    r1c1.value = 'Одноразки';
    applyInfoStyle(r1c1);
    const r2c1 = ws.getRow(2).getCell(1);
    r2c1.value = 'Наименование';
    applyInfoStyle(r2c1);
    let row = 3;
    const dispBrands = input.brands.filter((b) => b.categoryId === disposablesCat.id);
    for (const brand of dispBrands) {
      for (const format of input.formats.filter((f) => f.brandId === brand.id)) {
        const flavors = input.flavors.filter((f) => f.productFormatId === format.id);
        const priceStr = priceInline(format.unitPrice);
        const formatCell = ws.getRow(row).getCell(1);
        formatCell.value = `${joinBrandName(brand.name, format.name)}${priceStr}`;
        applyBrandStyle(formatCell);
        row++;
        for (const fl of flavors) {
          const cell = ws.getRow(row).getCell(1);
          cell.value = joinBrandName(brand.name, fl.name);
          const qty = stockMap.get(fl.id) ?? 0;
          if (qty === 0) applyOutOfStockStyle(cell);
          else applyTextStyle(cell);
          row++;
        }
      }
    }
  }

  // Add brand photos to Жидкости if enabled
  if (input.includeBrandPhotos && liquidsCat) {
    const ws = wb.getWorksheet('Жидкости');
    if (ws) {
      const liquidBrands = input.brands.filter(
        (b) => b.categoryId === liquidsCat.id && b.photoUrl && isSafePhotoUrl(b.photoUrl)
      );
      for (const brand of liquidBrands) {
        const photoPath = path.join(process.cwd(), 'public', brand.photoUrl!);
        const resolvedPath = path.resolve(photoPath);
        const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'brands');
        if (!resolvedPath.startsWith(uploadsDir)) continue;
        if (fs.existsSync(resolvedPath)) {
          try {
            const ext = path.extname(resolvedPath).toLowerCase();
            const extension: 'png' | 'jpeg' | 'gif' = ext === '.png' ? 'png' : ext === '.webp' ? 'jpeg' : 'jpeg';
            const imageId = wb.addImage({
              filename: resolvedPath,
              extension,
            });
            const rowNum = brandRowMap.get(brand.id);
            if (rowNum && rowNum > 0) {
              const dim = getImageDimensions(resolvedPath);
              ws.addImage(imageId, {
                tl: { col: 1, row: rowNum - 1 },
                ext: { width: dim.width, height: dim.height },
                editAs: 'oneCell',
              });
            }
          } catch {
            // Skip if image fails
          }
        }
      }
    }
  }

  await wb.xlsx.writeFile(outputPath);
  return outputPath;
}

function getImageDimensions(filePath: string): { width: number; height: number } {
  try {
    const full = fs.readFileSync(filePath);
    const buf = full.length > 65536 ? full.subarray(0, 65536) : full;
    const ext = path.extname(filePath).toLowerCase();
    let w = 0, h = 0;
    if (ext === '.png' && buf.length >= 24) {
      w = buf.readUInt32BE(16);
      h = buf.readUInt32BE(20);
    } else if ((ext === '.jpg' || ext === '.jpeg') && buf.length >= 2) {
      if (buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i < buf.length - 9) {
          if (buf[i] !== 0xff) break;
          const marker = buf[i + 1];
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            h = buf.readUInt16BE(i + 5);
            w = buf.readUInt16BE(i + 7);
            break;
          }
          const len = buf.readUInt16BE(i + 2);
          i += 2 + len;
        }
      }
    } else if (ext === '.webp' && buf.length >= 30) {
      if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
        w = buf.readUInt32LE(24);
        h = buf.readUInt32LE(28);
      }
    }
    if (w > 0 && h > 0) {
      const ratio = Math.min(IMAGE_MAX_WIDTH / w, IMAGE_MAX_HEIGHT / h, 1);
      return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
    }
  } catch {
    // fallback
  }
  return { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT };
}
