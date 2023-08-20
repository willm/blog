const main = document.getElementsByTagName("article")[0];
const template = [
  ["w", "w", "w", "w", "w", "w", "w", "r", "r", "r", "r", "r", "w", "w", "w"],
  ["w", "w", "w", "w", "w", "r", "r", "p", "p", "y", "p", "p", "r", "w", "w"],
  ["w", "w", "w", "w", "r", "p", "p", "P", "g", "y", "w", "P", "r", "w", "w"],
  ["w", "w", "w", "r", "p", "P", "P", "b", "b", "b", "b", "b", "b", "w", "w"],
  ["w", "w", "r", "p", "P", "b", "b", "b", "b", "b", "b", "b", "b", "b", "w"],
  ["w", "r", "P", "P", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "w"],
  ["w", "r", "P", "P", "b", "b", "c", "w", "w", "c", "w", "w", "b", "b", "w"],
  ["w", "c", "s", "b", "b", "c", "c", "w", "b", "s", "b", "w", "b", "b", "w"],
  ["w", "m", "s", "b", "b", "c", "s", "w", "b", "s", "b", "w", "s", "m", "w"],
  ["w", "m", "c", "b", "b", "b", "s", "s", "c", "c", "s", "s", "s", "m", "w"],
  ["w", "c", "c", "c", "b", "s", "s", "b", "m", "c", "c", "c", "c", "m", "w"],
  ["w", "w", "w", "c", "c", "c", "b", "b", "b", "b", "b", "b", "b", "b", "w"],
  ["w", "w", "w", "w", "c", "c", "s", "s", "b", "b", "b", "b", "b", "w", "w"],
  ["w", "w", "w", "w", "c", "c", "c", "c", "c", "c", "c", "c", "m", "w", "w"],
  ["w", "w", "w", "w", "w", "P", "P", "r", "r", "m", "m", "m", "w", "w", "w"],
  ["w", "w", "w", "r", "p", "p", "r", "P", "m", "w", "w", "w", "m", "w", "w"],
  ["w", "w", "r", "P", "p", "p", "p", "m", "w", "w", "w", "w", "w", "m", "w"],
  ["w", "w", "r", "P", "P", "p", "p", "m", "w", "w", "w", "w", "w", "m", "w"],
  ["w", "w", "n", "r", "P", "P", "p", "p", "m", "w", "w", "w", "m", "b", "w"],
  ["w", "w", "n", "n", "r", "P", "P", "r", "r", "m", "m", "m", "b", "b", "w"],
  ["w", "w", "n", "t", "n", "r", "r", "r", "a", "a", "a", "t", "n", "w", "w"],
  ["w", "w", "n", "t", "t", "t", "a", "a", "a", "a", "a", "t", "n", "w", "w"],
  ["w", "w", "w", "n", "t", "t", "t", "a", "a", "n", "t", "n", "w", "w", "w"],
  ["w", "w", "w", "n", "t", "t", "t", "t", "t", "n", "t", "n", "w", "w", "w"],
  ["w", "w", "w", "w", "n", "n", "n", "n", "n", "n", "n", "w", "w", "w", "w"],
  ["w", "w", "w", "w", "m", "m", "m", "m", "m", "b", "m", "w", "w", "w", "w"],
  ["w", "w", "w", "w", "w", "m", "m", "m", "m", "y", "b", "y", "w", "w", "w"],
];

class Context {
  ctx;
  diameter;
  constructor(canvas, templateLength, templateHeight) {
    this.diameter = Math.min(
      canvas.width / templateLength,
      canvas.height / templateHeight
    );
    this.ctx = canvas.getContext("2d");
  }
  drawPixel(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      x * this.diameter,
      y * this.diameter,
      this.diameter,
      this.diameter
    );
  }
}

const drawMario = () => {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", 100);
  canvas.setAttribute("height", 200);
  main.appendChild(canvas);
  const ctx = new Context(canvas, template[0].length, template.length);
  const colors = {
    b: "#000000",
    w: "#FFFFFF",
    y: "#F9D772",
    g: "#D9A02C",
    c: "#FD6F66",
    s: "#F8D0BD",
    m: "#865716",
    n: "#233081",
    t: "#3F8098",
    a: "#81D8C7",
    ...getShades(
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255)
    ),
  };

  for (let row = 0; row < template.length; row++) {
    for (let pixel = 0; pixel < template[row].length; pixel++) {
      const color = colors[template[row][pixel]];
      if (color === undefined) {
        throw new Error(`Color ${color} not found`);
      }
      ctx.drawPixel(pixel, row, color);
    }
  }
};

const rgb = (r, g, b) => `rgb(${r},${g},${b})`;
const getShades = (r, g, b) => {
  return {
    p: rgb(r, g, b),
    P: rgb(r * 0.8, g * 0.8, b * 0.8),
    r: rgb(r * 0.5, g * 0.5, b * 0.5),
  };
};

for (let i = 0; i < 10; i++) {
  drawMario(["red", "green", "blue"][Math.floor(Math.random() * 3)]);
}
