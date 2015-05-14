(do
  (defn game (do
    (define x 100)
    (define vx 1)
    (define counter 0)
    (defn on-c
      (set! vx (+ vx 1)))
    (defn main (do
      (set! counter (+ counter 1))
      (if c
          (do 
	    (set! c 0)
	    (on-c)))
      (set! x (+ x vx))
      (main)))
    (main)))
  (game))
