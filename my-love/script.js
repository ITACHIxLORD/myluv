const { spawnSync } = require("child_process");

// فعال‌سازی رنگ ANSI در ویندوز
// Enable ANSI color on Windows (original: os.system("") when os.name == "nt")
if (process.platform === "win32") {
  spawnSync("", { shell: true, stdio: "inherit" });
}

const RED = "\x1b[91m";
const PINK = "\x1b[95m";
const WHITE = "\x1b[97m";
const RESET = "\x1b[0m";

// --- فونت نقطه‌ای برای حروف اسم ---
// --- Dot font for name letters ---
const FONT = {
  r: ["# #", "# #", "#  ", "#  ", "#  "],
  a: [" # ", "# #", "###", "# #", "# #"],
  v: ["# #", "# #", "# #", " # ", " # "],
};

// Python-compatible round(): rounds half to even (banker's rounding)
function pyRound(x) {
  if (Math.abs(x % 1) === 0.5) {
    return 2 * Math.round(x / 2);
  }
  return Math.round(x);
}

function buildTextMatrix(name) {
  /** حروف اسم را کنار هم می‌چیند و یک ماتریس 0/1 می‌سازد. */
  /** Places the name's letters side by side and builds a 0/1 matrix. */
  const rows = 5;
  const cols = [];
  const chars = [...name];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const glyph = FONT[ch.toLowerCase()] ?? Array(rows).fill("   ");
    cols.push(glyph);
    if (i !== chars.length - 1) {
      cols.push(Array(rows).fill(" ")); // فاصله بین حروف / space between letters
    }
  }

  const matrix = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (const glyph of cols) {
      for (const c of glyph[r]) {
        line.push(c === "#" ? 1 : 0);
      }
    }
    matrix.push(line);
  }
  return matrix;
}

function heartPoints(size = 1.0, layers = 14) {
  /** قلب سه‌بعدی می‌سازد: چند لایه در عمق تا موقع چرخش ضخامت داشته باشد. */
  /** Builds a 3D heart: several layers in depth so it has thickness when rotated. */
  const points = [];
  for (let li = 0; li < layers; li++) {
    // هر لایه کمی در عمق جابه‌جا می‌شود تا حجم ایجاد شود
    // each layer is shifted slightly in depth to create volume
    const z = (li - (layers - 1) / 2) * 0.06 * size;
    const shrink = 1.0 - 0.04 * Math.abs(li - (layers - 1) / 2);
    const n = 220;
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      const hx = 16 * Math.sin(t) ** 3;
      const hy =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      const x = hx * size * 0.07 * shrink;
      const y = -hy * size * 0.07 * shrink;
      points.push([x, y, z]);
    }
  }
  return points;
}

function rotatePoints(points, angle, tilt = 0.35) {
  /** نقاط را حول محور عمودی و کمی حول محور افقی می‌چرخاند. */
  /** Rotates points around the vertical axis and slightly around the horizontal axis. */
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const out = [];
  for (const [x, y, z] of points) {
    // چرخش حول محور Y / rotation around the Y axis
    const rx = x * ca + z * sa;
    const rz = -x * sa + z * ca;
    // کمی چرخش حول محور X برای اینکه صفحه صاف نباشه
    // slight rotation around the X axis so the plane is not flat
    const ry = y * ct - rz * st;
    const rz2 = y * st + rz * ct;
    out.push([rx, ry, rz2]);
  }
  return out;
}

function scaleMatrix(matrix, factor) {
  /** ماتریس را بزرگ می‌کند تا در ترمینال دیده شود. */
  /** Enlarges the matrix so it is visible in the terminal. */
  const h = matrix.length;
  const w = matrix[0].length;
  const out = Array.from({ length: h * factor }, () =>
    Array(w * factor).fill(0)
  );
  for (let r = 0; r < h * factor; r++) {
    for (let c = 0; c < w * factor; c++) {
      out[r][c] = matrix[Math.trunc(r / factor)][Math.trunc(c / factor)];
    }
  }
  return out;
}

function render(points, width, height) {
  /** نقاط چرخیده را به بافر کاراکتری با سایه‌پردازی تبدیل می‌کند. */
  /** Converts rotated points into a character buffer with shading. */
  const buf = Array.from({ length: height }, () => Array(width).fill(" "));
  const depth = Array.from({ length: height }, () =>
    Array(width).fill(-1e9)
  );

  // مقیاس افقی مناسب ترمینال (کاراکترها بلندتر از عرض‌اند)
  // horizontal scale suitable for a terminal (characters are taller than wide)
  const sx = 26.0;
  const sy = 16.0;

  for (const [x, y, z] of points) {
    const px = Math.trunc(pyRound(x * sx + width / 2));
    const py = Math.trunc(pyRound(y * sy + height / 2));
    if (0 <= px && px < width && 0 <= py && py < height && z > depth[py][px]) {
      depth[py][px] = z;
      if (z > 0.3) {
        buf[py][px] = WHITE + "@" + RESET;
      } else if (z > -0.3) {
        buf[py][px] = PINK + "#" + RESET;
      } else {
        buf[py][px] = RED + "*" + RESET;
      }
    }
  }
  return buf;
}

function makePoints(matrix) {
  /** هر پیکسل ماتریس را به یک نقطه سه‌بعدی تبدیل می‌کند. */
  /** Converts each pixel of the matrix into a 3D point. */
  const h = matrix.length;
  const w = matrix[0].length;
  const points = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (matrix[r][c]) {
        const x = (c - w / 2) * 0.5;
        const y = (r - h / 2) * 0.9; // کشیدگی عمودی برای ترمینال / vertical stretch for the terminal
        points.push([x, y, 0.0]);
      }
    }
  }
  return points;
}

function heartShellPoints(name, size = 1.0, layers = 7, n = 420, depth = 0.55) {
  /**
   * فقط پوسته‌ی قلب را با حروف اسم می‌سازد.
   *
   * برخلاف نسخه‌ی قبلی که کل داخل قلب را پر می‌کرد (و به یک بلوک حروف
   * تبدیل می‌شد)، اینجا فقط نقاط نزدیک به مرز قلب نگه داشته می‌شوند تا
   * هنگام چرخش، شکل قلب حفظ شود و حروف r/a/v سطح آن را بسازند.
   */
  /**
   * Builds only the shell of the heart using the letters of the name.
   *
   * Unlike the previous version that filled the whole inside of the heart
   * (and turned into a block of letters), only points near the heart's border
   * are kept here so the heart shape is preserved while rotating, and the
   * letters r/a/v form its surface.
   */
  const chars = [...name.toLowerCase()].filter((c) => c !== " ");
  const charList = chars.length > 0 ? chars : ["*"];
  const points = [];
  for (let li = 0; li < layers; li++) {
    // لایه‌های عمق: بیرونی‌ترین لایه‌ها کمی کوچک‌تر تا حس حجم بدهند
    // depth layers: outermost layers are slightly smaller to give a sense of volume
    const z = (li - (layers - 1) / 2) * (depth / Math.max(layers - 1, 1));
    const shrink = 1.0 - 0.06 * Math.abs(li - (layers - 1) / 2);
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      const hx = 16 * Math.sin(t) ** 3;
      const hy =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      const x = hx * size * 0.07 * shrink;
      const y = -hy * size * 0.07 * shrink;
      const ch = charList[i % charList.length];
      points.push([x, y, z, ch]);
    }
  }
  return points;
}

function renderHeartName(points, width, height) {
  /** نقاط قلبِ حروف‌دار را به بافر کاراکتری تبدیل می‌کند. */
  /** Converts the lettered heart points into a character buffer. */
  const buf = Array.from({ length: height }, () => Array(width).fill(" "));
  const depth = Array.from({ length: height }, () =>
    Array(width).fill(-1e9)
  );

  // مقیاس افقی مناسب ترمینال (کاراکترها بلندتر از عرض‌اند)
  // horizontal scale suitable for a terminal (characters are taller than wide)
  const sx = 24.0;
  const sy = 14.0;

  for (const [x, y, z, ch] of points) {
    const px = Math.trunc(pyRound(x * sx + width / 2));
    const py = Math.trunc(pyRound(y * sy + height / 2));
    // فقط نزدیک‌ترین نقطه در هر پیکسل رندر شود تا شکل حفظ شود
    // only the nearest point per pixel is rendered so the shape is preserved
    if (0 <= px && px < width && 0 <= py && py < height && z > depth[py][px]) {
      depth[py][px] = z;
      let color;
      if (z > 0.15) {
        color = WHITE;
      } else if (z > -0.15) {
        color = PINK;
      } else {
        color = RED;
      }
      buf[py][px] = color + ch + RESET;
    }
  }
  return buf;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Ctrl+C handling (original: except KeyboardInterrupt -> sys.exit(0))
  process.on("SIGINT", () => {
    process.exit(0);
  });

  // خودِ اسم "rava" پوسته‌ی قلب را می‌سازد و کل قلب می‌چرخد
  // the name "rava" itself builds the heart shell and the whole heart rotates
  const basePoints = heartShellPoints("rava", 1.0);
  const width = 80;
  const height = 30;
  let angle = 0.0;

  while (true) {
    const rotated = rotatePoints(
      basePoints.map(([x, y, z, _]) => [x, y, z]),
      angle
    );
    const chars = basePoints.map(([, , , c]) => c);
    const tagged = rotated.map(([x, y, z], i) => [x, y, z, chars[i]]);
    const buf = renderHeartName(tagged, width, height);
    spawnSync(process.platform === "win32" ? "cls" : "clear", {
      shell: true,
      stdio: "inherit",
    });
    for (const row of buf) {
      console.log(row.join(""));
    }
    angle += 0.10;
    await sleep(50);
  }
}

if (require.main === module) {
  main();
}
