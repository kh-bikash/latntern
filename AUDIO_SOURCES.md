# Field recording sources

The recordings in `public/audio` are CC0/public domain releases by Joseph Sardin via BigSoundBank. The sound toggle is off until a player enables it.

| File | Recording | Source |
| --- | --- | --- |
| `wind-trees.mp3` | Wind in the Trees | https://bigsoundbank.com/forest-wind-in-the-trees-s0904.html |
| `forest-birds.mp3` | Forest | https://bigsoundbank.com/foret-s0100.html |
| `rain-puddles.mp3` | Rain on Puddle | https://bigsoundbank.com/rain-on-puddle-s1290.html |
| `ocean-waves.mp3` | Sea: Waves | https://bigsoundbank.com/sea-waves-s0266.html |
| `small-cascade.mp3` | Small Cascade | https://bigsoundbank.com/small-cascade-s0507.html |
| `bronze-bell.mp3` | Bronze bell #7 | https://bigsoundbank.com/bronze-bell-7-s2709.html |

Additional CC0 recordings by Joseph Sardin:

| File | Recording | Source |
| --- | --- | --- |
| `hearth.mp3` | Fireplace #2, open hearth | https://bigsoundbank.com/fireplace-2-s0031.html |
| `page-turn.mp3` | Pages that turn #7, paperback page | https://bigsoundbank.com/pages-that-turn-7-s2214.html |

`public/audio/foley/` uses Kenney's CC0 Impact Sounds pack: https://kenney.nl/assets/impact-sounds. Concrete and snow footsteps match the illustrated stone/snow paths. Soft impacts supply takeoff and landing foley; metal clicks accompany the compass; glass impacts accompany wishes; wood impacts accompany chests and gates. Three bell pitches are derived from the recorded bronze bell. These are designed effects, not recordings of fictional magical objects.

The sound engine crossfades recording loop boundaries, varies footsteps without immediate repetition, follows movement distance, attenuates companion footsteps, and positions water and shrine fire in stereo. A convolution reflection tail models cavern acoustics. Separate master, environment, and effects gain controls are saved per device. Muting cancels pending effects and active sources; hidden tabs suspend sound. No speech synthesis or generated narration is included.
