// vim: set ft=scheme:
window.breakoutProgram = `(define paddle-y (- height 20))
(define ball-x 100)
(define ball-y (- height 50))
(define dx 1)
(define dy 1)
(define paddle-w 100)

(defn draw ()
  (color 130 200 230)
  (fillRect 0 0 width height)
  (color 200 0 100)
  (fillRect (- paddle-x (/ paddle-w 2))
            paddle-y paddle-w 10)
  (color "darkblue")
  (fillRect (- ball-x 5) (- ball-y 5) 10 10)
  (render))

(defn bounce ()
  (set! dy (- 0 dy)))


(defn move (speed)
  (set! paddle-x (mousex))
  (set! ball-x (+ ball-x (* dx speed)))
  (set! ball-y (+ ball-y (* dy speed)))

  (if (or (< ball-x 10)
          (> ball-x (- width 10)))
    (set! dx (- 0 dx)))
  (if (< ball-y 0)
    (set! dy (- 0 dy)))
  (if (and (> ball-y paddle-y)
           (< (abs (- paddle-x ball-x))
              (/ paddle-w 2)))
      (bounce))
  (if (> ball-y height)
    (do
      (display "Oops! Try again.")
      (set! ball-x 100)
      (set! ball-y 100))))

(define paddle-x)

(defn main ()
  (move 1)
  (draw)
  (main))

(main)`;
