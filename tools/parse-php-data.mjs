// Reads the QFarm PHP config tables (simple array literals) and writes JSON.
//   node parse-php-data.mjs <file.php> <out.json> [outerVarName]
// A tiny recursive-descent parser for the subset of PHP these tables use:
//   $name = array( "k" => array(...), "k2" => "str", "k3" => 12, "k4" => true, );
import { readFileSync, writeFileSync } from 'node:fs';

function parsePHPLiteral(src, start) {
  let i = start;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const lit = () => {
    ws();
    if (src.startsWith('array(', i)) {
      i += 6; ws();
      const isList = src[i] !== '"' && src[i] !== "'";
      const out = isList ? [] : {};
      let n = 0;
      while (i < src.length && src[i] !== ')') {
        ws();
        let key = null;
        // lookahead: a string/number followed by => is a key
        const save = i;
        let probe = '';
        if (src[i] === '"' || src[i] === "'") {
          const q = src[i++]; probe = '';
          while (i < src.length && src[i] !== q) {
            if (src[i] === '\\') { probe += src[i + 1]; i += 2; } else probe += src[i++];
          }
          i++;
        } else {
          while (i < src.length && /[-\d.]/.test(src[i])) probe += src[i++];
        }
        ws();
        if (src.startsWith('=>', i)) { i += 2; key = probe; } else { i = save; }
        const value = lit();
        if (key === null) out[n++] = value; else out[key] = value;
        ws();
        if (src[i] === ',') i++;
        ws();
      }
      i++; return out;
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++]; let s = '';
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') {
          const c = src[i + 1];
          // PHP double-quoted escapes we might meet
          if (q === '"' && c === 'n') s += '\n'; else if (q === '"' && c === 'r') s += '\r';
          else if (q === '"' && c === 't') s += '\t'; else s += c;
          i += 2;
        } else s += src[i++];
      }
      i++; return s;
    }
    if (src.startsWith('true', i)) { i += 4; return true; }
    if (src.startsWith('false', i)) { i += 5; return false; }
    if (src.startsWith('null', i)) { i += 4; return null; }
    let num = '';
    while (i < src.length && /[-\d.eE+]/.test(src[i])) num += src[i++];
    if (num === '' || num === '-') { i++; return null; }   // unparseable token, skip it
    return num.includes('.') ? parseFloat(num) : parseInt(num, 10);
  };
  ws();
  return lit();
}

const [file, out, varName] = process.argv.slice(2);
let src = readFileSync(file, 'utf8');
// strip // and # comments (line comments only; no /* */ in these files matters)
src = src.split('\n').map((line) => line.replace(/(^|\s)(\/\/|#).*$/, '$1')).join('\n');
const name = varName ?? (src.match(/\$(\w+)\s*=\s*array\(/) ?? [])[1];
if (!name) { console.error('could not find the array variable'); process.exit(2); }
const at = src.search(new RegExp(`\\$${name}\\s*=\\s*array\\(`));
const value = parsePHPLiteral(src, src.indexOf('array(', at));
writeFileSync(out, JSON.stringify(value, null, 0));
console.log(`${file} -> ${out}: $${name}, ${Object.keys(value).length} entries`);
