import { walk } from "estree-walker";
import MagicString from "magic-string";
import {
  ImportDeclaration,
  TemplateLiteral,
  ExportNamedDeclaration,
  ArrowFunctionExpression,
  ExportDefaultDeclaration,
  FunctionDeclaration,
  ReturnStatement,
  VariableDeclaration,
  VariableDeclarator,
  AssignmentExpression,
  UpdateExpression,
  Identifier,
  Literal,
  MemberExpression,
  Expression,
} from "estree";

const hooks = [
  "useState",
  "useEffect",
  "useContext",
  "useReducer",
  "useCallback",
  "useMemo",
  "useRef",
  "useImperativeHandle",
  "useLayoutEffect",
  "useDebugValue",
];

interface ASTNode {
  start: number;
  end: number;
  type: string;
};

interface JSXOpeningElement extends ASTNode {
  type: 'JSXOpeningElement',
  attributes: JSXAttribute[],
  name: JSXIdentifier,
  selfClosing: boolean
}
interface JSXClosingElement extends ASTNode {
  type: 'JSXClosingElement'
  name: JSXIdentifier
}
interface JSXElement extends ASTNode {
  type: 'JSXElement',
  attributes: JSXAttribute[],
  openingElement: JSXOpeningElement
  closingElement: JSXClosingElement
  children: (JSXElement | JSXText)[]
}
interface JSXText extends ASTNode {
  type: 'JSXText'
  value: string,
  raw: string
}
interface JSXAttribute extends ASTNode {
  type: 'JSXAttribute',
  name: JSXNamespacedName | JSXIdentifier,
  value: JSXExpressionContainer | Literal
} 
interface JSXIdentifier extends ASTNode {
  type: 'JSXIdentifier'
  name: string
} 
interface JSXNamespacedName extends ASTNode {
  type: 'JSXNamespacedName',
  namespace: JSXIdentifier,
  name: JSXIdentifier
} 
interface JSXExpressionContainer extends ASTNode {
  type: 'JSXExpressionContainer'
  expression: Expression
} 

export function Compiler(args: {
  code: string;
  parser?: any; // TODO: parser type
  useStateWithLabel?: boolean
}) {
  const parser = args.parser;
  const ast: ASTNode = parser(args.code);
  let ms = new MagicString(args.code);

  const isProduction = false // TODO: figure out how to get this from rollup
  // undocumented option - tbd if we actually want to let users configure
  // TODO: can make it dev-only, or maybe also useful in prod?
  const userWantsUSWL = args.useStateWithLabel || !isProduction


  let STYLECONTENT, STYLEDECLARATION: any; //  typescript is stupid about assignment inside an if, thinks this is a `never` or a `undefined`
  let STYLESTATICCSS: any // just stubbing this out
  let lastChildofDefault: any; //  typescript is stupid about assignment inside an if, thinks this is a `never` or a `undefined`
  let pos_HeadOfDefault: number;
  let stateMap = new Map();
  let assignmentsMap = new Map();
  let bindValuesMap = new Map();
  let isReactImported = false;
  walk(ast, {
    enter(node, parent, prop, index) {
      if (node.type === "ImportDeclaration") {
        let _node = node as ImportDeclaration;
        if (_node.source.value === "react") isReactImported = true;
        // TODO: check that the name React is actually defined!
        // most people will not run into this, but you could be nasty
      }
      if (node.type === "CallExpression") {
        let _node = node as any; // CallExpression would be nice but SimpleLiteral is annoying
        if (hooks.some((hook) => _node.callee.name === hook)) {
          ms.prependLeft(_node.callee.start, "React.");
        }
      }

      if (node.type === "ExportNamedDeclaration") {
        let _node = (node as ExportNamedDeclaration).declaration;
        if (
          _node &&
          _node.type === "VariableDeclaration" &&
          _node?.declarations[0].id.type === "Identifier"
        ) {
          if (_node?.declarations[0].id.name === "STYLE") {
            let loc = _node.declarations[0].init as (
              | TemplateLiteral
              | ArrowFunctionExpression
            ) &
              ASTNode; // klooge as i believe TemplateLiteral type is incomplete
            // TODO: check return type of ArrowFunctionExpression as well

              /**
               * 
               * MVP of css static export feature
               * 
               */
              if (loc.type === 'TemplateLiteral' && loc.quasis.length === 1) {
                STYLESTATICCSS = loc.quasis[0].value.raw
                // TODO: namespace to scope to component
                // TODO: take care of css nesting
              } 
              /**
               * 
               * end MVP of css static export feature
               * 
               */

            if (loc) {
              STYLEDECLARATION = _node as VariableDeclaration & ASTNode;
              STYLECONTENT = ms.slice(loc.start, loc.end);
            }
            // TODO - consider whether to handle Literal (just string)
            // TODO - there are bunch of other expression types we may someday need to support (unlikely)
          }
        }
      }
      if (node.type === "ExportDefaultDeclaration") {
        let _node = (node as ExportDefaultDeclaration).declaration as
          | FunctionDeclaration
          | ArrowFunctionExpression; // TODO: consider other expressions
        if (_node.body.type === "BlockStatement") {
          let RSArg = (_node.body.body.find(
            (x) => x.type === "ReturnStatement"
          ) as ReturnStatement)?.argument as any; // TODO: this type is  missing JSXElement
          if (RSArg.type === "JSXElement")
            lastChildofDefault = RSArg.children.slice(-1)[0];
          // use start and end
          else throw new Error("not returning JSX in export default function"); // TODO: fix this?
        }

        pos_HeadOfDefault = (_node.body as any).start + 1;
      }
      // usestate
      if (node.type === "VariableDeclaration") {
        let dec = (node as VariableDeclaration)
          .declarations[0] as VariableDeclarator & { init: ASTNode };
        if (dec.id.type === "Identifier" && dec.id.name.startsWith("_")) {
          stateMap.set(dec.id.name, {
            node, // for replacement
            value: ms.slice(dec.init.start, dec.init.end), // for use in templating
          });
        }
      }

      // SETSTATE
      if (node.type === "AssignmentExpression") {
        // todo: maybe only read assignmentexpressions if the LHS is in the stateMap
        let LHS = (node as AssignmentExpression).left;
        if (LHS.type === "Identifier" && LHS.name.startsWith("_")) {
          assignmentsMap.set(LHS.name, { node });
        }
      }
      if (node.type === "UpdateExpression") {
        // todo: maybe only read assignmentexpressions if the LHS is in the stateMap
        let ID = (node as UpdateExpression).argument as Identifier;
        if (ID.name.startsWith("_")) {
          assignmentsMap.set(ID.name, { node });
        }
      }

      // BINDING
      if (node.type === "JSXAttribute") {
        // // bind:value syntax - we may want to use this
        // if (node.name.type === 'JSXNamespacedName' && node.name.namespace.name === 'bind') {
        //   bindValuesMap.set(node // to replace
        //     , {
        //     LHSname: node.name.name.name, // right now will basically only work for 'value'
        //     RHSname: ms.slice(node.value.expression.start, node.value.expression.end)
        //   })
        // }
        let _node = node as JSXAttribute
        if (
          _node.name.type === "JSXNamespacedName" &&
          _node.name.namespace.name === "bind"
        ) {
          let RHSobject, RHSname;
          // TODO: in future - support RHS which is just a Literal? MAAAYBE, maybe not
          if (_node.value.type === 'JSXExpressionContainer') {
            if (_node.value.expression.type === "Identifier") {
              // RHS is just an identifier
              RHSname = _node.value.expression.name;
            } else if (_node.value.expression.type === "MemberExpression") {
              // RHS is an object access
              let exp = _node.value.expression as MemberExpression & ASTNode
              RHSobject = {
                objectName:
                  (exp.object as Identifier).name ||
                  ((exp.object as MemberExpression).object as Identifier).name, // either its an identifier '$foo.bar` or a memberexpression `$foo.bar.baz`
                fullAccessName: ms.slice(
                  exp.start,
                  exp.end
                ),
              };
            } else {
              throw new Error(
                "warning - unrecognized RHS expression type in binding: " +
                  _node.value.expression.type +
                  ". We will probably do this wrong, pls report this along with your code"
              );
            }
          } 

          bindValuesMap.set(
            node, // to replace
            {
              LHSname: _node.name.name.name.slice(1), // only tested to work for 'value'. remove the leading $
              RHSname,
              RHSobject,
            }
          );
        }
      }
    },
    // leave(node) {
    //   // if (node.scope) scope = scope.parent;
    // }
  });

  /* 
  
  // process it!
  
  */
  if (!isReactImported) ms.prepend(`import React from 'react'`);
  // remove STYLE and insert style jsx
  if (STYLEDECLARATION && STYLECONTENT) {
    ms.remove(STYLEDECLARATION.start, STYLEDECLARATION.end);
    if (lastChildofDefault) ms.appendRight(
      lastChildofDefault.end,
      `<style jsx>{${STYLECONTENT}}</style>`
    );
  }

  // useState
  if (stateMap.size) {
    // for each state hook
    stateMap.forEach(({ node, value }, key) => {
      ms.remove(node.start, node.end);
      let newStr;
      if (userWantsUSWL) {
        // should be 'let' bc we want to mutate it
        newStr = `\nlet [${key}, set${key}] = use${key}_State(${value})`;
        // i would like to use only one instance, of useStateWithLabel
        // https://stackoverflow.com/questions/57659640/is-there-any-way-to-see-names-of-fields-in-react-multiple-state-with-react-dev
        // but currently devtools uses the NAME OF THE HOOK for state hooks
        // rather than useDebugValue. so we do a simple alias of the hook
        ms.append(`
function use${key}_State(v) {
  const x = React.useState(v)
  React.useDebugValue('${key}: ' + x[0])
  return x;
}`);
      } else {
        // just plain useState
        // should be 'let' bc we want to mutate it
        newStr = `\nlet [${key}, set${key}] = React.useState(${value})`;
      }
      ms.appendRight(pos_HeadOfDefault, newStr);
    });
  }

  // setState
  if (assignmentsMap.size) {
    assignmentsMap.forEach(({ node }, key) => {
      // strategy: use comma separator to turn
      // $count = $count + 1
      // into
      // ($count = $count + 1, set$count($count))
      ms.prependLeft(node.start, "(");
      ms.appendRight(node.end, `, set${key}(${key}))`);
    });
  }

  // binding
  if (bindValuesMap.size) {
    bindValuesMap.forEach(({ LHSname, RHSname, RHSobject }, node) => {
      if (RHSobject) {
        // create new object, mutate new object, THEN set it
        // must be new object or react doesnt rerender
        ms.overwrite(
          node.start,
          node.end,
          `${LHSname}={${RHSobject.fullAccessName}} 
        onChange={e => {
          let temp = Object.assign({}, ${RHSobject.objectName});
          temp${RHSobject.fullAccessName.slice(
            RHSobject.objectName.length
          )} = e.target.${LHSname};
          set${RHSobject.objectName}(temp);
        }}`
        );
      } else if (RHSname) {
        ms.overwrite(
          node.start,
          node.end,
          `${LHSname}={${RHSname}} onChange={e => set${RHSname}(e.target.${LHSname})}`
        );
      } else {
        throw new Error("we should not get here. pls repurt this binding bug");
      }
    });
  }

  let code = ms.toString();
  return {
    js: {
      code,
      map: null // todo
    }, 
    css: {
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // static css
      // THIS WHOLE THING IS A MASSIVE TODO
      code: STYLESTATICCSS,
      map: null
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
      // TODO
    }
  }
}
