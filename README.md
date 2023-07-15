# WASM Game of Life

![game-of-life](etc/game-of-life-recording.gif)

## Intro

This repo contains an implementation of the `Game of Life` using `WASM` with `Rust`. Also, as this implementation focuses on performance, `WebGL` is also used to render the game.

## Contents

You can find the Rust library crate implementation in [src](src) and an example website using the package in [www](www).

## How to Run

### Build the WASM package from source

First you will need to have [Rust](https://www.rust-lang.org/tools/install) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) to compile the rust library and build the WASM package.

To build the package run:

```bash
wasm-pack build
```

### Run the example web page

Once you built the WASM package from source you can go into the [www](www) directory and run the web server.

First make sure you have [npm](https://docs.npmjs.com/getting-started) installed. Then run:

```bash
# Enter the web page directory
cd www
# Install the dependencies
npm install
# Run the web server
npm run start
```

## `npm` package

If you want to add the package to your project you can use the [published npm package](https://www.npmjs.com/package/wasm-game-of-life-webgl-rendering).

It can be installed with:

```bash
npm i wasm-game-of-life-webgl-rendering
```
