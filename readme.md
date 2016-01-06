#Dal Segno

Write games, see your changes immediately

Every time you change your code, Dal Segno rewinds your game
back to the last time that piece of code was run.

[live site](http://dalsegno.ballingt.com/)



For something more polished, see Mary's [Code Lauren](http://codelauren.com/)
project.


#Language

Only one expression is allowed in a program.

##Keywords
* (**do** *expr1* [*expr2...*])
* (**if** *cond* *then* [*else*])
* (**define** *name* *expression*)
* (**set!** *name* *expression*)
* (**lambda** [*parameter1*...] *expression*)
* (**defn** *name* [*parameter1*...] *expression*)

defn expressions work update a global table of named functions in addition to
evaluating to a function.

## Example

    (do                       ;semicolons make the rest of a line a comment
      (define x 10)           ;creates function definitions
      (defn recur             ;named function definitions are global
        (do                   ;do blocks allow multiple expressions
          (color x 200 200)   ;sets the color to be used
                              ;for future draw operations
          (drawArc 300 x 111) ;queues a circle to be drawn

          (render)            ;actually paints queued drawings
          (set! x (+ x .01))  ;change var wherever it was defined
          (if (> x 300)       ;you've got if, set!, define, defn,
              (set! x 0))     ;and lambda - that's it for special forms
          (recur)))           ;no loop constructs - you have to recur!
      (recur))

## API

Identifier lookup checks the local namespace, then outer scopes.
Next is the standard library and builtin functions:

* stdlib - written in this this language and can be stepped through
  * map *
  * reduce
  * filter

* builtins - these are uninterruptable
  * (display *expr* [...]) - just (`console.log(args))
  * binary operators (prefix notation, like `(+ 2 2)`)
  * boolean logic
    * (and *e1* *e2*)
    * (or *e1* *e2)
    * (not *expr*)
    * (any [*expr*...])
  * list operations
    * (list [*e1*...])
    * (nth *index* *list*)
    * (first *list*)
    * (last *list*)
    * (rest *list*)
    * (append *list* *expr*)
    * (prepend *list* *expr*)
    * (length *list*)
    * (range *n*) - list of n numbers from 0 up to n-1
    * (concat [*list1*...])
  * game math
    * (dist *x1* *y1* *x2* *y2*) - Euclidian distance
    * (dist *p1* *p2*) - Euclidian distance betwen two two-element lists
    * (randint *lower* *upper*)
    * (towards *x1* *y1* *x2* *y2*) - degree heading to point
    * (towards *p1* *p2*) - degree heading to point
    * (x_comp *degrees*) - float between -1 and 1
    * (y_comp *degrees*) - float between -1 and 1
  * JavaScript interop
    * (jsGet *obj* *prop*)
    * (jsSet *obj* *prop* *value*)

* mouseTracker
  * (mousex) - horizontal position from the left
  * (mousey) - vertical position from the top
  * (mousepos) - list of [x, y]
* drawHelpers
  * (color *r* *g* *b*)
  * (render) - runs queued drawing events
  * (drawText *x* *y* [*text*...])
  * (drawPoly *x* *y* *list-of-x-y-pairs* *heading-in-degrees*])
  * (drawInverseCircle *x* *y* *radius*)

If an identifier is not found in the above scopes lookup proceeds to
JavaScript objects. If the found value is a function, a version of
it bound to the object it was looked up on is returned.
e.g. `log` -> `console.log.bind(console)`

* main canvas context
* main canvas
* console
* window

# Development

To run the code locally, run make then run a static file server:

    make
    python3 -m http.server

then open localhost:8000 in a webbrowser.

To run the tests, install mocha and chai and run mocha on the tests:

    npm install -g mocha
    npm install chai
    mocha test*

There's currently no build process, so JavaScript code
is limited to features that most browsers understand.

Ideas for improvements

* test and document keypress handler (keyPressed key from KeyboardTracker)
* methods for drawing and loading external assets by url
* more parse-time errors (function call arity, literal validity
  currently happen at runtime)
* vary speed in runner to achieve constant fps
* button to restore source to last parsable state
* inline documentation viewer
* language changes
  * group args in defns and lambdas
  * implicit do blocks everywhere (allow multiple expressions)
  * remove do
* code improvements
  * use a real module system instead of the hacks
  * allow external files so scm programs are in their own files (requires
    a build system)
* Add a real parser for syntax
  * `=`, `->` or `<-` for assignment
  * Lisp 2 (have to use apply for first element of a form to be dynamically
    evaluated) for easier compile-time arity checking
  * parens after function calls
