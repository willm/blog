---
layout: post
title:  "Mario generator"
date:   2023-08-20
categories: javascript canvas front-end fun
custom-javascript:
  - /assets/scripts/mario-generator.js
---
# Mario generator

I bought a second hand SNES mini recently and have been rediscovering the
fun of super mario world. I got inspired to make a bit of pixel art using the
[canvas api](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API). I wanted to generate different marios.

I started out with this image I found online.

![mario](https://vignette.wikia.nocookie.net/fantendo/images/d/df/Super_mario_world_mario_sprite_by_sy24-d9ue2li.png/revision/latest?cb=20170106220014){: width="100"}

The image contains 13 colors. I carefully translated the image to a 2D array of
characters, with each character mapping to a color. Don't pay too much attention
to the actual characters, they're pretty much random.

```javascript
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
```

To make each mario different I needed to generate 3 different shades of a random
color to use for his shirt. I used `rgb` notation for this and added a helper
function to generate 3 versions (light, medium and dark) of a color.

```javascript
const rgb = (r, g, b) => `rgb(${r},${g},${b})`;
const getShades = (r, g, b) => {
  return {
    light: rgb(r, g, b),
    medium: rgb(r * 0.8, g * 0.8, b * 0.8),
    dark: rgb(r * 0.5, g * 0.5, b * 0.5),
  };
};
```
I then mapped these to the corresponding letters in the template (`p`, `P` and `r`)
to give each mario some unique clothing.

You can see 10 generated marios below. If you refresh the page they will be different
every time. This was quite a fun simple way to play with the canvas api and I may revisit it in the future.
