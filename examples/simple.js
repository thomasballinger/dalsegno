// vim: set ft=scheme:
window.simpleProgram = `;semicolons make the rest of a line a comment
(define x 10)           ;for JSers, that's var x = 10
(defn recur ()          ;defn creates a global function
  (color 100 200 100)   ;sets the color to be used
                        ;for future draw operations
  (fillRect 0 0 width height) ;this is the canvas
                        ;context drawing operation
  (color 0 0 230)
  (drawArc x 100 111)   ;queues a circle to be drawn
  (render)              ;actually paints queued drawings
  (set! x (+ x 5))      ;change var wherever it was defined
  (if (> x 300)         ;you've got if, set!, define, defn,
      (set! x 0))       ;and lambda - that's it for special forms
  (recur))              ;no loop constructs - you have to recur!
(recur)`;
