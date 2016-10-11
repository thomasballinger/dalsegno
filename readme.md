#Dal Segno

Write games, see your changes immediately:
every time you change your code, Dal Segno rewinds your game
back to the last time that piece of code was run.

[demo](http://dalsegno.ballingt.com/)

[try it fullscreen](http://dalsegno.ballingt.com/fullscreen)

#Language

It's sort of like Scheme.

### Example

<a
href="http://dalsegno.ballingt.com/fullscreen/?code=simpleProgram">Run
this program fullscreen</a>

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

To run the code locally you'll need webpack and some loaders.

    npm install
    npm install -g webpack

Once those are installed, run the following:

    make
    python3 -m http.server 8000  # or any other static file server

and open localhost:8000 in a webbrowser.

To run the tests, install mocha and chai and run mocha on the tests:

    npm install -g mocha
    npm install chai
    mocha src/test*

The ES5/6 features in the code are limited to those implemented
in Node without requiring any flags so the tests can be run
without compiling.

## Todo

There are a lot of directions to take this, I capped it off pretty
arbitrarily because I wanted to be able to show it to people.
Some particularly relevant things to do:

* Fix up DalSegno.js to allow editing and stepping in the same embed.
  This mostly works, but not all of the state transitions are covered.
* Move all effects to the effect canvas, currently the main lazycanvas
  is still doing extra work.
* An alternate interpreter mode that does not save snapshots.
  This would be nice for publishing programs for use.
* faster GC and fix memory leaks

I have a lot of smaller fixes I'd like to make,
if you'd like to contribute let me know and I can advise on your PR.
Here are a few simple fixes:

* AST highlighting regions are slightly off (usually 1 extra character on each side)
* Set focus on mouseover for Dal Segno widget for keyboard events
* Save current program in local storage instead of url
* Keep multiple programs saved at a time

There's lots more, if there's interest I can throw a lot of things up on an issue
tracker.

## Motivation

I wrote this to play with interpreters and so I could be informed as
I talked to [Mary Rose Cook](http://maryrosecook.com/) about her
[Code Lauren](http://codelauren.com/) project.
