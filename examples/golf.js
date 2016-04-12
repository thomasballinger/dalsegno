window.golfProgram = `
(defn terrain ()
  (concat
    (zip
      (list 0 (/ width 4) (/ width 2)
            (* 3 (/ width 4)) width)
      (map (lambda (x) (randint 0 height))
           (range 5)))
    (list (list width height) (list 0 height))))

(defn get-win-spot (points)
  (define point (nth (randint (- (length points) 2)) points))
  (list (first point) (- (nth 1 point) 20)))

(defn paint (points win x y)
      (color "lightblue")
      (fillRect 0 0 10000 10000)
      (color "black")
      (drawPoly 0 0 points 0)
      (color "green")
      (drawArc (first win) (first (rest win)) 10)
      (color "red")
      (drawArc x y 10)
      (render))

(defn main ()
  (define mountains (terrain))
  (define dest (get-win-spot mountains))
  (define y 10)
  (define x 0)
  (define dy 1)
  (defn loop ()
    "TODO make the ball fall here"
    (set! y (+ y dy))
    (set! dy (+ dy .1))
    (display y)
    (paint mountains dest x y)
    (loop))
  (loop))
(main)`;
