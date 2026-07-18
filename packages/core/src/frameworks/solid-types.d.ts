declare module "solid-js/dist/solid.cjs" {
  export * from "solid-js";
}

// The solid2 adapter imports the browser build by relative path (the
// package's `node` export condition resolves to an inert server build), so
// the path-based specifier needs its own declaration. solid-js-2 is an npm
// alias for solid-js@2.x, whose own types describe this build.
declare module "*/solid-js-2/dist/solid.js" {
  export * from "solid-js-2";
}
