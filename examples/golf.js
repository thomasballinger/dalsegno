window.golfProgram = `
(defn terrain ()
  (zip
    (linspace 0 width 10)
    (map (lambda (x) (randint 0 height))
         (range 11))))

(defn get-win-spot (points)
  (define point (nth (randint (- (length points) 2)) points))
  (list (first point) (- (nth 1 point) 20)))

(defn ground-below (x lines)
  (define below
    (filter (lambda (p) (> x (first (first p))))
            lines))
  (if (> (length below) 0)
      (first below)
      (list (list -1000 height) (list 1000 height))))

(defn collide (x1 y1 x2 y2 lines)
  (define line (ground-below x1 lines))
  (linesIntersect (first line) (last line) (list x1 y1) (list x2 y2)))

(defn paint (points win x y)
      (define mountainPoly
        (concat
          points
          (list (list width height) (list 0 height))))
      (color "lightblue")
      (fillRect 0 0 10000 10000)
      (color "black")
      (drawPoly 0 0 mountainPoly 0)
      (color "green")
      (drawArc (first win) (first (rest win)) 10)
      (color "red")
      (drawArc x y 10)
      (render))

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
    (color "yellow")
    (fillLine (ground-below x lines))
    (display (collide x y (+ x dx) (+ y dy) lines))
    (fillLine x y (+ x  (+ y dy))
    (render)
    (set! x (+ x dx))
    (set! y (+ y dy))
    (set! dy (+ dy .1))
    (paint points dest x y)
    (loop))
  (loop))
(main)
`;
