#Dal Segno

Write games, see your changes immediately

Every time you change your code, Dal Segno rewinds your game
back to the last time that piece of code was run.

[live site](http://dalsegno.ballingt.com/)



For something more polished, see Mary's [Code Lauren](http://codelauren.com/)
project.


## Language
Approximately like scheme.

    ; It's like scheme!
    (do
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

## Drawing Primitives


## JavaScript interop:

If a variable name cannot be resolved to a binding you introduced,
method lookup will occur over the following JavaScript objects:
* 




# Development

To run the code locally, run make then run a static file server:

    make
    python3 -m http.server

then open localhost:8000 in a webbrowser.

Run the tests:

There's currently no build process, so JavaScript code
is limited to features that most browsers understand.

Ideas for improvements

  - [ ] methods for drawing and loading assets over http
  - [ ] more parse-time errors (function call arity, literal validity
        currently happen at runtime)
  - [ ] vary speed in runner to achieve constant fps
  - [ ] button to restore source to last parsable state
  - [ ] use a real module system instead of the hacks
  - [ ] allow external files so scm programs are in their own files (requires
        a build system)

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



