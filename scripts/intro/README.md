# Intro animation (`assets/animations/snappose-intro.json`)

The launch screen plays this Lottie file. To change the intro, replace the file — e.g. with a
designer's After Effects export (Bodymovin plugin): 512×512, transparent background, ~2 s.
No code change or app rebuild is needed.

The current file is generated from the logo PNG itself:

```bash
python split_logo.py ../../assets/images/splash-icon.png layers/      # tile, S halves, lens, dot
python make_intro_lottie.py layers/ ../../assets/animations/snappose-intro.json
```

Needs `numpy`, `scipy` and `pillow`. The split is tuned to this logo (blue tile, pink S, lens at
the center); a new logo design needs the timings or the split revisited.
