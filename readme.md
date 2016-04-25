#Dal Segno

Write games, see your changes immediately:
every time you change your code, Dal Segno rewinds your game
back to the last time that piece of code was run.

[about](http://dalsegno.ballingt.com/about/)
[fullscreen demo](http://dalsegno.ballingt.com/)

#Language

It's sort of like Scheme.

### Example

<a
href="http://dalsegno.ballingt.com/?code=;semicolons%20make%20the%20rest%20of%20a%20line%20a%20comment%0A(define%20x%2010)%20%20%20%20%20%20%20%20%20%20%20;var%20x%20=%2010%0A(defn%20recur%20()%20%20%20%20%20%20%20%20%20%20;named%20function%20definitions%20are%20global%0A%20%20(color%20100%20200%20100)%20%20%20;sets%20the%20color%20to%20be%20used%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20;for%20future%20draw%20operations%0A%20%20(fillRect%200%200%20width%20height)%20;this%20is%20the%20canvas%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20;context%20drawing%20operation%0A%20%20(color%200%200%20230)%0A%20%20(drawArc%20x%20100%20111)%20%20%20;queues%20a%20circle%20to%20be%20drawn%0A%20%20(render)%20%20%20%20%20%20%20%20%20%20%20%20%20%20;actually%20paints%20queued%20drawings%0A%20%20(set!%20x%20(+%20x%20.1))%20%20%20%20%20;change%20var%20wherever%20it%20was%20defined%0A%20%20(if%20(%3E%20x%20300)%20%20%20%20%20%20%20%20%20;you%27ve%20got%20if,%20set!,%20define,%20defn,%0A%20%20%20%20%20%20(set!%20x%200))%20%20%20%20%20%20%20;and%20lambda%20-%20that%27s%20it%20for%20special%20forms%0A%20%20(recur))%20%20%20%20%20%20%20%20%20%20%20%20%20%20;no%20loop%20constructs%20-%20you%20have%20to%20recur!%0A(recur)">Try
it</a>

    ;semicolons make the rest of a line a comment
    (define x 10)           ;var x = 10
    (defn recur ()          ;named function definitions are global
      (color 100 200 100)   ;sets the color to be used
                            ;for future draw operations
      (fillRect 0 0 width height) ;this is the canvas
                            ;context drawing operation
      (color 0 0 230)
      (drawArc x 100 111)   ;queues a circle to be drawn
      (render)              ;actually paints queued drawings
      (set! x (+ x .1))     ;change var wherever it was defined
      (if (> x 300)         ;you've got if, set!, define, defn,
          (set! x 0))       ;and lambda - that's it for special forms
      (recur))              ;no loop constructs - you have to recur!
    (recur)

###Keywords
* (**if** *cond* *expr1* [*expr2*])
* (**define** *name* *expr*)
* (**set!** *name* *expr*)
* (**lambda** (*param*...) *expr1...*)
* (**defn** *name* [*param1*...) *expr1...*)
* (**do** *expr1* [*expr2...*])

**defn** expressions update a global table of named functions in addition to
evaluating to a function.
Use **do** to put multiple expressions in the body of an **if**, **set**, or **define**

### API

Identifier lookup checks the local scope, outer scopes, then
the standard library and builtin functions:

* standard library - written in this this language and can be stepped through
  * (map *func* *array*)
  * (reduce *func* *array* *initial*)
  * (filter *func* *array*)
  * (find *func* *array*)
* builtins - written in JavaScript and execute in a single tick
  * (display *expr* [...]) - just (`console.log(args)`)
  * binary operators (prefix notation, like `(+ 2 2)`)
  * boolean logic
    * (and *e1* *e2*)
    * (or *e1* *e2*)
    * (not *expr*)
    * (any [*expr*...])
  * list operations
    * (list [*e1*...])
    * (get *index* *list*)
    * (first *list*)
    * (last *list*)
    * (rest *list*)
    * (append *list* *expr*)
    * (prepend *list* *expr*)
    * (length *list*)
    * (range *n*) - list of n numbers from 0 up to n, including 0 but not including n
    * (linspace *start* *stop* *n*) - list of n evenly spaced numbers from start
    to stop inclusive on both sides
    * (concat [*list1*...])
    * (zip *list1*)
    * (zip2 *list1* *list2*)
    * (zip3 *list1* *list2* *list3*)
    * (zip4 *list1* *list2* *list3* *list4*)
  * game math
    * (dist *x1* *y1* *x2* *y2*) - Euclidian distance
    * (dist *p1* *p2*) - Euclidian distance betwen two two-element lists
    * (randint *lower* *upper*)
    * (towards *x1* *y1* *x2* *y2*) - degree heading to point
    * (towards *p1* *p2*) - degree heading to point
    * (x_comp *degrees*) - float between -1 and 1
    * (y_comp *degrees*) - float between -1 and 1
    * (distToLine *point* *line*) - distance from point to line segment
    * (distToLine *point* *p1* *p2*) - distance from point to line segment
    defined by p1 and p2
    * (linesIntersect *line* *line*) - whether two line segments intersect
    * (linesIntersect *p1* *p2* *p3* *p4*) - whether two line segments intersect
    * (pointFromLineSegment *p1* *p2* *p3*) - distance from a point to a line
    segment
    * (closestPointOrLine *p1* *points*) - the closest [x, y] point or [[x, y],
    [x, y]] line segment closest to the point p1 or null if no points given
    * (closestPointOrLine *p1* *points* *maxDist*) - the closest [x, y] point or [[x, y],
    [x, y]] line segment closest to the point p1 or null if none closer than
    maxDist
    * (bounce *x* *y* *dx* *dy* *pointOrLine*) - New [dx, dy] after bouncing off of
    pointOrLine
    * (linesFromPoints points) - pairs of consecutive points to fom lines
  * JavaScript interop
    * (jsGet *obj* *prop*)
    * (jsSet *obj* *prop* *value*)
* mouseTracker
  * (mousex) - horizontal position from the left
  * (mousey) - vertical position from the top
  * (mousepos) - list of [x, y]
* drawHelpers
  * (color *r* *g* *b*)
  * (render) - runs queued canvas context drawing procedures
  * (drawText *x* *y* [*text*...])
  * (drawPoly *x* *y* *list-of-x-y-pairs* *heading-in-degrees*])
  * (drawInverseCircle *x* *y* *radius*)
  * (fillLine *points*)

If an identifier is not found in the above scopes lookup proceeds to
JavaScript objects. If the found value is a function, a version of
it bound to the object it was looked up on is returned.
e.g. `log` -> `console.log.bind(console)`

* main lazy canvas context which is similar to a [CanvasRenderingContext2d](
  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
  but rendering does not occur until `render` is called. This is where
  drawing functions like `(fillRect x y width height)` come from.
* main [canvas](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement)
* [console](https://developer.mozilla.org/en-US/docs/Web/API/Console)
* [window](https://developer.mozilla.org/en-US/docs/Web/API/Window)

# Development

To run the code locally, run make to download a dependency then run a static file server:

    make
    python3 -m http.server 8000  # or any other static file server

then open localhost:8000 in a webbrowser.

To run the tests, install mocha and chai and run mocha on the tests:

    npm install -g mocha
    npm install chai
    mocha test*

There's currently no build process, which is nice and simple but
means that embedding requires a long list of script tags.
The ES5/6 features in the code are limited to those implemented
in Chrome, Firefox, and Node without requiring any flags.

I'd be open to adding a build system if you write the PR,
if I do it myself it's going to be Webpack.

Ideas for improvements

* display most recently run named functions and when they were run,
  and clicking them rewinds state to that time.
* either a rewind animation or an animation replacing the current image
  with the old one when old state is restored
* save canvas state for restores: save/restore for scope objects
* pause builtin function
* branches of ifs acting like functions: changing them rewinds
  back to last time they were changed
* stepper debugger: buttons and highlighting source
* REPL for quickly evaluating expressions in the same environment
* example of JS interop
* test and document keypress handler (keyPressed key from KeyboardTracker)
* methods for drawing and loading external assets by url
* more parse-time errors (function call arity, literal validity
  currently happen at runtime)
* vary speed in runner to achieve constant fps
* "fast" versions of map etc. that are written in JavaScript
  and execute in one step
* button to restore source to last parsable state
* inline documentation viewer
* prettier error message display
* write a virtual machine instead of using generators
* code improvements
  * use a real module system instead of the hacks
  * allow external files so scm programs are in their own files (requires
    a build system)
* Use a better syntax for beginners - something like http://codelauren.com/
  * `=`, `->` or `<-` for assignment
  * Lisp 2 (have to use apply for first element of a form to be dynamically
    evaluated) for compile-time arity checking
  * parens after function calls

# Motivation

I wrote this to play with interpreters and so I could be informed as
I talked to [Mary Rose Cook](http://maryrosecook.com/) about her
[Code Lauren](http://codelauren.com/) project.
