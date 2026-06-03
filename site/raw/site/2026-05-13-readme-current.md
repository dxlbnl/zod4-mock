# README (current state, placeholder)

> Source: gen-bench/README.md (in-repo)
> Collected: 2026-05-13
> Published: 2026-05-13

This is the project README as of 2026-05-13. It is still the `sv create` scaffolder boilerplate — captured here as evidence of the documentation gap noted in the 2026-05-13 review. The site has substantial functionality but the front-door file does not introduce the project to a visitor.

---

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.3 create --template minimal --types ts --no-install .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
