import React from 'react';

export default () => {
let [_sdlkj, set_sdlkj] = use_sdlkj_State({
  foo: 23
})
  return <input value={foo._sdlkj} 
        onChange={e => {
          let temp = Object.assign({}, foo);
          temp._sdlkj = e.target.value;
          setfoo(temp);
        }}></input>
}
function use_sdlkj_State(v) {
  const x = React.useState(v);
  React.useDebugValue('_sdlkj: ' + x[0]); return x;
}