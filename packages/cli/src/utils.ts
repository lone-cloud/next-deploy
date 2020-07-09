import { Color } from 'ora';

export const getColor = function (currentColor?: Color): Color {
  const colors: Color[] = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  if (randomColor === currentColor) {
    return getColor(currentColor);
  }

  return randomColor;
};
