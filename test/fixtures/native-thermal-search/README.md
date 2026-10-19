Complete qrpcard J2-small source and routed board from the frozen benchmark.
The routed board adds two native thermal errors and has zero opens. Compressed
boards retain exact authored geometry; shared project and custom rules are exact.
License is captured alongside the boards. No frozen benchmark file was edited.

The end-to-end regression requires the bounded search to find both repair stages,
preserve source and routed terminal groups, and publish an exact repair bundle.
A one-stage control must publish nothing and leave both caller boards untouched.
These are offline native experiments, not scored routing results.
