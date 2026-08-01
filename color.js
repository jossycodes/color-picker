import Picker from './picker.js'
import { hex2hsl, hex2rgb, xy2polar, hsl2hex, rgb2hex, hsv2rgb, rad2deg } from './conversion.js'


const canvas = document.querySelector('#canvas');
const _canvas = document.querySelector('#canvas2');
const _r = document.querySelector(':root');
const code = document.querySelector('#code');
const depth = document.querySelector("#depth");
const type = document.querySelector('#type');
const dialog = document.querySelector('#dialog');
const plates = document.querySelector('#plates');
const items = document.querySelectorAll('.list-item');
const themeToggle = document.querySelector('#theme-toggle');


let pixels = []
let pickers = [];

const modes = [
  { name: 'single', colors: 1 },
  { name: 'complimentary', colors: 2 },
  { name: 'monochromic', colors: 3 },
  { name: 'analogous', colors: 3 },
  { name: 'triadic', colors: 3 },
  { name: 'tedradic', colors: 4 }
]
let mode = modes[0]

const ctx = canvas.getContext('2d', { willReadFrequently: true });
const dpi = window.devicePixelRatio || 1;

let size;      // CSS pixel size of the canvas (square)
let radius;    // device-pixel radius used for the pixel math

function layoutCanvas() {
  // Recompute the square canvas size to fit the viewport, leaving room
  // for the controls beneath it. Runs on load and on resize/orientation
  // change so the wheel stays responsive instead of being fixed to
  // whatever size the window happened to be on first load.
  const container = canvas.closest('.box') || document.body;
  const maxWidth = container.clientWidth || window.innerWidth;
  const available = Math.min(maxWidth, window.innerHeight * 0.6);

  size = Math.max(180, Math.floor(available) - 32);

  canvas.style.height = _canvas.style.height = size + 'px';
  canvas.style.width = _canvas.style.width = size + 'px';

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // BUG FIX: `radius` used to be computed as `size * dpi / 2`. That's
  // only an integer when `size * dpi` happens to be even -- but `dpi`
  // (devicePixelRatio) is frequently fractional in the real world (OS
  // display scaling at 125%/150%/250% on Windows, some Android phones,
  // non-100% browser zoom all produce dpi values like 1.5 or 2.5). When
  // radius came out fractional, `createImageData(2*radius, 2*radius)`
  // silently rounded to an integer width while the fill loop below kept
  // using the *unrounded* value as its row length -- so every row after
  // the first landed a few pixels off from where it actually needed to
  // be, tearing the wheel into diagonal strips and making sampled colors
  // go erratic near the seam. Rounding radius to an integer FIRST, and
  // deriving the canvas buffer size from that same integer, guarantees
  // the fill's row length and the buffer's real width always agree.
  radius = Math.round((size * dpi) / 2);

  canvas.width = canvas.height = radius * 2;
  _canvas.width = _canvas.height = radius * 2;

  drawCircle();
}

let image, data;

function drawCircle() {
  pixels = [];
  image = ctx.createImageData(2 * radius, 2 * radius);
  data = image.data;

  // Device-pixels-per-CSS-pixel, using the buffer size actually in effect
  // (canvas.width / size) rather than raw `dpi`. Since radius is rounded,
  // canvas.width can be off from size*dpi by a fraction of a pixel; using
  // the real ratio keeps picker positions exactly aligned with the wheel.
  const scale = canvas.width / size;

  for (let x = -radius; x < radius; x++) {
    for (let y = -radius; y < radius; y++) {

      let [r, phi] = xy2polar(x, y);

      if (r > radius) {
        // skip all (x,y) coordinates that are outside of the circle
        continue;
      }

      let deg = rad2deg(phi);

      let rowLength = 2 * radius;
      let adjustedX = x + radius;
      let adjustedY = y + radius;
      let pixelWidth = 4;
      let index = (adjustedX + (adjustedY * rowLength)) * pixelWidth;

      let hue = deg;
      let saturation = r / radius;
      let value = 1;

      let [red, green, blue] = hsv2rgb(hue, saturation, value);
      let alpha = 255;

      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = alpha;

      // BUG FIX: this used to be `(adjustedX / 4) % radius * 2`, an odd
      // formula left over from an earlier canvas size that no longer
      // matched. What we actually want is: convert the device-pixel
      // coordinate back to CSS pixels so it can be used directly with
      // `translate()` in CSS, which operates in CSS pixels.
      let xpos = adjustedX / scale;
      let ypos = adjustedY / scale;

      pixels.push({ x: xpos, y: ypos, red: Math.round(red), green: Math.round(green), blue: Math.round(blue) })
    }
  }
  ctx.putImageData(image, 0, 0);
}

function imgData(x, y) {
  // x, y arrive in CSS pixels; the backing buffer is device pixels.
  // Use canvas.width/size (the ratio actually in effect after radius
  // rounding) rather than raw dpi, so sampling lines up exactly with
  // where drawCircle() placed each color.
  const scale = canvas.width / size;
  const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x * scale)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y * scale)));
  const imgData = ctx.getImageData(px, py, 1, 1);
  return imgData.data;
}

// --- Pointer handling (covers mouse, touch, and pen in one place) ---
// The original only listened for touchstart/touchmove, so the picker
// couldn't be dragged at all with a mouse on desktop. Pointer Events
// replace that with a single code path for every input type.
let dragging = false;

_canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  _canvas.setPointerCapture(e.pointerId);
  updatePicker(e);
});
_canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updatePicker(e);
});
_canvas.addEventListener('pointerup', () => { dragging = false; });
_canvas.addEventListener('pointercancel', () => { dragging = false; });

// BUG FIX: the dialog's own click listener used to toggle open/closed on
// every click inside it -- but list items live inside the dialog, so
// selecting one bubbled the click up to this same listener, which
// immediately re-toggled things back open right after changeMode() had
// just closed it. Checking that the click target IS the backdrop (not a
// bubbled child) fixes that, and using explicit open/close functions
// instead of toggling avoids this class of state-desync bug entirely.
function openDialog() {
  dialog.classList.remove('hide');
  const sheet = dialog.firstElementChild;
  // Double rAF forces a reflow after removing `hide` so the transform
  // transition actually animates in, instead of snapping straight to
  // the open position.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.classList.add('slide-in');
    dialog.style.background = 'var(--overlay)';
  }));
}

function closeDialog() {
  dialog.style.background = 'transparent';
  const sheet = dialog.firstElementChild;
  sheet.classList.remove('slide-in');
  setTimeout(() => dialog.classList.add('hide'), 200);
}

dialog.addEventListener('click', function(event) {
  if (event.target !== dialog) return;
  closeDialog();
})
type.addEventListener('click', openDialog);
type.addEventListener('keydown', function(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openDialog();
  }
});

for (let item of items) {
  item.addEventListener('click', changeMode, false)
}

function changeMode() {
  pickers = [];
  mainPicker.hex = '#fff'
  mainPicker.ref = '#fff'
  mainPicker.x = mainPicker.y = size / 2
  pickers.push(mainPicker);
  let name = this.getAttribute('data-name')
  let _mode = modes.find(md => md.name == name);

  if (_mode && mode.name !== _mode?.name) {
    mode = _mode;
    plates.innerHTML = ''
    _canvas.innerHTML = ''
    setMode()
    draw();
    lightness(0)
    hexChange();
  }
  closeDialog();
}

function updatePicker(event) {
  let rect = _canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  if (isInside(x, y)) {
    const data = imgData(x, y);
    if (data) {
      mainPicker.hex = rgb2hex(data[0], data[1], data[2]).toUpperCase();
      mainPicker.setPosition(x, y);
      code.value = mainPicker.hex
      let [h, s, l] = hex2hsl(mainPicker.hex)
      depth.value = 100 - l;
      mainPicker.ref = mainPicker.hex;
      hexChange();
      generatePickers(mode?.name, true);

      draw();
    }
  }
}

function draw() {
  _r.style.setProperty('--m_color', mainPicker.hex);

  for (let _picker of pickers) {
    // translate() places the dot's top-left corner at (x,y) by default;
    // the extra translate(-50%,-50%) centers the dot on the sampled point.
    _picker.picker.style.transform = `translate(${_picker.x}px,${_picker.y}px) translate(-50%,-50%)`;
    _picker.palette.plate.style.background = _picker.hex
    _picker.palette.hexCode.innerHTML = _picker.hex;
  }
}

function hexChange() {
  let _g = 'linear-gradient(270deg,'
  let i = 0;

  while (i < 100) {
    let [h, s, l] = hex2hsl(mainPicker.ref);
    let hsl = ` hsl(${h},${s}%,${i}%)`;
    if (i !== 99) hsl += ',';
    _g += hsl;
    i++;
  }
  return _r.style.setProperty('--rangebg', `${_g})`);
}

function setMode() {
  const colors = mode?.colors - 1 || 0;
  const name = mode?.name || 'alpha';

  for (let i = 0; i < colors; i++) {
    let picker = new Picker({ picker: document.createElement('div'), palette: { plate: document.createElement('div'), hexCode: document.createElement('div') } });
    pickers.push(picker)
  }

  generatePickers(name, true)

  for (let picker of pickers) {
    picker.picker.setAttribute('class', `pickers ${picker.name || ''}`);
    picker.picker.style.position = 'absolute'

    _canvas.append(picker.picker)
    let plate = document.createElement('div');

    let palette = picker.palette;

    palette.plate.classList.add('palette');
    palette.hexCode.classList.add('code');
    palette.plate.style.background = picker.hex;
    palette.hexCode.innerHTML = picker.hex;
    plate.append(palette.plate, palette.hexCode)
    plate.setAttribute('class', 'plate');

    plates.append(plate)
  }
  type.innerHTML = mode.name.toLowerCase();
}

function generatePickers(name, setPickers, useHex) {
  if (name === 'complimentary') {
    complimentary(setPickers)
  } else if (name === 'monochromic') {
    monochromic(setPickers, useHex)
  } else if (name == 'analogous') {
    analogous(setPickers, useHex)
  } else if (name == 'triadic') {
    triadic(setPickers, useHex)
  } else if (name == 'tedradic') {
    tedradic(setPickers, useHex)
  }
}

function complimentary() {
  let picker = pickers[1]
  picker.x = size - mainPicker.x;
  picker.y = size - mainPicker.y;
  picker.name = 'cpicker'
  let [h, s, l] = hex2hsl(mainPicker.hex)
  h += 180;
  if (h > 360) { h -= 360; }
  let color = hsl2hex(h, s, l)

  return picker.hex = color;
}

function monochromic() {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let _pickers = [picker1, picker2]
  let [h, s, l] = hex2hsl(mainPicker.hex);

  for (let picker of _pickers) {
    l += 10;
    if (l > 100) l = 100;
    picker.x = mainPicker.x
    picker.y = mainPicker.y
    picker.hex = hsl2hex(h, s, l);
  }
  return '';
}

function analogous(setPickers) {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let _pickers = [picker1, picker2]
  let [h, s, l] = hex2hsl(mainPicker.hex);
  let [_h, _s, _l] = hex2hsl(mainPicker.ref)
  for (let picker of _pickers) {
    _h -= 30;
    if (_h < 0) _h += 360;
    if (_h > 360) _h -= 360;

    if (setPickers) {
      let _hex = hsl2hex(_h, 100, _l);
      let [r, g, b] = hex2rgb(_hex);
      let pos = pixels.find((pixel) => pixel.red == r && pixel.green == g && pixel.blue == b);
      if (pos) { picker.x = pos.x; picker.y = pos.y; }
    }

    picker.hex = hsl2hex(_h, _s, l);
  }
  return '';
}

function triadic(setPickers) {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let _pickers = [picker1, picker2]
  let [h, s, l] = hex2hsl(mainPicker.hex);
  let [_h, _s, _l] = hex2hsl(mainPicker.ref)
  for (let picker of _pickers) {
    _h += 120;
    if (_h > 360) _h -= 360;

    if (setPickers) {
      let _hex = hsl2hex(_h, _s, _l);
      let [r, g, b] = hex2rgb(_hex);
      let pos = pixels.find((pixel) => pixel.red == r && pixel.green == g && pixel.blue == b);
      if (pos) { picker.x = pos.x; picker.y = pos.y; }
    }

    picker.hex = hsl2hex(_h, _s, l);
  }
  return ''
}

function tedradic(setPickers) {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let picker3 = pickers[3]
  let _pickers = [picker1, picker2, picker3]
  let [h, s, l] = hex2hsl(mainPicker.hex);
  let [_h, _s, _l] = hex2hsl(mainPicker.ref)
  for (let picker of _pickers) {
    _h += 90;
    if (_h > 360) _h -= 360;

    if (setPickers) {
      let _hex = hsl2hex(_h, _s, _l);
      let [r, g, b] = hex2rgb(_hex);
      let pos = pixels.find((pixel) => pixel.red == r && pixel.green == g && pixel.blue == b);
      if (pos) { picker.x = pos.x; picker.y = pos.y; }
    }

    picker.hex = hsl2hex(_h, _s, l);
  }
  return ''
}

code.addEventListener('keyup', (e) => {
  let val = e.target.value.trim().toUpperCase();
  code.value = val;

  let chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', '#']

  if (val.length == 0) return code.value = '#'

  if (!chars.includes(val[val.length - 1]) || val.length > 7) {
    return val = code.value = val.slice(0, val.length - 1)
  }

  if (val.length == 7 && val[0] == '#') {
    let [h, s, l] = hex2hsl(val);
    let hex = hsl2hex(h, s, 50);
    let [r, g, b] = hex2rgb(hex);

    depth.value = 100 - l;

    let pos = pixels.find((pixel) => pixel.red == r && pixel.green == g && pixel.blue == b);

    if (pos) mainPicker.setPosition(pos.x, pos.y);

    mainPicker.ref = hex;
    mainPicker.hex = val;

    hexChange()
    generatePickers(mode.name, true, false);

    draw();
  }
})

depth.addEventListener('input', (e) => {
  lightness(e.target.value, e)
})

function lightness(value, e) {
  const _v = Math.round(100 - value);

  let [h, s, l] = hex2hsl(mainPicker.ref);

  mainPicker.hex = hsl2hex(h, s, _v);

  code.value = mainPicker.hex.toUpperCase();

  generatePickers(mode?.name, false)

  draw();

  // BUG FIX: this used to set `depth.value = _v - 100`, which is
  // `-value` rather than `value` — it only ever looked right for the
  // single case of value === 0, and would silently desync the slider
  // from the actual lightness for every other starting value.
  if (!e) depth.value = 100 - _v
}

function isInside(x, y) {
  const c = size / 2;
  return (x - c) * (x - c) + (y - c) * (y - c) <= c * c;
}

// --- Dark mode ---
// Respects the OS preference by default, and lets the user override it
// with a manual toggle; the choice is remembered for next visit.
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeToggle) themeToggle.setAttribute('aria-pressed', theme === 'dark');
  try { localStorage.setItem('theme', theme); } catch (err) { /* ignore */ }
}

function initTheme() {
  let saved;
  try { saved = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

initTheme();

const mainPicker = new Picker({
  picker: document.createElement('div'),
  palette: { plate: document.createElement('div'), hexCode: document.createElement('div') },
  name: 'mpicker',
  ref: '#ffffff',
  hex: '#ffffff'
});

layoutCanvas();
mainPicker.x = mainPicker.y = size / 2;
pickers.push(mainPicker);

setMode();
draw();
lightness(0);
hexChange();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    layoutCanvas();
    mainPicker.x = mainPicker.y = size / 2;
    generatePickers(mode?.name, true);
    draw();
  }, 150);
});