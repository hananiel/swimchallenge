# Swim Progress GIF Generator

A web application that generates an animated GIF showing a swimmer's progress around a medal based on the distance they've swum.

## Features

- Input total yards to swim
- Visual progress animation
- Generated GIF shows swimmer moving around the medal
- Download the final GIF

## Setup

1. Clone this repository
2. Replace `assets/medal.png` with your medal image
3. Open `index.html` in a modern web browser

## How to Use

1. Enter the total yards you plan to swim
2. Click "Generate Progress GIF"
3. Wait for the GIF to generate (this may take a moment)
4. Download the generated GIF using the download button

## Requirements

- Modern web browser with JavaScript enabled
- Internet connection (for loading external libraries)

## Customization

To use your own medal image:
1. Place your image in the `assets` folder
2. Name it `medal.png` or update the reference in `index.html`

## Technologies Used

- HTML5, CSS3, JavaScript
- [gif.js](https://github.com/jnordberg/gif.js/) - For GIF generation
- [html2canvas](https://html2canvas.hertzen.com/) - For capturing the animation frames

## License

MIT
