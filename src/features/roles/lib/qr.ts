// ISO/IEC 18004 QR Code (Versions 1-10, Byte mode, Error Correction Level L).
// Zero-dependency deterministic matrix generator for group invite URLs.

interface QrVersionSpec {
  version: number;
  size: number;
  totalCodewords: number;
  dataCodewords: number;
  ecPerBlock: number;
  blocks: number[];
  alignments: number[];
}

const QR_SPECS: readonly QrVersionSpec[] = [
  {
    version: 1,
    size: 21,
    totalCodewords: 26,
    dataCodewords: 19,
    ecPerBlock: 7,
    blocks: [19],
    alignments: [],
  },
  {
    version: 2,
    size: 25,
    totalCodewords: 44,
    dataCodewords: 34,
    ecPerBlock: 10,
    blocks: [34],
    alignments: [6, 18],
  },
  {
    version: 3,
    size: 29,
    totalCodewords: 70,
    dataCodewords: 55,
    ecPerBlock: 15,
    blocks: [55],
    alignments: [6, 22],
  },
  {
    version: 4,
    size: 33,
    totalCodewords: 100,
    dataCodewords: 80,
    ecPerBlock: 20,
    blocks: [80],
    alignments: [6, 26],
  },
  {
    version: 5,
    size: 37,
    totalCodewords: 134,
    dataCodewords: 108,
    ecPerBlock: 26,
    blocks: [108],
    alignments: [6, 30],
  },
  {
    version: 6,
    size: 41,
    totalCodewords: 172,
    dataCodewords: 136,
    ecPerBlock: 18,
    blocks: [68, 68],
    alignments: [6, 34],
  },
  {
    version: 7,
    size: 45,
    totalCodewords: 196,
    dataCodewords: 156,
    ecPerBlock: 20,
    blocks: [78, 78],
    alignments: [6, 22, 38],
  },
  {
    version: 8,
    size: 49,
    totalCodewords: 242,
    dataCodewords: 194,
    ecPerBlock: 24,
    blocks: [97, 97],
    alignments: [6, 24, 42],
  },
  {
    version: 9,
    size: 53,
    totalCodewords: 292,
    dataCodewords: 232,
    ecPerBlock: 30,
    blocks: [116, 116],
    alignments: [6, 26, 46],
  },
  {
    version: 10,
    size: 57,
    totalCodewords: 346,
    dataCodewords: 274,
    ecPerBlock: 18,
    blocks: [68, 68, 69, 69],
    alignments: [6, 28, 50],
  },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255] ?? 0;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)] ?? 0;
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i] ?? 0;
    for (let j = 0; j < poly.length; j++) {
      const term = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ term;
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(term, root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const work = new Uint8Array(data.length + ecLen);
  work.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = work[i] ?? 0;
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      work[i + j] = (work[i + j] ?? 0) ^ gfMul(gen[j] ?? 0, factor);
    }
  }
  return work.slice(data.length);
}

function pushBits(out: number[], value: number, count: number) {
  for (let i = count - 1; i >= 0; i--) {
    out.push((value >>> i) & 1);
  }
}

function encodeDataBits(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const bits: number[] = [];
  const countBits = spec.version < 10 ? 8 : 16;
  pushBits(bits, 0b0100, 4); // Byte mode
  pushBits(bits, bytes.length, countBits);
  for (const b of bytes) pushBits(bits, b, 8);

  const maxBits = spec.dataCodewords * 8;
  pushBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const pads = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(bits, pads[padIdx % 2] ?? 0xec, 8);
    padIdx++;
  }

  const out = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < spec.dataCodewords; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | (bits[i * 8 + b] ?? 0);
    }
    out[i] = val;
  }
  return out;
}

function buildCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const rawData = encodeDataBits(bytes, spec);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const len of spec.blocks) {
    const slice = rawData.slice(offset, offset + len);
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
    offset += len;
  }

  const result = new Uint8Array(spec.totalCodewords);
  let idx = 0;
  const maxDataLen = Math.max(...spec.blocks);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result[idx++] = block[i] ?? 0;
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      result[idx++] = ec[i] ?? 0;
    }
  }
  return result;
}

function formatBits(maskPattern: number): number {
  const data = (0b01 << 3) | (maskPattern & 0x7); // EC level L = 01
  let d = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (d & (1 << (i + 10))) d ^= 0x537 << i;
  }
  return ((data << 10) | d) ^ 0x5412;
}

function versionBits(version: number): number {
  let d = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (d & (1 << (i + 12))) d ^= 0x1f25 << i;
  }
  return (version << 12) | d;
}

function buildFunctionGrid(spec: QrVersionSpec): {
  modules: Uint8Array;
  isFunc: Uint8Array;
} {
  const n = spec.size;
  const modules = new Uint8Array(n * n);
  const isFunc = new Uint8Array(n * n);

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    modules[r * n + c] = dark ? 1 : 0;
    isFunc[r * n + c] = 1;
  };

  const drawFinder = (top: number, left: number) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const dark =
          dx >= 0 &&
          dx <= 6 &&
          dy >= 0 &&
          dy <= 6 &&
          (dx === 0 ||
            dx === 6 ||
            dy === 0 ||
            dy === 6 ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setFunc(top + dy, left + dx, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  for (const r of spec.alignments) {
    for (const c of spec.alignments) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          setFunc(r + dy, c + dx, dark);
        }
      }
    }
  }

  // Reserve format + dark module
  for (let i = 0; i <= 8; i++) {
    setFunc(8, i, false);
    setFunc(i, 8, false);
  }
  for (let i = n - 8; i < n; i++) setFunc(8, i, false);
  for (let i = n - 7; i < n; i++) setFunc(i, 8, false);
  setFunc(4 * spec.version + 9, 8, true);

  if (spec.version >= 7) {
    const vb = versionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const dark = ((vb >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = n - 11 + (i % 3);
      setFunc(a, b, dark);
      setFunc(b, a, dark);
    }
  }

  return { modules, isFunc };
}

function writeFormat(modules: Uint8Array, n: number, mask: number) {
  const fb = formatBits(mask);
  for (let i = 0; i <= 5; i++) modules[8 * n + i] = (fb >>> i) & 1;
  modules[8 * n + 7] = (fb >>> 6) & 1;
  modules[8 * n + 8] = (fb >>> 7) & 1;
  modules[7 * n + 8] = (fb >>> 8) & 1;
  for (let i = 9; i < 15; i++) modules[(14 - i) * n + 8] = (fb >>> i) & 1;

  for (let i = 0; i < 7; i++) modules[(n - 1 - i) * n + 8] = (fb >>> i) & 1;
  for (let i = 7; i < 15; i++) modules[8 * n + (n - 15 + i)] = (fb >>> i) & 1;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function penalty(modules: Uint8Array, n: number): number {
  let score = 0;
  let dark = 0;
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 0; c < n; c++) {
      const v = modules[r * n + c] ?? 0;
      if (v) dark++;
      if (c > 0 && v === (modules[r * n + c - 1] ?? 0)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if ((modules[r * n + c] ?? 0) === (modules[(r - 1) * n + c] ?? 0)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export interface QrMatrix {
  version: number;
  size: number;
  modules: boolean[];
}

export function encodeQrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const spec = QR_SPECS.find((s) => {
    const headerBits = 4 + (s.version < 10 ? 8 : 16);
    return headerBits + bytes.length * 8 <= s.dataCodewords * 8;
  });
  if (!spec) throw new Error("QR payload exceeds maximum supported length");

  const codewords = buildCodewords(bytes, spec);
  const { modules: baseModules, isFunc } = buildFunctionGrid(spec);
  const n = spec.size;

  let bitIdx = 0;
  let upward = true;
  for (let col = n - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const r = upward ? n - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (isFunc[r * n + c]) continue;
        const cw = codewords[Math.floor(bitIdx / 8)] ?? 0;
        const bit = (cw >>> (7 - (bitIdx % 8))) & 1;
        baseModules[r * n + c] = bit;
        bitIdx++;
      }
    }
    upward = !upward;
  }

  let bestModules = new Uint8Array(baseModules);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = new Uint8Array(baseModules);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!isFunc[r * n + c] && maskBit(mask, r, c)) {
          candidate[r * n + c] = (candidate[r * n + c] ?? 0) ^ 1;
        }
      }
    }
    writeFormat(candidate, n, mask);
    const score = penalty(candidate, n);
    if (score < bestScore) {
      bestScore = score;
      bestModules = candidate;
    }
  }

  return {
    version: spec.version,
    size: n,
    modules: Array.from(bestModules, (v) => v === 1),
  };
}

export function qrToSvgPath(qr: QrMatrix, margin = 2): string {
  const parts: string[] = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r * qr.size + c]) {
        parts.push(`M${c + margin},${r + margin}h1v1h-1z`);
      }
    }
  }
  return parts.join("");
}
