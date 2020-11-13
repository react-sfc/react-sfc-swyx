# Experimental React Single File Components

Swyx's Experimental Proposal for bringing Single File Components to React. [Other proposals can be found here](https://github.com/react-sfc/react-sfc-proposal). The specific APIs are unstable for now and have already changed from what was shown at the React Rally talk!

> :warning: This is an experiment/proof of concept, and is a solo endeavor not endorsed by the React team. There are legitimate design concerns raised (see Concerns section below). It may remain a toy unless other folks pick it up/help contribute/design/maintain it! [Let me know what your interest is and help spread the word](https://twitter.com/swyx).

See philosophical discussion at React Rally 2020: https://www.youtube.com/watch?v=18F5v1diO_A

## Usage

2 ways use React SFCs in your app:

### As a CLI

To gradually adopt this in **pre-existing** React projects - you can leave your project exactly as is and only write individual SFCs in a separate folder, without touching your bundler config at all.

  - `npm i react-sfc`
  - Create a `/react` *origin* folder in your project to watch and compile **from**.
  - We assume you have a destination  `/src` *output* folder with the rest of your app, to compile **to**.
  - run `react-sfc watch` or `rsfc watch`.
  - Now you are free to create `/react/MyButton.react` files in that folder

CLI Flags:
  - If you need to customize the names of the folders that you are compiling **from** and compiling **to**, you can pass CLI flags: `react-sfc watch -f MYORIGINFOLDER -t MYOUTPUTFOLDER`
  - By default, the CLI compiles `.react` files into `.js` files. If you need it to output `.tsx` files or other, you can pass the extension flag `--extension tsx` or `-e tsx`. *Note: the developer experience for this is not yet tested*.

Other commands:

  - if you don't need a `watch` workflow, you can also do single runs with other commands (same CLI flags apply):
    - `react-sfc build` to build once
    - `react-sfc validate` to parse your origin folder without building, to check for errors

### As a Rollup plugin 

In a new or pre-existing React + Rollup project

  - Plugin: https://github.com/sw-yx/rollup-plugin-react-sfc
  - Demo: https://github.com/sw-yx/rollup-react-boilerplate

## Other ways

TBD. need help to write a webpack plugin version of this.

---

> Special note to readers: this package is deployed to `react-sfc` on npm right now - but i am not going to be selfish at all about this. if someone else comes along with a better impl i will give you the npm name and github org. Please come and take it.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Design Goals](#design-goals)
- [In 1 image](#in-1-image)
- [Features implemented](#features-implemented)
- [Basic Proposal](#basic-proposal)
- [Advanced Opportunities](#advanced-opportunities)
  - [CSS in JS](#css-in-js)
  - [State](#state)
  - [Binding](#binding)
  - [GraphQL](#graphql)
  - [Dev Optimizations](#dev-optimizations)
- [Why? I don't need this!](#why-i-dont-need-this)
- [General principle: Loaders vs SFCs](#general-principle-loaders-vs-sfcs)
- [Notable Concerns](#notable-concerns)
- [Am I missing some obvious idea or some critical flaw?](#am-i-missing-some-obvious-idea-or-some-critical-flaw)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Design Goals

- Stay "Close to JavaScript" to benefit from existing tooling: syntax highlighting, autocomplete/autoimport, static exports, TypeScript
- Have easy upgrade paths to go from a basic component to dynamic styles, or add state, or extract graphql dependencies
- Reduce verbosity without sacrificing readability

This probably means that a successful React SFC should be a superset of normal React: you should be able to rename any `.js` and `.jsx` file and it should "just work", before taking advantage of any new features.

## In 1 image

![image](https://user-images.githubusercontent.com/6764957/90271942-32ab5400-de8f-11ea-91a8-8a0cebebd6aa.png)



## Features implemented

- [x] Automatic react import
- [x] mutable useState `_` syntax
- [x] useStateWithLabel hook replaces useState to label in prod
- [x] Dynamic CSS transform to styled-JSX
- [x] set displayName if passed as compiler option
- [x] `$value={$text}` binding for onChange
  - this works for nested properties eg `$value={$text.foo}`

TODO:

- [ ] JS and CSS sourcemaps
- [ ] it does not properly work with `styled-jsx` in rollup - need [SUPER hacky shit](https://twitter.com/swyx/status/1290055528068952064) to work (see boilerplate's index.html)
- [ ] useEffect dependency tracking
- [ ] automatically extract text for i18n
- [ ] nothing graphql related yet
- [ ] optional `css` no-op function for syntax highlighting in JS
- [ ] $value shorthand eg `$value`
- [ ] $value generalized eg `$style`
- [ ] handle multiple bindings
- [ ] test for TSX support?

open questions

- what binding syntax is best?
  - considered `bind:value` but typescript does not like that
  - `$` prefix works but doesnt look coherent with the rest of RSFC format. using this for now
  - `_` prefix looks ugly? <- went with this one

## Basic Proposal

Here is how we might write a React Single File Component:

```js
let _count = 1

export const STYLE = `
    div { /* scoped by default */
      background-color: ${_count > 4 ? "papayawhip" : "palegoldenrod"};
    }
  `

export default () => {
  useEffect(() => console.log('rerendered'))
  return (
    <button onClick={() => _count++}> 
      Counter {_count}
    </button>
  )
}
```

The component name would be taken from the filename. Named exports would also be externally accessible.

## Advanced Opportunities

These require more work done by the surrounding compiler/distribution, and offer a lot of room for innovation:

### CSS in JS

We can switch nicely from no-runtime scoped styles to CSS-in-JS:

```js
export const STYLE = props => `
    div {
      background-color: ${props.bgColor || 'papayawhip'};
    }
  `
// etc
```

In future we might offer a no-op `css` function that would make it easier for editor tooling to do CSS in JS syntax highlighting:

```js
// NOT YET IMPLEMENTED
export const STYLE = css`
    div { /* properly syntax highlighted */
      background-color: blue;
    }
`
```

### State

We can declare mutable state:

```js
let _count = 0

export const STYLE = `
    button {
      // scoped by default
      background-color: ${_count > 5 ? 'red' : 'papayawhip'};
    }
  `

export default () => {
  return <button onClick={() => _count++}>Click {_count}</button>
}
```

<details>
<summary>
and this is transformed to the appropriate React APIs.
</summary>


```js
export default const FILENAME = () => {
  const [_count, set_Count] = useState(0);
  return (
    <>
      <button onClick={() => set_Count(_count++)}>Click {_count}</button>
      <style jsx>
        {`
          button {
            // scoped by default
            background-color: ${_count > 5 ? "red" : "papayawhip"};
          }
        `}
      </style>
    </>
  );
};
```

</details>


We can also do local two way binding to make forms a lot easier:


```js
let data = {
  firstName: '',
  lastName: '',
  age: undefined,
}

function onSubmit(event) {
  event.preventDefault()
  fetch('/myendpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export default () => {
  return (
    <form onSubmit={onSubmit}>
      <label>
        First Name
        <input type="text" bind:value={data.firstName} />
      </label>
      <label>
        Last Name
        <input type="text" bind:value={data.lastName} />
      </label>
      <label>
        Age
        <input type="number" bind:value={data.age} />
      </label>
      <button type="submit">Submit</button>
    </form>
  )
}
```

### Binding

Local two way binding can be really nice.


```js
let _text = 0

export default () => {
  return <input $value={_text} />
}
```

And this transpiles to the appropriate `onChange` handler and `value` attribute. It would also have to handle object access.

Another feature from Vue and Svelte that is handy is class binding. JSX only offers className as a string. We could do better:


```js
// NOT YET IMPLEMENTED
let _foo = 0
let _bar = 0

export default () => {
  return <form>
    <span $class={{
      class1: _foo,
      class2: _bar,
    }}>Test<span>
    <button onClick={() => _foo++}> Click {_foo}</button>
    <button onClick={() => _bar++}> Click {_bar}</button>
  </form>
}
```

### GraphQL

The future of React is [Render-as-you-Fetch](https://reactjs.org/docs/concurrent-mode-suspense.html#approach-3-render-as-you-fetch-using-suspense) data, and being able to statically extract the data dependencies from the component (without rendering it) is important to avoid Data waterfalls:

```js
// NOT YET IMPLEMENTED
export const GRAPHQL = `
    query MYPOSTS {
      posts {
        title
        author
      }
    }
  `
// NOT YET IMPLEMENTED
export default function MYFILE (props, {data, status}) {
    if (typeof status === Error) return <div>Error {data.state.message}</div>
    return (
      <div>
        Posts:
        {status.isLoading() ? <div> Loading... </div>
        : (
          <ul>
            {data.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        )
        }
      </div>
    )
  }
}
```

### Dev Optimizations

We can offer other compile time optimizations for React:

- Named State Hooks

Automatically insert `useDebugValue` for each `useState`:

```js
function useStateWithLabel(initialValue, name) {
    const [value, setValue] = useState(initialValue);
    useDebugValue(`${name}: ${value}`);
    return [value, setValue];
}
```

- Auto optimized useEffect

Automatically insert all dependencies when using `useAutoEffect`, exactly similar to https://github.com/yuchi/hooks.macro

## Why? I don't need this!

That's right, you don't -need- it. SFCs are always sugar, just like JSX. You don't need it, but when it is enough of a community standard it makes things nicer for almost everyone. SFC's aren't a required part of Vue, but they are a welcome community norm.

The goal isn't to evaluate this idea based on need. In my mind this will live or die based on how well it accomplishes two goals:

- For beginners, provide a blessed structure in a chaotic world of anything-goes.
- For experts, provide a nicer DX by encoding extremely common boilerplatey patterns in syntax.

Any new file format starts with a handicap of not working with existing tooling e.g. syntax highlighting. So a successful React SFC effort will also need to have a plan for critical tooling.

## General principle: Loaders vs SFCs

Stepping back from concrete examples to discuss how this might affect DX. In a sense, SFCs simply centralize what we already do with loaders. Instead of

```
Component.jsx
Component.scss
Component.graphql
```

we have

```js
export const STYLE // etc
export const GRAPHQL // etc
export default () => <div /> // etc
```

in a file. Why would we exchange file separation for a super long file? Although there are ways to mitigate this, it is not very appealing on its own.

However, to the extent that the React SFC loader is a single entry point to webpack for all these different filetypes, we have the opportunity to simplify config, skip small amounts of boilerplate, and enforce some consistency with the single file format. Having fewer files causes less pollution of IDE file namespace, and makes it easier to set up these peripheral concerns around jsx (styling, data, tests, documentation, etc) incrementally without messing with creating/deleting files.

## Notable Concerns

- "This is a sugar that makes things more complicated/confusing, not less. Like people aren't going to understand the boundaries of what is allowed here. Like if you can mutate the binding, can you mutate the value? Either way will cause confusion" - [source](https://twitter.com/buildsghost/status/1294355186538799105?s=20)
  - i need to think about this but i might end up agreeing
  - it might be possible to design around this


## Am I missing some obvious idea or some critical flaw?

File an issue or PR or [tweet at me](https://twitter.com/swyx), lets chat.
