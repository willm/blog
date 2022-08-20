---
layout: post
title:  "React tutorial in vanilla js 🍦"
date:   2022-08-15 15:07:00 +0000
categories: javascript react front-end
---
# React tutorial in vanilla js 🍦

The official react website has [a tutorial to teach people how to use react](https://reactjs.org/tutorial/tutorial.html). The idea is to build a tic tac toe (or naughts
and crosses) game. This game also recalls every move that was made and allows
you to return to any previous state.

I wanted to show not only that this exercise can be implemented relatively
easily in in vanilla js, but also that we can learn from the way react encourages
us to write code to write plain js in a nice way.

A word of warning, this code is not optimized for performance, I'm certainly not advocating that this quick and dirty solution can replace react in a large production based application with a lot of components. Hopefully it does make the reader think about whether they can justify the **801** npm dependencies that come bundled into create-react-app (the starting point for the react tutorial).

## Setting up the project

1. In a new directory create an `index.html` with the following contents. Note
the `defer` attribute on the `script` tag. This will defer the execution of
your script until the content has loaded. It's a neat way out of having to do
something like `document.on('DOMContentLoaded', () => {/*your code*/}`.

```html
<!DOCTYPE HTML>
<html>
    <head>
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />

        <title>Tic Tac Toe</title>
        <link rel="stylesheet" href="./style.css" title="" type="" />
    </head>
    <body>
        <div id="container"></div>
        <script defer src="./script.js"></script>
    </body>
</html>
```

2. Add a file called `style.css` with [the same content that react give you](https://codepen.io/gaearon/pen/oWWQNa?editors=0100).

3. Add a file called `script.js` with `console.log('tic tac toe')`

4. Most systems should come with python installed, run `python -m http.server` to serve the current directory over http and visit http://localhost:8000 in your browser. Inspect the javascript console and make sure you see `tic tac toe` being logged to make sure your script is wired up correctly.

## Making the grid

When creating elements using vanilla javascript I like to make a small wrapper function to help to define my markup in a declarative way. This function does the job for this task.

```javascript
const element = (tag, options) => {
  const el = document.createElement(tag);
  options.class && el.classList.add(options.class);
  el.innerText = options.innerText || '';
  (options.children || []).forEach(child => {
    el.appendChild(child);
  });
  Object.entries(options.listeners || {}).forEach(([event, listener]) => {
    el.addEventListener(event, listener);
  });
  return el;
};
```
You can then use this to build your UI in a similar way with functions to define components as you might with [jsx](). This creates a status line and a 3 by 3 grid. Clicking on a square will fill it with an `X`.

![grid with x](/assets/images/tic-tac-toe/tic-tac-toe-step-1.png)

```javascript
const Status = () => element('div', {
  innerText: 'Next player: X',
  class: 'status'
});

const Square = () => element('div', {
  class: 'square',
  listeners: {
    click: (evt) => {
      evt.target.innerText = 'X';
    }
  }
});

const Row = () => element('div', {
  class: 'board-row',
  children: Array.from(new Array(3), Square)
});

const render = () => {
  const game = document.getElementById('container');
  game.appendChild(Status());
  for (let i = 0; i < 3; i++) {
    game.appendChild(Row(i));
  }
}
```

## Reacting to state changes

Something that react encourages us to do is to pull the state up as close to
the top of the application as possible. Let's create a state object to hold
the current state of the grid and the status.
This is where the [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
 class comes in handy. Proxy allows us to react to changes (or attempts to
 access) our state object. The second argument to the `Proxy` constructor
 specifies an event handler for whenever a property is set on our state object.
In this case, we set the property, then re-render the entire UI with the new state.

```javascript
const stateHandler = {
  set(obj, prop, value) {
    obj[prop] = value;
    render();
  }
};

const state = new Proxy(
  {
    status: 'Next player: X',
    grid: [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]
  },
  stateHandler
);
```
Now of course this is not very efficient as we may be rendering everything just
to change a single square. However for such a small tree, this isn't really
noticeable to the user.

Here's what our `Square` component and our render method look like at this point.

```javascript
const Square = (rowIndex, squareIndex) => element('div', {
  class: 'square',
  innerText: state.grid[rowIndex][squareIndex],
  listeners: {
    click: () => {
      const newGrid = state.grid;
      newGrid[rowIndex][squareIndex] = 'X';
      // re-set the grid property on the state proxy
      state.grid = newGrid;
    }
  }
});

const render = () => {
  const game = document.getElementById('container');
  game.innerHTML = '';
  game.appendChild(Status());
  state.grid.forEach((_, rowIndex) => {
    game.appendChild(Row(rowIndex));
  });
}

render();
```

Notice how in the `click` handler we are re-assigning `state.grid`. This will
cause our `set` handler to be called and thus re-render the entire grid with the updated
value.

## Finding a winner

This calculateWinner function goes over the grid and checks if any of the players have a complete row or column. It's not really the point of this post but it's included for completeness.

```javascript
const players = ['X', '0'];
const rowWins = (player, rowIndex) => {
  return state.grid[rowIndex].every(square  => square === player);
}

const colWins = (player, colIndex) => {
  return state.grid.every(row => row[colIndex] === player)
}

const diagonalWin = (player) => {
  return state.grid.every((_, index) => {
    console.log(state.grid[index][state.grid.length - 1 - index]);
    return state.grid[index][state.grid.length - 1 - index] === player
  }) || state.grid.every((_, index) => {
    return state.grid[index][index] === player
  });
}

const isWinner = (rowIndex, colIndex, player) => {
  return rowWins(player, rowIndex) || colWins(player, colIndex);
}

const calculateWinner = () => {
  for(let rowIndex = 0; rowIndex < state.grid.length; rowIndex++) {
    for (let colIndex = 0; colIndex < state.grid[rowIndex].length; colIndex++) {
      const winner = players.find(player => isWinner(rowIndex, colIndex, player));
      if (winner) {
        return winner;
      }
    }
  }
  const diagonalWinner = players.find(diagonalWin);
  if (diagonalWinner) {
    return diagonalWinner;
  }
  return null;
}
```

This means that by changing our `status` property on the `state` to keep track of the currentPlayer instead, we can now change the status line to indicate the current player and alternate turns between `0` and `X`. We now have a working, playable tic tac toe implementation.

![grid with x and 0](/assets/images/tic-tac-toe/tic-tac-toe-step-2.png)

```javascript
const state = new Proxy(
  {
    currentPlayer: 0,
    grid: [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ],
    history: []
  },
  stateHandler
);

const Status = () => element('div', {
  innerText: calculateWinner() === null ?
    `Next player: ${players[state.currentPlayer % 2]}` :
    `Winner: ${winner}`,
  class: 'status'
});

const Square = (rowIndex, squareIndex) => element('div', {
  class: 'square',
  innerText: state.grid[rowIndex][squareIndex],
  listeners: {
    click: () => {
      const newGrid = state.grid;
      // switch who's go it is based on the current player
      newGrid[rowIndex][squareIndex] = players[state.currentPlayer % 2];
      state.grid = newGrid;
      // increment the current player
      state.currentPlayer += 1;
    }
  }
});
```

## Implementing the history

The history can be implemented using the same idea. We'll add a `history` property to our `state` object and assign it to an empty array. Every time a move is made, in the `Square` click handler, we will add the previous state of the grid to the `history` array. One thing we need to be mindful of here is to take a deep copy of the grid rather than adding a reference to the grid array in the history.

```javascript
const gridCopy = state.grid.map(x => x.map(y => y));
state.history = [...state.history, gridCopy];
```

We can then implement some new components to render the history and allow users to go back in time to any previous move in the game.

![grid with history](/assets/images/tic-tac-toe/tic-tac-toe-step-3.png)

```javascript
const Move = (move) => element('li', {
  children: [
    element('button', {
      innerText: move === 0 ? 'Go to game start' : `Go to move #${move}`,
      listeners: {
        click: () => {
          state.grid = state.history[move];
          state.history = state.history.slice(0, move);
        }
      }
    })
  ]
});

const History = () => element('ol', {
  children: state.history.map((_, i) => Move(i))
});
```