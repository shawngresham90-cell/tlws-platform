# I-75 GA/TN anchor report

Snapshot date: 2026-07-21. Anchors come ONLY from already-verified data:
applied directory coordinates (`directory-verified`) and high/medium rows in the
committed geocoding batch CSVs. No coordinate here was invented.

## I-75 GA — 23 anchors, mileposts 2–328

- directory-verified: 23

| milepost | lat | lng | listing | source |
| --- | --- | --- | --- | --- |
| 2 | 30.643997 | -83.18766 | `93653e22-f954-4d6b-acd8-9f547ce4b947` | directory-verified |
| 11 | 30.754267 | -83.273221 | `a732e380-3d35-43b5-916a-47198de64c3e` | directory-verified |
| 13 | 30.77424 | -83.29849 | `371724fa-2260-4d55-bbc7-0ddeeb680138` | directory-verified |
| 16 | 30.821132 | -83.310514 | `3123ff2a-256c-46fd-a7de-2571ee9f2abb` | directory-verified |
| 39 | 31.138574 | -83.444919 | `38139280-d79e-4c84-8807-5831c72095a7` | directory-verified |
| 59 | 31.415715 | -83.503054 | `6dbef08c-6306-4db2-bccf-5da49a0a2ac8` | directory-verified |
| 60 | 31.428514 | -83.51632 | `51453818-0072-4986-b256-b8c8c38fe0b2` | directory-verified |
| 101 | 31.959812 | -83.746752 | `2014a51a-b405-4d49-a3b4-a22a9844ac5f` | directory-verified |
| 102 | 31.975579 | -83.758552 | `f4591f0b-087b-4856-8957-5a7e020fa209` | directory-verified |
| 109 | 32.085408 | -83.759891 | `c8d0eb8c-df20-4bd7-89f2-038aa550c3ee` | directory-verified |
| 121 | 32.256023 | -83.738816 | `d296a4d1-0b43-4775-8060-7aff11dcba16` | directory-verified |
| 146 | 32.612278 | -83.744515 | `61744d1b-3abe-4aed-bbcc-775321a08d5b` | directory-verified |
| 153 | 32.717528 | -83.733418 | `5708e6e0-a61e-4647-a361-32610aeb680a` | directory-verified |
| 201 | 33.205898 | -84.058286 | `33e41d22-1dac-425b-a17d-c9b6affcda21` | directory-verified |
| 283 | 34.118857 | -84.743165 | `a45b0906-ec99-4785-bfd6-afae328bc2aa` | directory-verified |
| 290 | 34.204645 | -84.765267 | `e1219266-0289-4b70-83aa-b122fa95993d` | directory-verified |
| 293 | 34.241411 | -84.774739 | `c9d1ece9-f5fc-4358-a8c5-6467efdda424` | directory-verified |
| 296 | 34.273972 | -84.807762 | `0f848a8a-9f2f-4e89-bed3-97d656bcd25d` | directory-verified |
| 310 | 34.443856 | -84.915181 | `15f5c84b-8284-455e-8928-c688f5a308ab` | directory-verified |
| 318 | 34.55883 | -84.935611 | `4e8c0e97-4aab-4853-8e43-904eacb3b0a9` | directory-verified |
| 320 | 34.576835 | -84.946624 | `a178c35e-73ba-4c23-bbe4-605dc4a365c4` | directory-verified |
| 326 | 34.655613 | -84.981043 | `599cf7a7-eb06-4527-bcdb-69daa62e11c7` | directory-verified |
| 328 | 34.687265 | -85.000154 | `32188e16-75ce-477c-b671-a22f8606b139` | directory-verified |

## I-75 TN — 12 anchors, mileposts 11–141

- directory-verified: 12

| milepost | lat | lng | listing | source |
| --- | --- | --- | --- | --- |
| 11 | 35.063425 | -85.07313 | `b76a9ddb-e96a-4ae7-941c-03d2cee8417a` | directory-verified |
| 20 | 35.153142 | -84.952948 | `444e4c77-93aa-4cbc-a8f7-825079fac2f3` | directory-verified |
| 25 | 35.189995 | -84.88141 | `6388ce8e-6d60-43c0-a9ad-5069f26781b8` | directory-verified |
| 33 | 35.291951 | -84.818048 | `08d24d71-a131-473b-9ffd-cc56b92b5466` | directory-verified |
| 49 | 35.469129 | -84.652949 | `6a03a2b8-5d79-4192-b5a9-5572e6162957` | directory-verified |
| 56 | 35.545167 | -84.565514 | `5adb811d-9b49-4829-a08f-75481f80a864` | directory-verified |
| 60 | 35.59857 | -84.516427 | `20b3d4b8-3e07-4795-8441-3711c7cf8a06` | directory-verified |
| 62 | 35.625271 | -84.491883 | `1a87c0af-66ae-46d8-8732-4539b477e0ac` | directory-verified |
| 72 | 35.733196 | -84.397797 | `0b49a63f-9886-4ac2-a547-81b6ecda5d6f` | directory-verified |
| 117 | 36.11107 | -84.020183 | `bc4ff9f8-a138-4a2c-9fc2-e6b9017faea7` | directory-verified |
| 134 | 36.29564 | -84.214299 | `2f6979c4-6292-4910-8d54-1e1b5e216ef7` | directory-verified |
| 141 | 36.37677 | -84.248712 | `03c57077-85f1-4fea-8838-348d2f8a3b5f` | directory-verified |

## Out-of-scope corridors present in calibration.json

- I-40 TN: 1 anchor(s) — not in this package's scope. A single anchor cannot interpolate BETWEEN exits, but it does serve exact-exit matches (including listings routed here by concurrency normalization); any such candidates are excluded from the review CSV and recorded in the rejected CSV.

Concurrency-resolved candidates excluded from this package: 8
