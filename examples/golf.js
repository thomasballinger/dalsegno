window.golfProgram = `
(defn terrain ()
  (concat
    (zip
      (list
        0
        (/ width 4)
        (/ width 2)
        (* 3 (/ width 4))
        width)
      (map
        (lambda (x)
          (randint 0 height))
        (range 5)))
      (list (list width height) (list 0 height))))
(defn get-win-spot (points)
  (nth (randint (- (length points) 2)) points))
(defn paint (points win)
      (drawPoly 0 0 points 0)
      (drawArc (first win) (first (rest win)) 10)
      (render))
(defn main ()
  (define mountains (terrain))
  (display mountains)
  (define dest (get-win-spot mountains))
  (defn loop ()
    (paint mountains dest)
    (render)
    (loop))
  (loop))
(main)`;
