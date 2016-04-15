window.golfProgram = `
(defn terrain ()
  (concat
    (list (list 0 height))
    (zip
      (linspace 0 width 10)
      (map (lambda (x) (randint 0 height))
           (range 11)))
    (list (list width height))))

(defn get-win-spot (points)
  (define point (get (randint (- (length points) 2)) points))
  (list (first point) (- (get 1 point) 20)))

(defn ground-below (x points)
  "the relevant points below the ball"
  (define 4-points (zip4 points
                        (rest points)
                        (rest (rest points))
                        (rest (rest (rest points)))))
  (define below
    (find (lambda (4-points) (> x (first (get 1 4-points))))
          4-points))
  below)

(defn collision (x y points r)
  (define points-to-check (ground-below x points))
  (define r (closestPointOrLine (list x y) points r))
  (first r))

(defn paint (points win x y)
      (color "lightblue")
      (fillRect 0 0 10000 10000)
      (color "black")
      (drawPoly 0 0 points 0)
      (color "green")
      (drawArc (first win) (first (rest win)) 10)
      (color "red")
      (drawArc x y 10))

(defn main ()
  (define points (terrain))
  (define lines (zip points (rest points)))
  (display lines)
  (define dest (get-win-spot points))
  (define y 10)
  (define x 1)
  (define dy 1)
  (define dx (random))
  (defn loop ()
    (define c (collision x y points 10))
    (if c
      (do (define newV (bounce x y dx dy c))
          (display "bounce!" newV)
          (set! dx (first newV))
          (set! dy (get 1 newV))))
    (set! x (+ x dx))
    (set! y (+ y dy))
    (set! dy (+ dy .1))
    (if (and (> x 0) (< x width))
      (do
        (paint points dest x y)
        (color "yellow")
        (fillLine (ground-below x points))
        (color "green")
        (render)
        (loop))
      (main)))
  (loop))
(main)
`;
