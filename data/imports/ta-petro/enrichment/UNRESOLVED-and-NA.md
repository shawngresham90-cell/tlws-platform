# TA/Petro enrichment — unresolved, N/A, and interstate-only rows

All values that WERE written come only from the operator master Directions field. The rows below are deliberately NOT auto-written; each is explained.

## Unresolved — ambiguous, quarantined (11)

Directions list more than one exit (usually direction-dependent) or otherwise can't be reduced to a single authoritative exit. Interstate may still be written where unambiguous.

| Name | State | Interstate written? | Evidence (Directions) |
|---|---|---|---|
| TA Council Bluffs | IA | yes: I-29 | `I-29(NB)/I-80(EB), Exit 48 I-29(SB)/I-80(WB), Exit 3 S. Expwy, Exit 49` |
| TA Greenland | NH | yes: I-95 | `I-95, Exit 3 Northbound; Exit 3B Southbound` |
| Petro Bordentown | NJ | yes: I-295 | `I-295, Exit 57; NJ Turnpike, Exit 7` |
| TA Albuquerque | NM | yes: I-40 | `I-40, Exit 159A,D/I-25,Exit 225(Nthbnd):Exit 227(Sthbnd)` |
| TA Mill City | NV | yes: I-80 | `I-80, Exit 151 (West) Exit 149 (East)` |
| TA Binghamton | NY | yes: I-81 | `I-81 N. Exit 2W, NY Route 17 or I-81 S., Exit 3` |
| Petro Perrysburg | OH | yes: I-280 | `Ohio Turnpike, Exit 71, I-280 Exit 1B` |
| Petro Oklahoma City | OK | yes: I-35 | `I-40E / I-35, Exit 127/I-40W, Exit 154` |
| Petro Carlisle | PA | yes: I-81 | `I-81, Exit 52; I-76, Exit 226` |
| Petro Pearsall | TX | yes: I-35 | `I-35, Exit 101(Southbound) I-35, Exit 100(Northbound)` |
| TA Wytheville | VA | yes: I-77 | `I-77, Exit 41, I-81, Exit 72` |

## Not applicable — not on an Interstate (40)

The operator locates these on U.S. or state highways (no Interstate designation), so `interstate`/`exit_number` are correctly left blank — this is authoritative evidence of absence, not missing research.

| Name | State | Evidence (Directions) |
|---|---|---|
| TA Express White Hills | AZ | `US Hwy 93, MM 29` |
| TA Express Olancha | CA | `US Hwy 395` |
| TA Madera | CA | `State Hwy 99, Exit 144` |
| TA Livingston | CA | `SR 99 at Exit 203 Winton Parkway` |
| Petro Santa Nella | CA | `State Hwy 152 & State Hwy 33` |
| TA Express Grand Junction | CO | `US 6, 50` |
| TA Express Lamar | CO | `US HWY 50` |
| TA Express Medley | FL | `` |
| TA Express Holstein | IA | `US Hwy 20` |
| TA Express Holland | IA | `US Hwy 20, Exit 208` |
| TA Wellsville | KS | `US 33,` |
| TA Express Hutchinson | KS | `US Hwy 50` |
| TA Garden City | KS | `US Hwy 400` |
| TA Express Kansas City | KS | `HWY 635, Exit 3` |
| TA Express Fairview | KS | `US Hwy 75` |
| TA Express Laplace | LA | `` |
| TA Express Mankato | MN | `US Hwy 14` |
| TA Express Palmyra | MO | `US Hwy 61` |
| TA Express Eagleville | MO | `1-35; Exit 106` |
| TA Express Norwood | MO | `US Hwy 60 & North Hwy E` |
| TA Express Williston | ND | `US Hwy 2` |
| TA Express Alexander | ND | `US Hwy 85 & SR 68` |
| Petro Napoleon | OH | `US Hwy 6 & 24, Industrial Dr. Exit 41` |
| TA Jackson | OH | `US Hwy 35` |
| TA Express Savanna | OK | `US HWY 69` |
| TA Express South Coffeyville | OK | `US HWY 169` |
| TA Express Ronks | PA | `NULL` |
| TA Express Hot Springs | SD | `US Hwy 385 / 18 and 79` |
| Petro North Hillsboro | TX | `I-35E, Exit 374` |
| TA Shepherd | TX | `US 59` |
| TA Express Baytown South | TX | `Null` |
| TA Vernon, TX | TX | `US 287` |
| TA Express Carthage | TX | `US Hwy 59` |
| TA Express Decatur | TX | `US Hwy 287 & 81` |
| TA Express Almeda | TX | `State Hwy 288, Almeda Genoa Rd exit` |
| TA Express Junction | TX | `` |
| TA Express Nacogdoches | TX | `Tx-224 Loop E, Stalling Dr, Westward Dr, Hospital` |
| TA Express Kingsville | TX | `US Hwy 77` |
| TA Edinburg | TX | `Hwy. 281, Exit FM 2812` |
| TA Ganado | TX | `Hwy 59, Exit 522E` |

## Interstate written, exit not available (25)

On an Interstate per the operator, but the Directions give a road name rather than a numbered exit, so only `interstate` is written.

| Name | State | Interstate | Evidence (Directions) |
|---|---|---|---|
| TA Wheeler Ridge | CA | I-5 | `I-5 @ Lake Isabella or Laval Road` |
| Petro Wheeler Ridge | CA | I-5 | `I-5 at Laval Road West` |
| TA Santa Nella | CA | I-5 | `I-5 & Hwy 33, Santa Nella Exit` |
| TA Redding | CA | I-5 | `I-5, Knighton Road` |
| TA Ontario | CA | I-10 | `I-10 at Milliken Avenue` |
| TA Chicago North | IL | I-94 | `I-94 & Russell, Illinois/Wisconsin Line` |
| TA Lafayette | LA | I-10 | `I-10 & State Road 182, MM 101` |
| Petro Clearwater | MN | I-94 | `I-94 & Hwy 24` |
| Petro Jackson | MS | I-20 | `I-20` |
| TA Paulsboro | NJ | I-295 | `I-295, 18A, Mt. Royal Exit` |
| TA Glenrio | NM | I-40 | `I-40, 369` |
| TA Express Pleasanton | TX | I-37 | `I-37/Hwy 97` |
| TA Express North Houston | TX | I-8 | `I-8,` |
| TA Laredo | TX | I-35 | `I-35 and Beltway Parkway` |
