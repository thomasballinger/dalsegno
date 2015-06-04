todo:

* evaluation
  - [x] implement copy method on all evalGen objects
  - [x] keep track of function invocations
  - [x] parse code for function asts
  - [x] restore
  - [x] handling changing the top level expression
  - [ ] more parse-time errors (arity, valid literals)
  - [ ] vary speed in runner to achieve constant fps

* gamelib
  - [x] methods for scheduling drawings and for clearing then drawing all at once
  - [ ] somehow do reasonable scheduling of draw operations - maybe can group
        code to be run together somewhow?
  - [ ] methods for drawing and loading assets over http
  - [x] include canvas methods and window methods in the lookup chain

* interface
  - [x] display error messages
  - [ ] restore to last parsable state

* build
  - [ ] start using a real module system
  - [ ] use a cool coroutine runner thing
  - [ ] allow external files so scm programs are in their own files

Language ideas
--------------

* language
  - group args in defns and lambdas
  - implicit do blocks everywhere (allow multiple expressions)
  - remove do from the language
  - methods for js interop: attribute access

Once we have syntax instead of scheme...

* `=`, `->` or `<-` for assignment
* Lisp 2 (have to use apply for first element of a form to be dynamically
  evaluated) for easier compile-time arity checking
* parens after function calls



