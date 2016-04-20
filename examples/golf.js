// vim: set ft=scheme:
window.golfProgram = `
(defn terrain (n)
  ; returns points and hole x y
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

  (define points (concat
    (list (list 0 height))
    (zip
      (linspace 0 hole-start points-before)
      (map gradual-slope (range points-before)))
    (do
      (set! next-y last-y)
      (define hole-y (+ last-y 12))
      (list (list (+ hole-start 5) last-y)
            (list (+ hole-start 6) (+ last-y 24))
            (list (- hole-end 6) (+ last-y 24))
            (list (- hole-end 5) last-y)))
    (zip
      (linspace hole-end width points-after)
      (map gradual-slope (range points-after)))
    (list (list width height))))
  (list points (/ (+ hole-start hole-end) 2) hole-y))

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

(defn paint (points x y draw-mouse-line)
      (color "lightblue")
      (fillRect 0 0 10000 10000)
      (color "black")
      (drawPoly 0 0 points 0)
      (color "red")
      (drawArc x y 10))

(defn start-spot (points)
  (define index (randint 3 (// (length points) 2)))
  (define point (get index points))
  (list (first point) (- (get 1 point) 20)))

(defn main ()
  (define stuff (terrain 20))
  (define points (first stuff))
  (define hole (rest stuff))

  (drawText 100 100 "get ready...")
  (render)
  (init-ground-below points)
  (define lines (zip points (rest points)))
  (define start (start-spot points))
  (define x (first start))
  (define y (get 1 start))
  (define dy 0)
  (define dx (random))
  (defn fly-loop ()
    (define c (collision (+ x dx) (+ y dy) (ground-below x) 10))
    (if c
      (do
          (define newV (bounce x y dx dy c))
          (define portion .7)
          (set! dx (* (first newV) portion))
          (set! dy (* (get 1 newV) portion))))

    (set! x (+ x dx))
    (set! y (+ y dy))

    (define min-motion .6)
    (if (and (> x 0) (< x width))
      (do
        (paint points x y 0)
        (color "yellow")
        (fillLine (ground-below x))
        (color "green")
        (render)
        (if (not (and c (< (+ (abs dx) (abs dy)) min-motion)))
          (do
            (set! dy (+ dy .1))
            (fly-loop))
          (if (< (+ (abs (- x (first hole)))
                    (abs (- y (get 1 hole)))) 10)
              (main))))
      (do
        (set! x (first start))
        (set! y (get 1 start)))))
  (defn aim-loop ()
    (paint points x y 0)
    (color "green")
    (fillLine  (list (list x y) (mousepos)))
    (render)
    (if (clicked)
      (do
        (set! dx (/ (- (mousex) x) 10))
        (set! dy (/ (- (mousey) y) 10)))
      (aim-loop)))
  (defn gameloop ()
    (aim-loop)
    (fly-loop)
    (gameloop))
  (gameloop))
(main) `;
