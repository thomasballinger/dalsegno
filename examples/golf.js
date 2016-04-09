window.golfProgram = `(do
  (defn terrain (zip (list 0 (/ width 4) (/ width 2) (* 3 (/ width 4)) width)
                     (map (lambda x (randint 0 height)) (range 5))))
  (display (terrain)))
`;
