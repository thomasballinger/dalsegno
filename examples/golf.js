// vim: set ft=scheme:
window.golfProgram = `
(defn terrain (n)
  (define hole-start (- (* 2 (/ width 3)) 17))
  (define hole-end (+ (* 2 (/ width 3)) 17))
  (define points-before (// (* n 2) 3))
  (define points-after (// n 3))

  (define last-y 0)
  (define next-y (randint 0 height))
  (defn gradual-slope (x)
    (set! last-y next-y)
    (set! next-y (max 100 (min (- height 100)
      (+ last-y (randint -50 50)))))
    last-y)

  (concat
    (list (list 0 height))
    (zip
      (linspace 0 hole-start (- points-before 1))
      (map gradual-slope (range points-before)))
    (do
      (set! next-y last-y)
      (list (list (+ hole-start 5) (- last-y 1))
            (list (+ hole-start 6) (+ last-y 24))
            (list (- hole-end 6) (+ last-y 24))
            (list (- hole-end 5) (- last-y 1))))
    (zip
      (linspace hole-end width (- points-after 1))
      (map gradual-slope (range points-after)))
    (list (list width height))))

(define ground-below-lookup)
(defn init-ground-below (points)
  (define 4-points (zip4 points
                        (rest points)
                        (rest (rest points))
                        (rest (rest (rest points)))))
  (defn below (x)
    (find (lambda (points) (< x (first (get 2 points))))
          4-points))
  (define x-index 0)
  (set! ground-below-lookup
    (map (lambda (x)
      (if (= x-index (- (length 4-points) 1))
        (last 4-points)
        (if (> x (first (get 2 (get x-index 4-points))))
            (do
              (set! x-index (+ 1 x-index))
              (get x-index 4-points))
            (get x-index 4-points))))
    (range (+ width 1)))))
(defn ground-below (x)
  "the relevant points below the ball"
  (get (// x 1) ground-below-lookup))

(defn collision (x y points r)
  (define r (closestPointOrLine (list x y) points r))
  (first r))

(defn paint (points x y)
      (color "lightblue")
      (fillRect 0 0 10000 10000)
      (color "black")
      (drawPoly 0 0 points 0)
      (color "red")
      (drawArc x y 10))

(defn main ()
  (define points (terrain 20))
  (init-ground-below points)
  (define lines (zip points (rest points)))
  (define y 10)
  (define x 1)
  (define dy 0)
  (define dx (random))
  (defn loop ()
    (define c (collision x y (ground-below x) 10))
    (if c
      (do (define newV (bounce x y dx dy c))
          (set! dx (first newV))
          (set! dy (get 1 newV))))
    (set! x (+ x dx))
    (set! y (+ y dy))
    (set! dy (+ dy .1))
    (if (and (> x 0) (< x width))
      (do
        (paint points x y)
        (color "yellow")
        (fillLine (ground-below x))
        (color "green")
        (render)
        (loop))
      (main)))
  (loop))
(main) `;
