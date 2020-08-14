import React from 'react';

export default () => {
let [_abc, set_abc] = use_abc_State(123)
  return <button onClick={() => (_abc++, set_abc(_abc))}>{_abc}</button>
}
function use_abc_State(v) {
  const x = React.useState(v);
  React.useDebugValue('_abc: ' + x[0]); return x;
}