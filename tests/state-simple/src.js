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