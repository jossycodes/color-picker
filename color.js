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


const pixels = []
let pickers = [];

const modes = [
  {
    name: 'single',
    colors: 1
  },
  {
    name: 'complimentary',
    colors: 2
  },
  {
    name: 'monochromic',
    colors: 3,
  },
  {
    name: 'analogous',
    colors: 3,
  },
  {
    name: 'triadic',
    colors: 3
  },
  {
    name: 'tedradic',
    colors: 4
  }
  ]
let mode = modes[0]

let height = window.innerHeight
let width = window.innerWidth;
let size;

(height >= width) ? width = height = height / 2: height = width = width / 2;

//canvas size
size = height - 50;

canvas.style.height = _canvas.style.height = size + 'px';
canvas.style.width = _canvas.style.width = size + 'px';


const ctx = canvas.getContext('2d', {willReadFrequently: true});

const dpi = window.devicePixelRatio;
canvas.width = size * dpi;
canvas.height = size * dpi;

_canvas.width = size * dpi;
_canvas.height = size * dpi;


ctx.scale(dpi, dpi);

let radius = size;

let image = ctx.createImageData(2 * radius, 2 * radius);

let data = image.data;


function drawCircle() {
  for (let x = -radius; x < radius; x++) {
    for (let y = -radius; y < radius; y++) {

      let [r, phi] = xy2polar(x, y);

      if (r > radius) {
        // skip all (x,y) coordinates that are outside of the circle
        continue;
      }

      let deg = rad2deg(phi);

      // Figure out the starting index of this pixel in the image data array.
      let rowLength = 2 * radius;
      let adjustedX = x + radius; // convert x from [-50, 50] to [0, 100] (the coordinates of the image data array)
      let adjustedY = y + radius; // convert y from [-50, 50] to [0, 100] (the coordinates of the image data array)
      let pixelWidth = 4; // each pixel requires 4 slots in the data array
      let index = (adjustedX + (adjustedY * rowLength)) * pixelWidth;

      let hue = deg;
      let saturation = r / (radius);
      let value = 1 //r / 1500;

      let [red, green, blue] = hsv2rgb(hue, saturation, value);
      let alpha = 225;

      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = alpha;

      let xpos = (adjustedX / 4) % radius * 2;
      let ypos = (adjustedY / 4) / (radius / radius) * 2;

      pixels.push({ x: xpos, y: ypos, red: Math.round(red), green: Math.round(green), blue: Math.round(blue) })
    }
  }
 // console.log(pixels[Math.round(pixels.length/2) + 100], width)
  ctx.putImageData(image, 0, 0);

}

drawCircle();


function imgData(x, y) {
  let imgData = ctx.getImageData(x * 2, y * 2, 1, 1);
  

  let data = imgData.data;
  return data
}


_canvas.addEventListener('touchmove', updatePicker);
_canvas.addEventListener('touchstart', updatePicker);

dialog.addEventListener('click', function() {

  dialog.style.background = 'transparent';
  const list = dialog.firstElementChild;
  list.classList.toggle('slide-in');
  setTimeout(() => dialog.classList.toggle('hide'), 200)
})
type.addEventListener('click', function() {
  dialog.classList.toggle('hide');
  const list = dialog.firstElementChild;
  setTimeout(() => {
    list.classList.toggle('slide-in')
    dialog.style.background = 'rgba(0,0,0,.3)'
  }, 100)
})


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
  let _mode = modes.find(md => { return md.name == name });
 
  if (_mode && mode.name !== _mode?.name) {
    mode = _mode;
    plates.innerHTML = ''
    _canvas.innerHTML = ''
    setMode()
    draw();
    lightness(0)
    hexChange();
  }
}

//_canvas.addEventListener('touchend', draw);

function updatePicker(event) {
  let rect = _canvas.getBoundingClientRect();
  let x = event.touches[0].clientX - rect.left;
  let y = event.touches[0].clientY - rect.top;


  if (isInside(x, y)) {
    const data = imgData(x, y);
    if (data) {
      mainPicker.hex = rgb2hex(data[0], data[1], data[2]).toUpperCase();
      mainPicker.position(x, y);
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

function fetchPixel() {
  const data = imgData(x, y);

  if (!data) return ''
  let hex = rgb2hex(data[0], data[1], data[2]).toUpperCase();
  return hex
}

function draw() {


  //generatePickers(mode?.name || 'alpha');

  _r.style.setProperty('--m_color', mainPicker.hex);


  for (let _picker of pickers) {
    _picker.picker.style.transform = `translate(${_picker.x}px,${_picker.y}px)`;
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
    (i !== 99) ? hsl += ',': ''
    _g += hsl;
    i++;
  }
  return _r.style.setProperty('--rangebg', `${_g})`);
}


function setMode() {
  const colors = mode?.colors - 1 || 0;
  const name = mode?.name || 'alpha';
  let _pickers = [];
  for (let i = 0; i < colors; i++) {
    let picker = new Picker({ picker: document.createElement('div'), palette: { plate: document.createElement('div'), hexCode: document.createElement('div') } });
    pickers.push(picker)
  }



  generatePickers(name, true)

  for (let picker of pickers) {

    picker.picker.setAttribute('class', `pickers ${picker.name}`);
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
    complimentary(setPickers = true)
  } else if(name === 'monochromic') {
    monochromic(setPickers, useHex)
  } else if (name == 'analogous') {
    analogous(setPickers, useHex)
  } else if (name == 'triadic') {
    triadic(setPickers, useHex)
  } else if (name == 'tedradic') {
    tedradic(setPickers, useHex)
  }
}

function complimentary(setPickers) {
  //complementary color is obtained by subtracting main picker x,y values from size
  let picker = pickers[1]
  picker.x = size - mainPicker.x;
  picker.y = size - mainPicker.y;
  picker.name = 'cpicker'
  let [h, s, l] = hex2hsl(mainPicker.hex)
  h += 180;
  if (h > 360) { h -= 360; }
  let color = hsl2hex(h, s, l)

  //console.log(color);
  return picker.hex = color;
  //pickers.push(picker)
}

function monochromic(setPickers) {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let _pickers = [picker1, picker2]
  let [h, s, l] = hex2hsl(mainPicker.hex);

  for (let picker of _pickers) {
    l += 10;
    if (l > 100) l = 100;
    let _hex = hsl2hex(h, s, l);
    let [r, g, b] = hex2rgb(_hex);

    picker.x = mainPicker.x
    picker.y = mainPicker.y
    picker.hex = hsl2hex(h, s, l);
  }
  return '';
}

function analogous(setPickers, useHex = true) {
  let picker1 = pickers[1];
  let picker2 = pickers[2];
  let _pickers = [picker1, picker2]
  let [h, s, l] = hex2hsl(mainPicker.hex);
  let [_h, _s, _l] = hex2hsl(mainPicker.ref)
  for (let picker of _pickers) {
    _h -= 30;
    if (_h > 360) _h -= 360;
    let _hex = hsl2hex(_h, _s, _l);
    let [r, g, b] = hex2rgb(_hex);

    if (setPickers) {
      let _hex = hsl2hex(_h, 100, _l);
      let [r, g, b] = hex2rgb(_hex);
      let pos = pixels.find((pixel) => {
        return pixel.red == r && pixel.green == g && pixel.blue == b
      });
      picker.x = pos?.x, picker.y = pos?.y;
      console.log(_hex)
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
    let _hex = hsl2hex(_h, _s, _l);
    let [r, g, b] = hex2rgb(_hex);

    if (setPickers) {
      let pos = pixels.find((pixel) => {
        return pixel.red == r && pixel.green == g && pixel.blue == b
      });
      picker.x = pos?.x, picker.y = pos?.y;
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
    let _hex = hsl2hex(_h, _s, _l);
    let [r, g, b] = hex2rgb(_hex);

    if (setPickers) {
      let pos = pixels.find((pixel) => {
        return pixel.red == r && pixel.green == g && pixel.blue == b
      });
      picker.x = pos?.x, picker.y = pos?.y;
    }

    picker.hex = hsl2hex(_h, _s, l);
  }
  return ''
}


code.addEventListener('keyup', (e) => {
  let val = e.target.value.trim().toUpperCase();
  code.value = val;

  let chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', '#']
  
  if (val.length == 0) return code.value = '#'
  
  if (!chars.find(char => char.toUpperCase() == val[val.length - 1]) || val.length > 7) {
    
    return val = code.value = val.slice(0, val.length - 1)
  }




  if (val.length == 7 && val[0] == '#') {
    let [h, s, l] = hex2hsl(val);
    let hex = hsl2hex(h, s, 50);
    let [r, g, b] = hex2rgb(hex);


    console.log(h, s, l);

    depth.value = 100 - l;


    let pos = pixels.find((pixel) => {
      return pixel.red == r && pixel.green == g && pixel.blue == b
    });

    mainPicker.position(pos?.x, pos?.y);

    mainPicker.ref = hex;
    mainPicker.hex = val;

    hexChange()
    //
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
  let hex = hsl2hex(h, s, _v);
  let [r, g, b] = hex2rgb(hex);



  code.value = mainPicker.hex.toUpperCase();

  generatePickers(mode?.name, false)


  draw();

  if (!e) depth.value = _v - 100

}





function isInside(x, y)
{

  if ((x - (size / 2)) * (x - (size / 2)) +

    (y - (size / 2)) * (y - (size / 2)) <= size / 2 * size / 2)

    return true;

  else

    return false;
}


const mainPicker = new Picker({ picker: document.createElement('div'), palette: { plate: document.createElement('div'), hexCode: document.createElement('div') }, name: 'mpicker', x: size / 2, y: size / 2, size: size / 60, ref: '#ffffff', hex: '#ffffff' })
pickers.push(mainPicker);

setMode()
draw();
lightness(0)
hexChange();
