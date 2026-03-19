import { parseTemplate, TemplateNode } from './template-parser';
import { PostFormatConfig } from '@/lib/db/entities/PostFormat';

export interface CategoryData {
  id: string;
  name: string;
  emoji: string;
  brands: BrandData[];
}

export interface BrandData {
  id: string;
  name: string;
  emojiPrefix: string;
  formats: FormatData[];
}

export interface FormatData {
  id: string;
  name: string;
  price: number;
  strength?: string;
  flavors: FlavorData[];
}

export interface FlavorData {
  id: string;
  name: string;
  stock?: number;
}

export interface ShopData {
  name: string;
  address?: string | null;
}

export interface PostData {
  categories: CategoryData[];
  shop?: ShopData;
}

export interface FormatConfig extends PostFormatConfig {
  showFlavors?: boolean;
  showPrices?: boolean;
  showStock?: boolean;
  showCategories?: boolean;
}

const defaultConfig: FormatConfig = {
  showFlavors: true,
  showPrices: true,
  showStock: false,
  showCategories: true,
};

export function renderTemplate(
  template: string,
  data: PostData,
  config: FormatConfig = {}
): string {
  const mergedConfig = { ...defaultConfig, ...config };
  const nodes = parseTemplate(template);
  return renderNodes(nodes, data, mergedConfig, {});
}

function renderNodes(
  nodes: TemplateNode[],
  data: PostData,
  config: FormatConfig,
  context: Record<string, any>
): string {
  let result = '';

  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        result += node.content;
        break;

      case 'variable':
        result += resolveVariable(node.name, node.path, data, config, context);
        break;

      case 'condition':
        if (evaluateCondition(node.condition, data, config, context)) {
          result += renderNodes(node.children, data, config, context);
        }
        break;

      case 'loop':
        result += renderLoop(node.loopType, node.children, data, config, context);
        break;
    }
  }

  return result;
}

function resolveVariable(
  name: string,
  path: string[] | undefined,
  data: PostData,
  config: FormatConfig,
  context: Record<string, any>
): string {
  // Check context first (for loop variables)
  if (context[name] && path) {
    return getNestedValue(context[name], path) || '';
  }
  if (context[name] && !path) {
    return String(context[name] || '');
  }

  // Special variables
  if (name === 'content') {
    return renderContent(data, config);
  }

  // Shop variables
  if (name === 'shop' && data.shop) {
    if (path && path[0]) {
      return String(getNestedValue(data.shop, path) || '');
    }
    return data.shop.name || '';
  }

  // For category/brand/format/flavor variables, they should be used within loops
  return '';
}

function renderContent(data: PostData, config: FormatConfig): string {
  const lines: string[] = [];

  for (const category of data.categories) {
    let categoryHasItems = false;

    for (const brand of category.brands) {
      for (const format of brand.formats) {
        if (format.flavors.length === 0 && config.showFlavors !== false) {
          continue;
        }

        if (!categoryHasItems && config.showCategories !== false) {
          lines.push(`${category.emoji} ${category.name.toUpperCase()} ${category.emoji}`);
          lines.push('');
          categoryHasItems = true;
        }

        // Format header
        const headerParts = [format.name];
        if (format.strength) {
          headerParts.push(format.strength);
        }
        const priceStr = config.showPrices !== false ? ` (${format.price} BYN)` : '';
        const header = `${brand.emojiPrefix}${headerParts.join(' ')}${brand.emojiPrefix}:${priceStr}`;
        lines.push(header);

        // Flavors
        if (config.showFlavors !== false) {
          for (const flavor of format.flavors) {
            const stockStr =
              flavor.stock !== undefined && flavor.stock > 1
                ? ` (${flavor.stock})`
                : '';
            lines.push(`• ${flavor.name}${stockStr}`);
          }
        }
        lines.push('');
      }
    }

    if (categoryHasItems) {
      lines.push('—————————————————');
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function renderLoop(
  loopType: string,
  children: TemplateNode[],
  data: PostData,
  config: FormatConfig,
  parentContext: Record<string, any>
): string {
  let result = '';

  switch (loopType) {
    case 'categories':
      for (const category of data.categories) {
        const context = { ...parentContext, category };
        result += renderNodes(children, data, config, context);
      }
      break;

    case 'brands':
      // Brands should be accessed from category context
      const category = parentContext.category as CategoryData | undefined;
      if (category) {
        for (const brand of category.brands) {
          const context = { ...parentContext, brand };
          result += renderNodes(children, data, config, context);
        }
      }
      break;

    case 'formats':
      // Formats should be accessed from brand context
      const brand = parentContext.brand as BrandData | undefined;
      if (brand) {
        for (const format of brand.formats) {
          const context = { ...parentContext, format };
          result += renderNodes(children, data, config, context);
        }
      }
      break;

    case 'flavors':
      // Flavors should be accessed from format context
      const format = parentContext.format as FormatData | undefined;
      if (format) {
        for (const flavor of format.flavors) {
          const context = { ...parentContext, flavor };
          result += renderNodes(children, data, config, context);
        }
      }
      break;
  }

  return result;
}

function evaluateCondition(
  condition: string,
  data: PostData,
  config: FormatConfig,
  context: Record<string, any>
): boolean {
  // Check for negation
  const negated = condition.startsWith('!');
  const actualCondition = negated ? condition.substring(1) : condition;

  // Check config flags
  if (actualCondition === 'showFlavors') {
    return negated ? config.showFlavors === false : config.showFlavors !== false;
  }
  if (actualCondition === 'showPrices') {
    return negated ? config.showPrices === false : config.showPrices !== false;
  }
  if (actualCondition === 'showStock') {
    return negated ? config.showStock === false : config.showStock === true;
  }
  if (actualCondition === 'showCategories') {
    return negated ? config.showCategories === false : config.showCategories !== false;
  }

  // Check context variables
  if (actualCondition === 'hasFlavors') {
    const format = context.format as FormatData | undefined;
    const hasFlavors = format ? format.flavors.length > 0 : false;
    return negated ? !hasFlavors : hasFlavors;
  }

  if (actualCondition === 'hasStock') {
    const flavor = context.flavor as FlavorData | undefined;
    const hasStock = flavor ? (flavor.stock ?? 0) > 0 : false;
    return negated ? !hasStock : hasStock;
  }

  // Check if context variable exists
  if (context[actualCondition] !== undefined) {
    const value = context[actualCondition];
    return negated ? !value : !!value;
  }

  return false;
}

function getNestedValue(obj: any, path: string[]): any {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[key];
  }
  return current;
}
