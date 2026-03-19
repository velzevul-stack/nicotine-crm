export type TemplateNode =
  | { type: 'text'; content: string }
  | { type: 'variable'; name: string; path?: string[] }
  | { type: 'condition'; condition: string; children: TemplateNode[] }
  | { type: 'loop'; loopType: string; children: TemplateNode[] };

export function parseTemplate(template: string): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  let i = 0;

  while (i < template.length) {
    // Check for opening tags: {if:...}, {loop:...}, or variables {var}
    if (template[i] === '{') {
      const tagEnd = template.indexOf('}', i);
      if (tagEnd === -1) {
        // Unclosed tag, treat as text
        nodes.push({ type: 'text', content: template.substring(i) });
        break;
      }

      const tagContent = template.substring(i + 1, tagEnd);
      
      // Check for closing tags
      if (tagContent.startsWith('/')) {
        // Closing tag - return what we have so far
        break;
      }

      // Check for condition: {if:condition}
      if (tagContent.startsWith('if:')) {
        const condition = tagContent.substring(3);
        const closingTag = `{/if}`;
        const closingIndex = findClosingTag(template, tagEnd + 1, closingTag);
        
        if (closingIndex === -1) {
          // No closing tag found, treat as text
          nodes.push({ type: 'text', content: template.substring(i, tagEnd + 1) });
          i = tagEnd + 1;
          continue;
        }

        const innerContent = template.substring(tagEnd + 1, closingIndex);
        const children = parseTemplate(innerContent);
        
        nodes.push({
          type: 'condition',
          condition,
          children,
        });

        i = closingIndex + closingTag.length;
        continue;
      }

      // Check for loop: {loop:type}
      if (tagContent.startsWith('loop:')) {
        const loopType = tagContent.substring(5);
        const closingTag = `{/loop}`;
        const closingIndex = findClosingTag(template, tagEnd + 1, closingTag);
        
        if (closingIndex === -1) {
          // No closing tag found, treat as text
          nodes.push({ type: 'text', content: template.substring(i, tagEnd + 1) });
          i = tagEnd + 1;
          continue;
        }

        const innerContent = template.substring(tagEnd + 1, closingIndex);
        const children = parseTemplate(innerContent);
        
        nodes.push({
          type: 'loop',
          loopType,
          children,
        });

        i = closingIndex + closingTag.length;
        continue;
      }

      // Variable: {variable.name} or {variable}
      const dotIndex = tagContent.indexOf('.');
      if (dotIndex !== -1) {
        const varName = tagContent.substring(0, dotIndex);
        const path = tagContent.substring(dotIndex + 1).split('.');
        nodes.push({
          type: 'variable',
          name: varName,
          path,
        });
      } else {
        nodes.push({
          type: 'variable',
          name: tagContent,
        });
      }

      i = tagEnd + 1;
    } else {
      // Regular text
      const nextOpen = template.indexOf('{', i);
      if (nextOpen === -1) {
        nodes.push({ type: 'text', content: template.substring(i) });
        break;
      }
      
      if (nextOpen > i) {
        nodes.push({ type: 'text', content: template.substring(i, nextOpen) });
      }
      i = nextOpen;
    }
  }

  return nodes;
}

function findClosingTag(
  template: string,
  startIndex: number,
  closingTag: string
): number {
  let depth = 1;
  let i = startIndex;

  while (i < template.length) {
    if (template[i] === '{') {
      const tagEnd = template.indexOf('}', i);
      if (tagEnd === -1) break;

      const tagContent = template.substring(i + 1, tagEnd);
      
      // Check if it's an opening tag of the same type
      if (
        (closingTag === '{/if}' && tagContent.startsWith('if:')) ||
        (closingTag === '{/loop}' && tagContent.startsWith('loop:'))
      ) {
        depth++;
      } else if (
        (closingTag === '{/if}' && tagContent === '/if') ||
        (closingTag === '{/loop}' && tagContent === '/loop')
      ) {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
      
      i = tagEnd + 1;
    } else {
      i++;
    }
  }

  return -1;
}
