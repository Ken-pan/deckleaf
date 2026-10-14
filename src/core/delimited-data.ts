export function decodeDataFile(bytes: Uint8Array): string {
  if (bytes.byteLength > 250_000) throw new Error('Use a data file smaller than 250 KB.');
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
  try {return new TextDecoder(encoding, {fatal: true}).decode(bytes);} catch {throw new Error('Save the file as UTF-8 CSV or Unicode TSV, then import it again.');}
}

export function delimitedRows(text: string, forcedDelimiter?: string, preserveEmptyRows = false, maxRows = 101, maxColumns = 9): {rows: string[][]; delimiter: string} {
  if (text.length > 250_000) throw new Error('Use a data file smaller than 250 KB.');
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!preserveEmptyRows) text = text.replace(/^\n+/, '');
  const directive = forcedDelimiter ? null : text.match(/^sep=([,;\t])\n/i);
  if (directive) text = text.slice(directive[0].length);
  const counts = {',': 0, ';': 0, '\t': 0}; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (c === '"') {if (inQuotes && text[i + 1] === '"') i++; else inQuotes = !inQuotes;}
    else if (!inQuotes) {if (c === '\n') break; if (c in counts) counts[c as keyof typeof counts]++;}
  }
  const delimiter = forcedDelimiter ?? directive?.[1] ?? Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {if (c === '"') {if (text[i + 1] === '"') {cell += '"'; i++;} else {quoted = false; closed = true;}} else cell += c;}
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === delimiter || c === '\n') {row.push(cell); cell = ''; closed = false; if (c === '\n') {if (preserveEmptyRows || row.some(v => v.trim())) rows.push(row); row = [];}}
    else {if (c === '"' || (closed && c.trim())) throw new Error('Check the quotes and separators in your data.'); cell += c;}
    if (rows.length > maxRows || row.length >= maxColumns) throw new Error(`Use up to ${maxRows} rows and ${maxColumns} columns.`);
  }
  if (quoted) throw new Error('Close the quoted field in your data.');
  row.push(cell); if (row.some(v => v.trim()) || preserveEmptyRows && !text.endsWith('\n')) rows.push(row);
  if (rows.length > maxRows || rows.some(row => row.length > maxColumns)) throw new Error(`Use up to ${maxRows} rows and ${maxColumns} columns.`);
  return {rows, delimiter};
}
